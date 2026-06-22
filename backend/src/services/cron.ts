// src/services/cron.ts
import cron from 'node-cron';
import * as db from '../db';
import * as payments from './payments';
import { SUBJECT_MAP, SUBJECT_EMOJI, examCountdown } from '../bot/formatter';
import { endExpiredRoom } from '../bot/handlers/challenge';

export default function startCrons(bot: any): void {
  // ── Every 15s — manage challenge rooms ────────────────────────────────────
  setInterval(async () => {
    try {
      // Start waiting rooms whose 60s lobby timer has expired
      const expiredLobbies = await db.getExpiredLobbyRooms();
      for (const room of expiredLobbies) {
        const participants = await db.getRoomParticipants(room.id);
        if (participants.length === 0) { await db.endRoom(room.id); continue; }
        const { startChallengeCron } = await import('../bot/handlers/challenge');
        await startChallengeCron(bot.telegram, room, participants);
      }
      // End active rooms whose overall time has expired
      const expired = await db.getExpiredActiveRooms();
      for (const room of expired) {
        await endExpiredRoom(bot.telegram, room);
      }
    } catch (e) {
      console.error('[CRON] challenge room error:', e);
    }
  }, 15_000);

  // ── Every midnight WAT (UTC+1) — reset daily counts ─────────────────────
  cron.schedule(
    '0 23 * * *',
    async () => {
      // WAT midnight = 23:00 UTC
      console.log('[CRON] Resetting daily question counts and broken streaks...');
      await db.query(`UPDATE users SET daily_count = 0, daily_reset_at = CURRENT_DATE`);
      // Reset streak for users who missed yesterday (WAT).
      // At 23:00 UTC = 00:00 WAT: "yesterday WAT" = CURRENT_DATE (UTC).
      // last_active_date is now stored as WAT date strings.
      const { rowCount } = await db.query(`
        UPDATE users SET streak = 0
        WHERE streak > 0
          AND (last_active_date IS NULL OR last_active_date < CURRENT_DATE)
          AND NOT (
            plan = 'premium'
            AND streak_freeze_used_at = CURRENT_DATE
          )
      `);
      console.log(`[CRON] Broke streaks for ${rowCount} inactive users`);
    },
    { timezone: 'UTC' } as any
  );

  // ── Every hour — check expired subscriptions ──────────────────────────────
  cron.schedule('0 * * * *', async () => {
    const expired = await payments.checkExpiredSubscriptions();
    for (const user of expired) {
      if (!user.notifications_enabled) continue;
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          `⏰ <b>Your ExamBuddie Premium has expired, ${user.first_name}!</b>\n\nYou're back on the free plan (5 questions/day). Renew to keep unlimited access.\n\n👇 Tap /subscribe to continue your exam prep.`,
          { parse_mode: 'HTML' }
        );
      } catch {
        /* user may have blocked the bot */
      }
    }
    if (expired.length > 0)
      console.log(`[CRON] Downgraded ${expired.length} expired subscriptions`);
  });

  // ── 3-day expiry reminders — runs daily at 9am WAT (8am UTC) ──────────────
  cron.schedule('0 8 * * *', async () => {
    const { rows } = await db.query(
      `SELECT telegram_id, first_name, plan_expires_at
       FROM users
       WHERE plan = 'premium'
       AND plan_expires_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
       AND notifications_enabled = true`
    );

    for (const user of rows) {
      const expiryDate = new Date(user.plan_expires_at).toLocaleDateString('en-NG');
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          `⚠️ <b>Reminder, ${user.first_name}!</b>\n\nYour ExamBuddie Premium expires on <b>${expiryDate}</b>. Renew now to keep uninterrupted access to unlimited questions.\n\n/subscribe`,
          { parse_mode: 'HTML' }
        );
      } catch { /* user blocked or unavailable */ }
    }
  });

  // ── Sunday 8am UTC (9am WAT) — morning wave ──────────────────────────────
  cron.schedule('0 8 * * 0', async () => {
    console.log('[CRON] Weekly summaries — morning wave...');
    const { rows: users } = await db.query(
      `SELECT u.id, u.telegram_id, u.first_name, u.subjects, u.streak, u.plan, u.last_active_date
       FROM users u
       WHERE u.notifications_enabled = TRUE
         AND (u.last_report_sent_at IS NULL OR u.last_report_sent_at < NOW() - INTERVAL '6 days')
         AND EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = u.id AND a.attempted_at > NOW() - INTERVAL '7 days')
         AND COALESCE(
           (SELECT EXTRACT(HOUR FROM (ph.attempted_at AT TIME ZONE 'Africa/Lagos'))::INT
            FROM attempts ph WHERE ph.user_id = u.id AND ph.attempted_at > NOW() - INTERVAL '30 days'
            GROUP BY EXTRACT(HOUR FROM (ph.attempted_at AT TIME ZONE 'Africa/Lagos'))::INT
            ORDER BY COUNT(*) DESC LIMIT 1),
           9
         ) BETWEEN 6 AND 14`
    );
    await sendWeeklySummaries(users, bot, 'morning');
  });

  // ── Sunday 4pm UTC (5pm WAT) — evening wave (also catches any morning failures) ──
  cron.schedule('0 16 * * 0', async () => {
    console.log('[CRON] Weekly summaries — evening wave...');
    const { rows: users } = await db.query(
      `SELECT u.id, u.telegram_id, u.first_name, u.subjects, u.streak, u.plan, u.last_active_date
       FROM users u
       WHERE u.notifications_enabled = TRUE
         AND (u.last_report_sent_at IS NULL OR u.last_report_sent_at < NOW() - INTERVAL '6 days')
         AND EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = u.id AND a.attempted_at > NOW() - INTERVAL '7 days')`
    );
    await sendWeeklySummaries(users, bot, 'evening');
  });

  // ── Daily 7am UTC (8am WAT) — Did You Know ───────────────────────────────
  cron.schedule('0 7 * * *', async () => {
    console.log('[CRON] Sending Did You Know facts...');

    const { rows: users } = await db.query(
      `SELECT u.id, u.telegram_id, u.first_name, u.subjects
       FROM users u
       WHERE u.notifications_enabled = TRUE
         AND u.subjects IS NOT NULL AND array_length(u.subjects, 1) > 0
         AND EXISTS (
           SELECT 1 FROM attempts a WHERE a.user_id = u.id AND a.attempted_at > NOW() - INTERVAL '30 days'
         )`
    );

    if (!users.length) return;

    // Pre-select one fact per subject_code for today (least-recently-used)
    const allSubjectCodes = [...new Set(users.flatMap((u: any) => u.subjects as string[]))];
    const factMap = await db.getDailyFactsForSubjects(allSubjectCodes);
    const fallbackFact = await db.getRandomFact();

    const dayIndex = Math.floor(Date.now() / 86400000);
    const BATCH_SIZE = 20;
    let sent = 0;
    const usedFactIds = new Set<number>();

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (user: any) => {
        try {
          const subjects: string[] = user.subjects || [];
          // Rotate which subject the user sees today
          const todaySubject = subjects[dayIndex % subjects.length];
          const fact = factMap[todaySubject] || fallbackFact;
          if (!fact) return;

          const subjectLabel = fact.subject;
          const topicLabel = fact.topic ? ` · ${fact.topic}` : '';

          const msg = `💡 <b>Did You Know?</b>\n\n${fact.fact_text}\n\n<i>📚 ${subjectLabel}${topicLabel}</i>`;
          await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
          usedFactIds.add(fact.id);
          sent++;
        } catch { /* blocked or unavailable */ }
      }));
      if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
    }

    await db.markFactsSent([...usedFactIds]);
    console.log(`[CRON] Did You Know sent to ${sent}/${users.length} users`);
  });

  // ── Daily 2pm UTC (3pm WAT) — 3-day inactivity nudge ────────────────────
  cron.schedule('0 14 * * *', async () => {
    const watNow = new Date(Date.now() + 60 * 60 * 1000);
    const threeDaysAgoWAT = new Date(watNow.getTime() - 3 * 86400000).toISOString().split('T')[0];

    const { rows: users } = await db.query(
      `SELECT telegram_id, first_name, streak
       FROM users
       WHERE notifications_enabled = TRUE
         AND last_active_date = $1`,
      [threeDaysAgoWAT]
    );

    let sent = 0;
    const BATCH_SIZE = 20;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (user) => {
        try {
          const streakWarn = (user.streak || 0) > 0
            ? `\n\n⚠️ Your <b>${user.streak}-day streak</b> is at risk!` : '';
          await bot.telegram.sendMessage(
            user.telegram_id,
            `👋 <b>Miss us, ${user.first_name}?</b>\n\nYou haven't practised in 3 days. Even 5 questions today keeps you on track for your exam.${streakWarn}\n\n📚 /practice`,
            { parse_mode: 'HTML' }
          );
          sent++;
        } catch { /* blocked */ }
      }));
      if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`[CRON] 3-day inactivity nudge sent to ${sent}/${users.length} users`);
  });

  // ── Hourly — daily reminder opt-in ───────────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    const watHour = new Date(Date.now() + 60 * 60 * 1000).getUTCHours();
    const watToday = new Date(Date.now() + 60 * 60 * 1000).toISOString().split('T')[0];

    const { rows: users } = await db.query(
      `SELECT telegram_id, first_name
       FROM users
       WHERE notifications_enabled = TRUE
         AND daily_reminder_hour = $1
         AND (last_active_date IS NULL OR last_active_date < $2)`,
      [watHour, watToday]
    );

    let sent = 0;
    const BATCH_SIZE = 20;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (user) => {
        try {
          await bot.telegram.sendMessage(
            user.telegram_id,
            `⏰ <b>Time to practise, ${user.first_name}!</b>\n\nYour daily reminder is here. Even 5 questions keeps the momentum going.\n\n📚 /practice`,
            { parse_mode: 'HTML' }
          );
          sent++;
        } catch { /* blocked */ }
      }));
      if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
    }
    if (users.length > 0) console.log(`[CRON] Daily reminder sent to ${sent}/${users.length} users at WAT ${watHour}:00`);
  });

  // ── Friday 5pm UTC (6pm WAT) — mid-week nudge ────────────────────────────
  cron.schedule('0 17 * * 5', async () => {
    console.log('[CRON] Friday nudge...');
    const { rows: users } = await db.query(
      `SELECT u.id, u.telegram_id, u.first_name, u.streak,
              COUNT(a.id) as week_attempts,
              ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id), 0), 1) as week_accuracy
       FROM users u
       JOIN attempts a ON a.user_id = u.id
       WHERE a.attempted_at > NOW() - INTERVAL '7 days'
         AND u.notifications_enabled = TRUE
       GROUP BY u.id`
    );

    let sent = 0;
    const BATCH_SIZE = 20;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (user) => {
        try {
          const attempts = parseInt(user.week_attempts || '0');
          const accuracy = parseFloat(user.week_accuracy || '0');
          const streakLine = (user.streak || 0) > 0
            ? `🔥 Keep your ${user.streak}-day streak alive`
            : '🔥 Start a new streak';
          const msg = `📚 <b>Weekend's here, ${user.first_name}!</b>

You've done <b>${attempts} questions</b> this week at <b>${accuracy}%</b> accuracy — the exam doesn't take weekends off 😤

${streakLine} → /practice`;
          await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
          sent++;
        } catch { /* blocked or unavailable */ }
      }));
      if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`[CRON] Friday nudge sent to ${sent}/${users.length} users`);
  });

  console.log('⏰ Cron jobs started');
}

