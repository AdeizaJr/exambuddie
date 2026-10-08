// src/services/cron.ts
import cron from 'node-cron';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';
import * as redis from './redis';
import * as payments from './payments';
import * as outreach from './outreach';
import { refreshPricing } from './pricing';
import * as fmt from '../bot/formatter';
import { SUBJECT_MAP, SUBJECT_EMOJI, examCountdown } from '../bot/formatter';
import { endExpiredRoom } from '../bot/handlers/challenge';

// Picks a question from one of the user's own weak topics (accuracy < 100% over
// the last 7 days, >=2 attempts — same bar as db.getWeakTopicsAllSubjects). Returns
// null if the user has no qualifying weak topic yet, or no matching question exists.
async function pickWeakTopicQuestion(
  userId: number,
  subjects: string[],
  examType: string | null,
  excludeIds: number[] = []
): Promise<number | null> {
  if (!subjects.length) return null;
  const weakTopics = await db.getWeakTopicsAllSubjects(userId, subjects);
  if (!weakTopics.length) return null;

  const { subject, topic } = weakTopics[Math.floor(Math.random() * weakTopics.length)];
  const params: any[] = [subject, topic];
  let examClause = '';
  if (examType) { params.push(examType); examClause = `AND q.exam_type = $${params.length}`; }
  let excludeClause = '';
  if (excludeIds.length) { params.push(excludeIds); excludeClause = `AND q.id != ALL($${params.length})`; }
  const { rows } = await db.query(
    `SELECT q.id FROM questions q
     WHERE q.is_active = TRUE
       AND q.subject = $1 AND q.topic = $2
       AND q.explanation IS NOT NULL AND length(q.explanation) > 20
       ${examClause}
       ${excludeClause}
     ORDER BY RANDOM() LIMIT 1`,
    params
  );
  return rows[0]?.id ?? null;
}

// node-cron catches a rejected task internally (so a failure never crashes the process)
// but only emits an unlistened 'task-failed' event — a transient DB hiccup during, say,
// the hourly expired-subscription check silently no-ops that entire run with zero
// console output and no alert. Wrapping every scheduled task through this gives each one
// the same logging + system_alerts row the QOTD cron already had.
function safeCron(pattern: string, name: string, task: () => Promise<void>, options?: any): void {
  cron.schedule(pattern, async () => {
    try {
      await task();
    } catch (e: any) {
      console.error(`[CRON] ${name} error:`, e);
      await db.createAlert(`cron:${name}`, e?.message || String(e), 'warning').catch(() => {});
    }
  }, options);
}