function watToday(): string {
  return new Date(Date.now() + 3600000).toISOString().split('T')[0];
}

function buildWeeklyPremiumMsg(user: any, report: db.WeeklyReport): string {
  const { thisWeek, lastWeek, subjectBreakdown, weakTopics, bestSubject, coverageStats, percentileRank } = report;

  const delta = lastWeek.attempts > 0 ? thisWeek.accuracy - lastWeek.accuracy : null;
  const deltaStr = delta !== null
    ? (delta >= 0 ? ` ↑ +${delta.toFixed(1)}%` : ` ↓ ${delta.toFixed(1)}%`)
    : '';

  const streakAtRisk = (user.streak || 0) > 0 && user.last_active_date !== watToday();

  if (thisWeek.attempts < 5) {
    const streakWarn = streakAtRisk
      ? `\n\n⚡ <b>Practice today to protect your ${user.streak}-day streak!</b>` : '';
    return `💎 <b>Slow week, ${user.first_name}</b>

Only ${thisWeek.attempts} questions this week. Even 10 more today makes a real difference.
🎯 Accuracy: ${thisWeek.accuracy}%${deltaStr}
🔥 Streak: ${user.streak || 0} days${streakWarn}

Back on track? /practice`;
  }

  const subjectLines = subjectBreakdown.map((s) => {
    const name = SUBJECT_MAP[s.subject] || s.subject;
    const emoji = SUBJECT_EMOJI[s.subject] || '📖';
    const warn = s.accuracy < 50 ? ' ⚠️' : '';
    return `  ${emoji} ${name}: ${s.accuracy}% (${s.attempts} questions)${warn}`;
  }).join('\n');

  const weakLines = weakTopics.map((t) => {
    const subjectName = SUBJECT_MAP[t.subject] || t.subject;
    return `  • ${t.topic} <i>(${subjectName})</i> — ${t.accuracy}% → /drill ${t.topic}`;
  }).join('\n');

  const bestLine = bestSubject
    ? `\n🌟 Best subject: ${SUBJECT_MAP[bestSubject.subject] || bestSubject.subject} at ${bestSubject.accuracy}%`
    : '';

  const percentileLine = percentileRank !== null
    ? `\n🏅 You're in the top ${100 - percentileRank}% of students this week`
    : '';

  const coverageLines = coverageStats
    .filter(c => subjectBreakdown.some(s => s.subject === c.subject))
    .slice(0, 2)
    .map(c => {
      const pct = Math.round((c.seen / c.total) * 100);
      const name = SUBJECT_MAP[c.subject] || c.subject;
      return `  📊 ${name}: ${pct}% of question bank explored (${c.seen}/${c.total})`;
    }).join('\n');

  const streakWarn = streakAtRisk
    ? `\n\n⚡ <b>Practice today to protect your ${user.streak}-day streak!</b>` : '';

  const countdown = examCountdown(user.exam_type || null, user.target_year || null);
  return `💎 <b>Your Weekly Report, ${user.first_name}!</b>${countdown ? `\n${countdown}` : ''}

📅 <b>This Week:</b>
📝 Questions answered: ${thisWeek.attempts}
🎯 Accuracy: ${thisWeek.accuracy}%${deltaStr}
🔥 Streak: ${user.streak || 0} days${bestLine}${percentileLine}${subjectBreakdown.length > 0 ? `

📚 <b>Subject Breakdown:</b>
${subjectLines}` : ''}${coverageLines ? `

📈 <b>Progress:</b>
${coverageLines}` : ''}${weakTopics.length > 0 ? `

⚠️ <b>Focus Areas:</b>
${weakLines}` : '\n\n✅ No weak topics this week — great work!'}${streakWarn}

Consistency wins exams. 💪 /practice`;
}

async function buildFreeMsg(user: any): Promise<string> {
  const subjects: string[] = user.subjects || [];
  const streakAtRisk = (user.streak || 0) > 0 && user.last_active_date !== watToday();

  const [accRes, weakTopics] = await Promise.all([
    db.query(
      `SELECT COUNT(*) as attempts,
              ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as acc
       FROM attempts WHERE user_id = $1 AND attempted_at > NOW() - INTERVAL '7 days'`,
      [user.id]
    ),
    db.getWeakTopicsAllSubjects(user.id, subjects),
  ]);

  const weeklyAttempts = parseInt(accRes.rows[0]?.attempts || '0');
  const weeklyAccuracy = parseFloat(accRes.rows[0]?.acc || '0');

  const streakWarn = streakAtRisk
    ? `\n⚡ <b>Practice today to protect your ${user.streak}-day streak!</b>` : '';

  const weakSection = weakTopics.length > 0
    ? `\n\n⚠️ <b>Weak Topics:</b>\n${weakTopics.map(t => `  • ${t.topic}: ${t.accuracy}% accuracy`).join('\n')}`
    : '';

  const blurredBreakdown = subjects.length > 0
    ? `\n\n💎 <b>Subject Breakdown</b> <i>(Premium)</i>\n${subjects.slice(0, 3).map(s => {
        const name = SUBJECT_MAP[s] || s;
        const emoji = SUBJECT_EMOJI[s] || '📖';
        return `  ${emoji} ${name}: ████████`;
      }).join('\n')}\n<i>Unlock your full breakdown + drill suggestions:</i> /subscribe`
    : `\n\n💎 <i>Upgrade to Premium for subject breakdowns, week-over-week tracking, and drill suggestions.</i> /subscribe`;

  if (weeklyAttempts < 5) {
    return `📊 <b>Slow week, ${user.first_name}</b>

Only ${weeklyAttempts} questions this week — that's okay, let's pick it up.
🔥 Streak: ${user.streak || 0} days${streakWarn}

Even 10 questions today puts you back on track → /practice${blurredBreakdown}`;
  }

  return `📊 <b>Your Week in Review, ${user.first_name}!</b>

🎯 Accuracy: ${weeklyAccuracy}%
📝 Questions: ${weeklyAttempts}
🔥 Streak: ${user.streak || 0} days${streakWarn}${weakSection}${blurredBreakdown}

Ready? /practice`;
}

async function sendWeeklySummaries(users: any[], bot: any, waveName: string): Promise<void> {
  const BATCH_SIZE = 20;
  let sent = 0;
  const sentIds: number[] = [];

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async (user) => {
      try {
        let msg: string;
        if (user.plan === 'premium') {
          const report = await db.getWeeklyReport(user.id);
          msg = buildWeeklyPremiumMsg(user, report);
        } else {
          msg = await buildFreeMsg(user);
        }
        await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
        sentIds.push(user.id);
        sent++;
      } catch { /* blocked or unavailable */ }
    }));
    if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
  }

  await db.markWeeklyReportSent(sentIds);
  console.log(`[CRON] Weekly summaries (${waveName}): sent ${sent}/${users.length}`);
}