export default function startCrons(bot: any): void {
  // ── Every 15s — manage challenge rooms ────────────────────────────────────
  // startRoom/endRoom are status-guarded so a re-processed room is a no-op even if this
  // tick does overlap — this flag is the cheap first line of defense so a slow tick
  // (busy lobby, slow Telegram API) doesn't even attempt to re-query/re-send at all.
  let challengeTickRunning = false;
  setInterval(async () => {
    if (challengeTickRunning) return;
    challengeTickRunning = true;
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
    } finally {
      challengeTickRunning = false;
    }
  }, 15_000);

  // ── Every midnight WAT (UTC+1) — reset daily counts ─────────────────────
  safeCron(
    '0 23 * * *',
    'daily-reset',
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

  // ── Every hour — refresh pricing cache (backstop; updatePricing() already
  // refreshes it immediately on admin edit — this just guards against drift) ──
  safeCron('0 * * * *', 'pricing-refresh', async () => {
    await refreshPricing().catch((e) => console.error('[CRON] pricing refresh error:', e.message));
  });

  // ── Every hour — check expired subscriptions ──────────────────────────────
  safeCron('0 * * * *', 'expired-subscriptions', async () => {
    const expired = await payments.checkExpiredSubscriptions();
    for (const user of expired) {
      if (!user.notifications_enabled) continue;
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          `⏰ <b>Your ExamBuddie Premium has expired, ${fmt.escHtml(user.first_name)}!</b>\n\nYou're back on the free plan (5 questions/day). Renew to keep unlimited access.\n\n👇 Tap /subscribe to continue your exam prep.`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        await outreach.noteSendFailure(user.telegram_id, err);
      }
    }
    if (expired.length > 0)
      console.log(`[CRON] Downgraded ${expired.length} expired subscriptions`);
  });

  // ── 3-day expiry reminders — runs daily at 9am WAT (8am UTC) ──────────────
  safeCron('0 8 * * *', 'expiry-reminders', async () => {
    const { rows } = await db.query(
      `SELECT telegram_id, first_name, plan_expires_at
       FROM users
       WHERE plan = 'premium'
       AND plan_expires_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
       AND notifications_enabled = true AND blocked_at IS NULL`
    );

    for (const user of rows) {
      const expiryDate = new Date(user.plan_expires_at).toLocaleDateString('en-NG');
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          `⚠️ <b>Reminder, ${fmt.escHtml(user.first_name)}!</b>\n\nYour ExamBuddie Premium expires on <b>${expiryDate}</b>. Renew now to keep uninterrupted access to unlimited questions.\n\n/subscribe`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        await outreach.noteSendFailure(user.telegram_id, err);
      }
    }
  });

  // ── Daily 9am UTC (10am WAT) — nudge new users stuck at zero attempts ──────
  // One-shot: activation_nudge_sent_at gates re-sends, so the >20h window doesn't
  // need to be exact — a user only ever gets this once regardless of when the
  // daily run catches them.
  safeCron('0 9 * * *', 'activation-nudge', async () => {
    const { rows } = await db.query(
      `SELECT telegram_id, first_name FROM users u
       WHERE joined_at < NOW() - INTERVAL '20 hours'
         AND activation_nudge_sent_at IS NULL
         AND notifications_enabled = TRUE AND blocked_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = u.id)`
    );

    for (const user of rows) {
      try {
        await outreach.claimBudget(user.telegram_id); // counts toward the daily cap, never skipped
        await bot.telegram.sendMessage(
          user.telegram_id,
          `👋 <b>Hey ${fmt.escHtml(user.first_name)}!</b>\n\nYou joined ExamBuddie but haven't answered your first question yet. It only takes 30 seconds — tap below and give one a shot 👇`,
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '📚 Try a Question', callback_data: 'practice:pick' }]] },
          }
        );
      } catch (err) {
        await outreach.noteSendFailure(user.telegram_id, err);
      }
    }
    if (rows.length > 0) {
      await db.query(
        `UPDATE users SET activation_nudge_sent_at = NOW() WHERE telegram_id = ANY($1)`,
        [rows.map((u: any) => u.telegram_id)]
      );
      console.log(`[CRON] Sent activation nudge to ${rows.length} stalled new users`);
    }
  });

  // ── Daily 11am UTC (12pm WAT) — nudge users who never finished onboarding ──
  // A user without exam_type is excluded from every other broadcast cron (QOTD,
  // weekly summary, did-you-know all filter on `exam_type IS NOT NULL`), so unlike
  // activation-nudge (stalled at zero attempts, but still onboarded) this catches
  // people who dropped mid-signup and would otherwise never hear from the bot again.
  // One-shot: onboarding_nudge_sent_at gates re-sends.
  safeCron('0 11 * * *', 'onboarding-nudge', async () => {
    const { rows } = await db.query(
      `SELECT telegram_id, first_name FROM users u
       WHERE joined_at < NOW() - INTERVAL '20 hours'
         AND exam_type IS NULL
         AND onboarding_nudge_sent_at IS NULL
         AND notifications_enabled = TRUE AND blocked_at IS NULL`
    );

    for (const user of rows) {
      try {
        await outreach.claimBudget(user.telegram_id); // counts toward the daily cap, never skipped
        await bot.telegram.sendMessage(
          user.telegram_id,
          `👋 <b>Hey ${fmt.escHtml(user.first_name)}!</b>\n\nYou started signing up for ExamBuddie but never finished picking your exam. Takes 10 seconds to wrap up, then you're straight into practice 👇`,
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '✅ Finish Setup', callback_data: 'onboard:resume' }]] },
          }
        );
      } catch (err) {
        await outreach.noteSendFailure(user.telegram_id, err);
      }
    }
    if (rows.length > 0) {
      await db.query(
        `UPDATE users SET onboarding_nudge_sent_at = NOW() WHERE telegram_id = ANY($1)`,
        [rows.map((u: any) => u.telegram_id)]
      );
      console.log(`[CRON] Sent onboarding nudge to ${rows.length} incomplete signups`);
    }
  });

  // ── Sunday 22:55 UTC (23:55 WAT) — snapshot leaderboard before weekly reset ──
  safeCron('55 22 * * 0', 'leaderboard-snapshot', async () => {
    console.log('[CRON] Snapshotting weekly leaderboard...');
    const saved = await db.snapshotLeaderboard();
    console.log(`[CRON] Leaderboard snapshot: ${saved} entries saved`);
  }, { timezone: 'UTC' } as any);

  // ── Sunday 8am UTC (9am WAT) — morning wave ──────────────────────────────
  safeCron('0 8 * * 0', 'weekly-summary-morning', async () => {
    console.log('[CRON] Weekly summaries — morning wave...');
    const { rows: users } = await db.query(
      `SELECT u.id, u.telegram_id, u.first_name, u.subjects, u.streak, u.plan, u.last_active_date
       FROM users u
       WHERE u.notifications_enabled = TRUE AND blocked_at IS NULL
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

  // ── Sunday 6pm UTC (7pm WAT) — evening wave (also catches any morning failures) ──
  // Was 4pm UTC, same slot as the daily question-of-the-day cron below — on Sundays
  // both fired at the same second, doubling concurrent bot.telegram.send* pressure for
  // any user eligible for both. Moved 2 hours clear of QOTD and 5 hours clear of the
  // Sunday leaderboard-snapshot job (10:55pm UTC).
  safeCron('0 18 * * 0', 'weekly-summary-evening', async () => {
    console.log('[CRON] Weekly summaries — evening wave...');
    const { rows: users } = await db.query(
      `SELECT u.id, u.telegram_id, u.first_name, u.subjects, u.streak, u.plan, u.last_active_date
       FROM users u
       WHERE u.notifications_enabled = TRUE AND blocked_at IS NULL
         AND (u.last_report_sent_at IS NULL OR u.last_report_sent_at < NOW() - INTERVAL '6 days')
         AND EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = u.id AND a.attempted_at > NOW() - INTERVAL '7 days')`
    );
    await sendWeeklySummaries(users, bot, 'evening');
  });

  // ── 7am UTC (8am WAT), Mon-Thu + Sat — Did You Know ──────────────────────
  // Skips Friday and Sunday: those days already carry the weekend nudge / weekly
  // summary on top of QOTD, and the daily cap (outreach.DAILY_UNPROMPTED_CAP) would
  // otherwise spend a slot on a fact and drop the more useful message later.
  safeCron('0 7 * * 1-4,6', 'did-you-know', async () => {
    console.log('[CRON] Sending Did You Know facts...');

    const { rows: users } = await db.query(
      `SELECT u.id, u.telegram_id, u.first_name, u.subjects
       FROM users u
       WHERE u.notifications_enabled = TRUE AND blocked_at IS NULL
         AND u.subjects IS NOT NULL AND array_length(u.subjects, 1) > 0
         AND EXISTS (
           SELECT 1 FROM attempts a WHERE a.user_id = u.id AND a.attempted_at > NOW() - INTERVAL '30 days'
         )`
    );

    if (!users.length) return;

    // Pre-select one fact per (subject_code, difficulty) for today (least-recently-used).
    // Everyone at the same level in a subject shares a fact — only the tier varies per user.
    const allSubjectCodes = [...new Set(users.flatMap((u: any) => u.subjects as string[]))];
    const factMap = await db.getDailyFactsForSubjects(allSubjectCodes);
    const fallbackFact = await db.getRandomFact();

    const dayIndex = Math.floor(Date.now() / 86400000);
    const BATCH_SIZE = 20;
    let sent = 0;
    const usedFactIds = new Set<number>();
    const sentUserIds: number[] = [];

    // New to the subject (no attempts) defaults to 'easy' — build confidence before
    // stretching them. Thresholds match the accuracy-color convention used elsewhere
    // (landing page demo, share card): <50 struggling, 50-70 solid, >70 strong.
    function tierForAccuracy(accuracy: number | null): string {
      if (accuracy === null || accuracy < 50) return 'easy';
      if (accuracy < 70) return 'medium';
      return 'hard';
    }

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (user: any) => {
        let claimed = false;
        try {
          const subjects: string[] = user.subjects || [];
          // Rotate which subject the user sees today
          const todaySubject = subjects[dayIndex % subjects.length];
          const bySubject = factMap[todaySubject];

          let fact = fallbackFact;
          if (bySubject) {
            const accuracy = await db.getUserSubjectAccuracy(user.id, todaySubject);
            const tier = tierForAccuracy(accuracy);
            fact = bySubject[tier] || bySubject.medium || Object.values(bySubject)[0] || fallbackFact;
          }
          if (!fact) return;

          const subjectLabel = fact.subject;
          const topicLabel = fact.topic ? ` · ${fmt.escHtml(fact.topic)}` : '';

          const msg = `💡 <b>Did You Know?</b>\n\n${fact.fact_text}\n\n<i>📚 ${subjectLabel}${topicLabel}</i>`;
          if (!(await outreach.claimBudget(user.telegram_id))) return;
          claimed = true;
          await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
          usedFactIds.add(fact.id);
          sentUserIds.push(user.id);
          sent++;
        } catch (err) {
          if (claimed) await outreach.refundBudget(user.telegram_id);
          await outreach.noteSendFailure(user.telegram_id, err);
        }
      }));
      if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
    }

    await db.markFactsSent([...usedFactIds]);
    if (sentUserIds.length) {
      await db.query(`UPDATE users SET last_dyk_sent_at = NOW() WHERE id = ANY($1)`, [sentUserIds]);
    }
    console.log(`[CRON] Did You Know sent to ${sent}/${users.length} users`);
  });

  // ── Daily 2pm UTC (3pm WAT) — 3-day inactivity nudge ────────────────────
  safeCron('0 14 * * *', 'inactivity-nudge', async () => {
    const watNow = new Date(Date.now() + 60 * 60 * 1000);
    const threeDaysAgoWAT = new Date(watNow.getTime() - 3 * 86400000).toISOString().split('T')[0];

    const { rows: users } = await db.query(
      `SELECT telegram_id, first_name, streak
       FROM users
       WHERE notifications_enabled = TRUE AND blocked_at IS NULL
         AND last_active_date = $1`,
      [threeDaysAgoWAT]
    );

    let sent = 0;
    const BATCH_SIZE = 20;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (user) => {
        let claimed = false;
        try {
          if (!(await outreach.claimBudget(user.telegram_id))) return;
          claimed = true;
          const streakWarn = (user.streak || 0) > 0
            ? `\n\n⚠️ Your <b>${user.streak}-day streak</b> is at risk!` : '';
          await bot.telegram.sendMessage(
            user.telegram_id,
            `👋 <b>Miss us, ${fmt.escHtml(user.first_name)}?</b>\n\nYou haven't practised in 3 days. Even 5 questions today keeps you on track for your exam.${streakWarn}\n\n📚 /practice`,
            { parse_mode: 'HTML' }
          );
          sent++;
        } catch (err) {
          if (claimed) await outreach.refundBudget(user.telegram_id);
          await outreach.noteSendFailure(user.telegram_id, err);
        }
      }));
      if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`[CRON] 3-day inactivity nudge sent to ${sent}/${users.length} users`);
  });

  // ── Hourly — daily auto-challenge ────────────────────────────────────────
  safeCron('0 * * * *', 'auto-challenge', async () => {
    const watHour = new Date(Date.now() + 60 * 60 * 1000).getUTCHours();
    const watToday = new Date(Date.now() + 60 * 60 * 1000).toISOString().split('T')[0];

    const { rows: users } = await db.query(
      `SELECT telegram_id, first_name, exam_type, subjects, id
       FROM users
       WHERE notifications_enabled = TRUE AND blocked_at IS NULL
         AND daily_reminder_hour = $1
         AND (last_active_date IS NULL OR last_active_date < $2)
         AND exam_type IS NOT NULL
         AND array_length(subjects, 1) > 0`,
      [watHour, watToday]
    );

    let sent = 0;
    const BATCH_SIZE = 20;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (user) => {
        try {
          // Pick a random subject from the user's subjects
          const subjects: string[] = user.subjects || [];
          const subject = subjects[Math.floor(Math.random() * subjects.length)];
          const examType = user.exam_type;

          // Try to get a challenge question
          const q = await db.getRandomQuestion(examType, subject, [], null, null, user.id);

          if (!q) {
            // Fall back to plain text reminder
            await bot.telegram.sendMessage(
              user.telegram_id,
              `⏰ <b>Daily Challenge, ${fmt.escHtml(user.first_name)}!</b>\n\nTime to practise! Even 5 questions keeps the momentum going.\n\n📚 /practice`,
              { parse_mode: 'HTML' }
            );
            sent++;
            return;
          }

          const msgText = `⏰ <b>Daily Challenge, ${fmt.escHtml(user.first_name)}!</b>\n\n`
            + fmt.formatQuestion(q, 1, 5, 'practice')
            + fmt.answerOptions(q);

          const sessionId = uuidv4();
          const imageUrl = q.image_url?.startsWith('/')
            ? `${process.env.APP_URL || ''}${q.image_url}`
            : q.image_url;

          if (imageUrl) {
            await bot.telegram.sendPhoto(user.telegram_id, imageUrl, {
              caption: msgText,
              parse_mode: 'HTML',
              reply_markup: fmt.answerKeyboard(!!q.option_e),
            });
          } else {
            await bot.telegram.sendMessage(user.telegram_id, msgText, {
              parse_mode: 'HTML',
              reply_markup: fmt.answerKeyboard(!!q.option_e),
            });
          }

          // Store session so the user can answer and continue
          await redis.setSession(user.telegram_id, {
            mode: 'practice',
            subject,
            examType,
            sessionId,
            qNum: 1,
            correct: 0,
            total: 0,
            currentQuestion: q,
            startTime: Date.now(),
            usedIds: [q.id],
            autoChallenge: true,
            autoTotal: 5,
          });

          sent++;
        } catch (err) {
          await outreach.noteSendFailure(user.telegram_id, err);
        }
      }));
      if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
    }
    if (users.length > 0) console.log(`[CRON] Daily challenge sent to ${sent}/${users.length} users at WAT ${watHour}:00`);
  });

  // ── Friday 6pm UTC (7pm WAT) — mid-week nudge ────────────────────────────
  safeCron('0 18 * * 5', 'friday-nudge', async () => {
    console.log('[CRON] Friday nudge...');
    const { rows: users } = await db.query(
      `SELECT u.id, u.telegram_id, u.first_name, u.streak,
              COUNT(a.id) as week_attempts,
              ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id), 0), 1) as week_accuracy
       FROM users u
       JOIN attempts a ON a.user_id = u.id
       WHERE a.attempted_at > NOW() - INTERVAL '7 days'
         AND u.notifications_enabled = TRUE AND blocked_at IS NULL
       GROUP BY u.id`
    );

    let sent = 0;
    const BATCH_SIZE = 20;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (user) => {
        let claimed = false;
        try {
          if (!(await outreach.claimBudget(user.telegram_id))) return;
          claimed = true;
          const attempts = parseInt(user.week_attempts || '0');
          const accuracy = parseFloat(user.week_accuracy || '0');
          const streakLine = (user.streak || 0) > 0
            ? `🔥 Keep your ${user.streak}-day streak alive`
            : '🔥 Start a new streak';
          const msg = `📚 <b>Weekend's here, ${fmt.escHtml(user.first_name)}!</b>

You've done <b>${attempts} questions</b> this week at <b>${accuracy}%</b> accuracy — the exam doesn't take weekends off 😤

${streakLine} → /practice`;
          await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
          sent++;
        } catch (err) {
          if (claimed) await outreach.refundBudget(user.telegram_id);
          await outreach.noteSendFailure(user.telegram_id, err);
        }
      }));
      if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`[CRON] Friday nudge sent to ${sent}/${users.length} users`);
  });

  // ── 1st of every month — NDPA data retention: purge inactive accounts ───────
  // Deletes free-plan users with no activity for 24+ months (data minimisation).
  // Premium/trial users are excluded — they have an active commercial relationship.
  safeCron('0 2 1 * *', 'ndpa-retention', async () => {
    console.log('[CRON] NDPA retention: purging long-inactive accounts...');
    const { rows } = await db.query(
      `SELECT telegram_id FROM users
       WHERE plan = 'free'
         AND (last_active_date IS NULL OR last_active_date < CURRENT_DATE - INTERVAL '24 months')
         AND (joined_at < NOW() - INTERVAL '24 months')
         AND NOT EXISTS (
           SELECT 1 FROM subscriptions s WHERE s.user_id = users.id
         )`
    );
    let purged = 0;
    for (const user of rows) {
      try {
        await db.deleteUser(user.telegram_id);
        await redis.deleteUserData(user.telegram_id);
        purged++;
      } catch (e: any) {
        console.error(`[CRON] retention purge error for ${user.telegram_id}:`, e.message);
      }
    }
    console.log(`[CRON] NDPA retention: purged ${purged}/${rows.length} inactive accounts`);
  });

  // ── Daily 5:30am UTC (6:30am WAT) — Exam Day Companion ────────────────────
  // On the morning a user's own exam is actually sitting, replace the usual QOTD noise
  // with one calm, subject-specific message instead — checked here, ahead of QOTD below,
  // so the QOTD cron can skip anyone who already got this.
  safeCron('30 5 * * *', 'exam-day-companion', async () => {
    const { todaysExamSubjects } = await import('../bot/handlers/timetable');
    // subject slugs that don't map 1:1 onto a /formula sheet key
    const FORMULA_ALIAS: Record<string, string> = { math: 'maths' };
    const FORMULA_SHEETS = new Set([
      'physics', 'chemistry', 'maths', 'further-math', 'biology', 'economics', 'government',
      'english', 'geography', 'literature', 'accounts', 'agric', 'commerce', 'computer', 'crk', 'irk',
    ]);

    const { rows: users } = await db.query(
      `SELECT telegram_id, first_name, exam_type, subjects FROM users
       WHERE notifications_enabled = TRUE AND blocked_at IS NULL AND exam_type IS NOT NULL`
    );

    let sent = 0;
    for (const user of users) {
      try {
        const subjectsToday: string[] = todaysExamSubjects(user.exam_type, user.subjects || []);
        if (subjectsToday.length === 0) continue;

        const isJamb = subjectsToday[0] === 'ALL';
        const subjectLine = isJamb ? 'JAMB UTME' : `${user.exam_type} ${subjectsToday.map(s => SUBJECT_MAP[s] || s).join(' & ')}`;
        const msg = `🍀 <b>Today's the day, ${fmt.escHtml(user.first_name)}!</b>\n\nYour ${subjectLine} exam is today. Stay calm, trust your practice, and take it one question at a time. You've got this.`;

        const formulaSlug = !isJamb ? (FORMULA_ALIAS[subjectsToday[0]] || subjectsToday[0]) : null;
        const keyboard = formulaSlug && FORMULA_SHEETS.has(formulaSlug)
          ? { inline_keyboard: [[{ text: `📐 Quick ${SUBJECT_MAP[subjectsToday[0]] || subjectsToday[0]} Formula Check`, callback_data: `formula:${formulaSlug}` }]] }
          : { inline_keyboard: [[{ text: '📚 One Last Practice Round', callback_data: 'practice:pick' }]] };

        await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML', reply_markup: keyboard });
        sent++;
      } catch (err) {
        await outreach.noteSendFailure(user.telegram_id, err);
      }
    }
    if (sent > 0) console.log(`[CRON] Exam-day companion sent to ${sent} users`);
  });

  // ── Daily 4pm UTC (5pm WAT) — Question of the Day broadcast ──────────────
  safeCron('0 16 * * *', 'question-of-the-day', async () => {
    console.log('[CRON] Sending Question of the Day...');
    const { todaysExamSubjects } = await import('../bot/handlers/timetable');
    const date = new Date(Date.now() + 3600_000).toISOString().split('T')[0]; // WAT date

    // Pick one question per exam type and cache it for the day. 'ALL' covers users
    // whose exam_type is 'ALL' or 'BOTH' (practice-any-board) — examTypeFilter of
    // null means no exam_type restriction.
    const examTypes: { key: string; examTypeFilter: string | null }[] = [
      { key: 'WAEC', examTypeFilter: 'WAEC' },
      { key: 'JAMB', examTypeFilter: 'JAMB' },
      { key: 'NECO', examTypeFilter: 'NECO' },
      { key: 'ALL', examTypeFilter: null },
    ];
    const qotdMap: Record<string, any> = {};
    for (const { key, examTypeFilter } of examTypes) {
      let qId: number | null = await redis.getQOTDQuestion(date, key);
      if (!qId) {
        // Prefer a well-attempted question, but with only a small user base most
        // questions never reach a high attempt count — cascade the threshold down
        // rather than going silent for whole exam types on any given day.
        // Exclude recently-served ones so the same question doesn't repeat day after day.
        const recentIds = await redis.getQOTDHistory(`shared:${key}`);
        for (const minAttempts of [5, 3, 1, 0]) {
          const params: any[] = [minAttempts];
          let examClause = '';
          if (examTypeFilter) { params.push(examTypeFilter); examClause = `AND q.exam_type = $${params.length}`; }
          let excludeClause = '';
          if (recentIds.length) { params.push(recentIds); excludeClause = `AND q.id != ALL($${params.length})`; }
          const { rows } = await db.query(
            `SELECT q.id FROM questions q
             LEFT JOIN attempts a ON a.question_id = q.id
             WHERE q.is_active = TRUE
               AND q.explanation IS NOT NULL
               AND length(q.explanation) > 20
               ${examClause}
               ${excludeClause}
             GROUP BY q.id
             HAVING COUNT(a.id) >= $1
             ORDER BY RANDOM() LIMIT 1`,
            params
          );
          if (rows[0]) { qId = rows[0].id as number; break; }
        }
        if (!qId) continue;
        await redis.setQOTDQuestion(date, key, qId);
        await redis.addQOTDHistory(`shared:${key}`, qId);
      }
      const q = await db.getQuestionById(qId as number);
      if (q) qotdMap[key] = q;
    }

    const { rows: users } = await db.query(
      `SELECT id, telegram_id, first_name, exam_type, subjects FROM users
       WHERE notifications_enabled = TRUE AND blocked_at IS NULL
         AND exam_type IS NOT NULL`
    );

    let sent = 0;
    let personalized = 0;
    let noQuestion = 0;
    // "sent" alone can't tell an incident from a normal day — 56 eligible - 47 sent could
    // mean 9 legitimate skips (exam-day, already-answered) or 9 real delivery failures, and
    // the old code lumped all of it into one undifferentiated gap with a bare `catch {}`
    // that dropped the actual Telegram error on the floor. These track each path separately
    // so a spike in real failures is visible instead of hiding inside routine attrition.
    let examDaySkip = 0;
    let alreadyAnswered = 0;
    let capped = 0;
    let sendFailed = 0;
    const failReasons: Record<string, number> = {};
    const sentUserIds: number[] = [];
    const BATCH_SIZE = 25;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (user) => {
        // Anyone sitting their own exam today already got the calm, subject-specific Exam
        // Day Companion message above — don't also land an unrelated QOTD on top of it.
        if (todaysExamSubjects(user.exam_type, user.subjects || []).length > 0) { examDaySkip++; return; }

        const bucketKey = ['ALL', 'BOTH'].includes(user.exam_type) ? 'ALL' : user.exam_type;
        const examTypeFilter = bucketKey === 'ALL' ? null : user.exam_type;

        // Try a question from one of the user's own weak topics (last 7 days of
        // attempts) before falling back to the shared per-exam-type pick — new
        // users or ones without enough attempt history won't have any yet.
        let personalizedQId: number | null = await redis.getQOTDQuestion(date, `user:${user.telegram_id}`);
        if (!personalizedQId) {
          const recentIds = await redis.getQOTDHistory(`user:${user.telegram_id}`);
          personalizedQId = await pickWeakTopicQuestion(user.id, user.subjects || [], examTypeFilter, recentIds);
          if (personalizedQId) {
            await redis.setQOTDQuestion(date, `user:${user.telegram_id}`, personalizedQId);
            await redis.addQOTDHistory(`user:${user.telegram_id}`, personalizedQId);
          }
        }

        const q = personalizedQId ? await db.getQuestionById(personalizedQId) : qotdMap[bucketKey];
        if (!q) { noQuestion++; return; }

        // Skip if user already answered today's QOTD
        if (await redis.getQOTDAnswered(user.telegram_id, date)) { alreadyAnswered++; return; }

        const msgText = fmt.formatQuestion(q, 1, 1, 'qotd', !!personalizedQId) + fmt.answerOptions(q);

        const keyboard = {
          inline_keyboard: [
            ['A', 'B', 'C', 'D', 'E'].filter(opt => q[`option_${opt.toLowerCase()}`]).map(opt => ({
              text: opt,
              callback_data: `qotd:answer:${q.id}:${opt}`,
            })),
          ],
        };

        // Already had today's share of unprompted messages — don't pile on.
        if (!(await outreach.claimBudget(user.telegram_id))) { capped++; return; }

        try {
          const imageUrl = q.image_url?.startsWith('/')
            ? `${process.env.APP_URL || ''}${q.image_url}`
            : q.image_url;

          if (imageUrl) {
            await bot.telegram.sendPhoto(user.telegram_id, imageUrl, {
              caption: msgText, parse_mode: 'HTML', reply_markup: keyboard,
            });
          } else {
            await bot.telegram.sendMessage(user.telegram_id, msgText, {
              parse_mode: 'HTML', reply_markup: keyboard,
            });
          }
          sent++;
          sentUserIds.push(user.id);
          if (personalizedQId) personalized++;
        } catch (err: any) {
          sendFailed++;
          await outreach.refundBudget(user.telegram_id);
          await outreach.noteSendFailure(user.telegram_id, err);
          // Telegraf surfaces the actual Telegram API rejection in err.response.description
          // (e.g. "Forbidden: bot was blocked by the user", "Bad Request: chat not found") —
          // bucket by that so the summary log shows a breakdown instead of one opaque count,
          // and a routine blocked-bot rate is visually distinguishable from a new failure mode.
          const reason = err?.response?.description || err?.message || 'unknown error';
          failReasons[reason] = (failReasons[reason] || 0) + 1;
        }
      }));
      if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
    }
    if (sentUserIds.length) {
      await db.query(`UPDATE users SET last_qotd_sent_at = NOW() WHERE id = ANY($1)`, [sentUserIds]);
    }
    const failBreakdown = Object.entries(failReasons)
      .map(([reason, count]) => `${count}x "${reason}"`)
      .join(', ');
    console.log(
      `[CRON] QOTD sent to ${sent}/${users.length} users (${personalized} personalized) — ` +
      `skipped: ${examDaySkip} exam-day, ${alreadyAnswered} already-answered, ${capped} daily-cap, ${noQuestion} no-question — ` +
      `failed: ${sendFailed}${failBreakdown ? ` (${failBreakdown})` : ''}`
    );

    // A blocked-bot rate of a few users a day is normal attrition, not an incident — only
    // alert when failures unrelated to "the user blocked us" show up, since that's the
    // signal for an actual delivery bug (rate limit, malformed request, bad image URL).
    const unexpectedFailures = Object.entries(failReasons)
      .filter(([reason]) => !/blocked by the user|chat not found|user is deactivated/i.test(reason))
      .reduce((sum, [, count]) => sum + count, 0);
    if (unexpectedFailures > 0) {
      await db.createAlert(
        'qotd_cron',
        `QOTD: ${unexpectedFailures} send failure(s) not explained by a blocked/deleted chat — ${failBreakdown}`,
        'warning'
      );
    }

    if (users.length > 0 && sent === 0) {
      await db.createAlert(
        'qotd_cron',
        `QOTD sent to 0/${users.length} eligible users — check bot connectivity or candidate-question availability.`,
        'critical'
      );
    } else if (noQuestion > 0) {
      await db.createAlert(
        'qotd_cron',
        `QOTD: ${noQuestion}/${users.length} eligible user(s) had no matching question (no personalized pick and no shared fallback for their exam type).`,
        'warning'
      );
    }
  });

  // ── Daily 7am WAT (6am UTC) — Exam timetable reminders (1, 3, 7 days out) ──
  // Each subject rolls to next year on its own once this year's sitting has passed
  // (nextOccurrence) — no dependency on the user's stored target_year.
  safeCron('5 6 * * *', 'exam-timetable-reminders', async () => {
    const { WAEC_2026, NECO_2026, JAMB_2026, nextOccurrence } = await import('../bot/handlers/timetable');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function daysUntil(iso: string): number {
      const d = new Date(iso);
      d.setHours(0, 0, 0, 0);
      return Math.round((d.getTime() - today.getTime()) / 86400000);
    }

    const MILESTONES = [1, 3, 7];

    const { rows: users } = await db.query(
      `SELECT telegram_id, first_name, exam_type, subjects FROM users
       WHERE notifications_enabled = TRUE AND blocked_at IS NULL AND exam_type IS NOT NULL`
    );

    let sent = 0;
    for (const user of users) {
      try {
        const userSubjects: string[] = user.subjects || [];
        const reminders: string[] = [];

        if (user.exam_type === 'JAMB') {
          const days = daysUntil(nextOccurrence(JAMB_2026));
          if (MILESTONES.includes(days)) {
            reminders.push(`🎯 <b>JAMB UTME</b> is in <b>${days} day${days !== 1 ? 's' : ''}!</b>`);
          }
        } else {
          const table = user.exam_type === 'NECO' ? NECO_2026 : WAEC_2026;
          for (const subject of userSubjects) {
            const iso = table[subject];
            if (!iso) continue;
            const days = daysUntil(nextOccurrence(iso));
            if (MILESTONES.includes(days)) {
              const name = SUBJECT_MAP[subject] || subject;
              reminders.push(`${SUBJECT_EMOJI[subject] || '📖'} <b>${name}</b> in <b>${days} day${days !== 1 ? 's' : ''}!</b>`);
            }
          }
        }

        if (reminders.length === 0) continue;

        const msg = `⏰ <b>Exam Alert, ${fmt.escHtml(user.first_name)}!</b>\n\n${reminders.join('\n')}\n\n📚 <a href="t.me/exambuddiebot?start=practice">Practise now</a>`;
        await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
        sent++;
      } catch (err) {
        await outreach.noteSendFailure(user.telegram_id, err);
      }
    }
    if (sent > 0) console.log(`[CRON] Timetable reminders sent to ${sent} users`);
  });

  // ── Every 4 minutes — ping the landing site to prevent Railway idle sleep ──
  // A cold start on the landing service can take 6-7s, long enough for Googlebot
  // to log it as a server error (seen in Search Console for the homepage).
  setInterval(async () => {
    try {
      await axios.get(process.env.LANDING_URL || 'https://exambuddie.app', { timeout: 10_000 });
    } catch (e: any) {
      console.error('[CRON] Landing keep-alive ping failed:', e.message);
    }
  }, 4 * 60 * 1000);

  console.log('⏰ Cron jobs started');
}

function watToday(): string {
  return new Date(Date.now() + 3600000).toISOString().split('T')[0];
}

function buildWeeklyPremiumMsg(user: any, report: db.WeeklyReport): { msg: string; keyboard?: any } {
  const { thisWeek, lastWeek, subjectBreakdown, weakTopics, bestSubject, coverageStats, percentileRank } = report;

  const delta = lastWeek.attempts > 0 ? thisWeek.accuracy - lastWeek.accuracy : null;
  const deltaStr = delta !== null
    ? (delta >= 0 ? ` ↑ +${delta.toFixed(1)}%` : ` ↓ ${delta.toFixed(1)}%`)
    : '';

  const streakAtRisk = (user.streak || 0) > 0 && user.last_active_date !== watToday();

  if (thisWeek.attempts < 5) {
    const streakWarn = streakAtRisk
      ? `\n\n⚡ <b>Practice today to protect your ${user.streak}-day streak!</b>` : '';
    return { msg: `💎 <b>Slow week, ${fmt.escHtml(user.first_name)}</b>

Only ${thisWeek.attempts} questions this week. Even 10 more today makes a real difference.
🎯 Accuracy: ${thisWeek.accuracy}%${deltaStr}
🔥 Streak: ${user.streak || 0} days${streakWarn}

Back on track? /practice` };
  }

  const subjectLines = subjectBreakdown.map((s) => {
    const name = SUBJECT_MAP[s.subject] || s.subject;
    const emoji = SUBJECT_EMOJI[s.subject] || '📖';
    const warn = s.accuracy < 50 ? ' ⚠️' : '';
    return `  ${emoji} ${name}: ${s.accuracy}% (${s.attempts} questions)${warn}`;
  }).join('\n');

  const weakLines = weakTopics.map((t) => {
    const subjectName = SUBJECT_MAP[t.subject] || t.subject;
    return `  • ${fmt.escHtml(t.topic)} <i>(${subjectName})</i> — ${t.accuracy}%`;
  }).join('\n');

  const weakButtons = weakTopics.map((t) => ([{
    text: `🎯 Drill ${t.topic}`,
    callback_data: `drill:topic:${t.subject}:${t.topic}`,
  }]));

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
  const msg = `💎 <b>Your Weekly Report, ${fmt.escHtml(user.first_name)}!</b>${countdown ? `\n${countdown}` : ''}

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

  return weakTopics.length > 0
    ? { msg, keyboard: { inline_keyboard: weakButtons } }
    : { msg };
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
    ? `\n\n⚠️ <b>Weak Topics:</b>\n${weakTopics.map(t => `  • ${fmt.escHtml(t.topic)}: ${t.accuracy}% accuracy`).join('\n')}`
    : '';

  const blurredBreakdown = subjects.length > 0
    ? `\n\n💎 <b>Subject Breakdown</b> <i>(Premium)</i>\n${subjects.slice(0, 3).map(s => {
        const name = SUBJECT_MAP[s] || s;
        const emoji = SUBJECT_EMOJI[s] || '📖';
        return `  ${emoji} ${name}: ████████`;
      }).join('\n')}\n<i>Unlock your full breakdown + drill suggestions:</i> /subscribe`
    : `\n\n💎 <i>Upgrade to Premium for subject breakdowns, week-over-week tracking, and drill suggestions.</i> /subscribe`;

  if (weeklyAttempts < 5) {
    return `📊 <b>Slow week, ${fmt.escHtml(user.first_name)}</b>

Only ${weeklyAttempts} questions this week — that's okay, let's pick it up.
🔥 Streak: ${user.streak || 0} days${streakWarn}

Even 10 questions today puts you back on track → /practice${blurredBreakdown}`;
  }

  return `📊 <b>Your Week in Review, ${fmt.escHtml(user.first_name)}!</b>

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
        let keyboard: any;
        if (user.plan === 'premium') {
          const report = await db.getWeeklyReport(user.id);
          ({ msg, keyboard } = buildWeeklyPremiumMsg(user, report));
        } else {
          msg = await buildFreeMsg(user);
        }
        await outreach.claimBudget(user.telegram_id); // counts toward the daily cap, never skipped
        await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML', reply_markup: keyboard });
        sentIds.push(user.id);
        sent++;
      } catch (err) {
        await outreach.noteSendFailure(user.telegram_id, err);
      }
    }));
    if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
  }

  await db.markWeeklyReportSent(sentIds);
  console.log(`[CRON] Weekly summaries (${waveName}): sent ${sent}/${users.length}`);
}
