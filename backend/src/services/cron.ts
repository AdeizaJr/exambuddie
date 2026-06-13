// src/services/cron.ts
import cron from 'node-cron';
import * as db from '../db';
import * as payments from './payments';
import { SUBJECT_MAP, SUBJECT_EMOJI } from '../bot/formatter';

export default function startCrons(bot: any): void {
  // ── Every midnight WAT (UTC+1) — reset daily counts ─────────────────────
  cron.schedule(
    '0 23 * * *',
    async () => {
      // WAT midnight = 23:00 UTC
      console.log('[CRON] Resetting daily question counts...');
      await db.query(`UPDATE users SET daily_count = 0, daily_reset_at = CURRENT_DATE`);
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

  // ── Sunday 10am WAT — weekly summary messages ─────────────────────────────
  cron.schedule('0 9 * * 0', async () => {
    console.log('[CRON] Sending weekly summaries...');

    const { rows: users } = await db.query(
      `SELECT DISTINCT u.id, u.telegram_id, u.first_name, u.subjects, u.streak, u.plan
       FROM users u
       JOIN attempts a ON a.user_id = u.id
       WHERE a.attempted_at > NOW() - INTERVAL '7 days'`
    );

    let sent = 0;
    for (const user of users) {
      try {
        let msg: string;

        if (user.plan === 'premium') {
          const report = await db.getWeeklyReport(user.id);
          const { thisWeek, lastWeek, subjectBreakdown, weakTopics } = report;

          const delta = lastWeek.attempts > 0
            ? thisWeek.accuracy - lastWeek.accuracy
            : null;
          const deltaStr = delta !== null
            ? (delta >= 0 ? ` ↑ +${delta.toFixed(1)}%` : ` ↓ ${delta.toFixed(1)}%`)
            : '';

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

          msg = `💎 <b>Your Weekly Report, ${user.first_name}!</b>

📅 <b>This Week's Performance:</b>
📝 Questions answered: ${thisWeek.attempts}
🎯 Accuracy: ${thisWeek.accuracy}%${deltaStr}
🔥 Streak: ${user.streak || 0} days${subjectBreakdown.length > 0 ? `

📚 <b>Subject Breakdown:</b>
${subjectLines}` : ''}${weakTopics.length > 0 ? `

⚠️ <b>Focus Areas (drill these to improve fast):</b>
${weakLines}` : '\n\n✅ No weak topics detected this week — great work!'}

Keep pushing — consistency is what wins exams. 💪
Ready? /practice`;
        } else {
          const subject = user.subjects?.[0];
          const weakTopics = subject ? await db.getWeakTopics(user.id, subject) : [];

          const { rows } = await db.query(
            `SELECT ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) as acc
             FROM attempts WHERE user_id = $1 AND attempted_at > NOW() - INTERVAL '7 days'`,
            [user.id]
          );
          const weeklyAccuracy = rows[0]?.acc || 0;

          const weakSection = weakTopics.length > 0
            ? `\n⚠️ <b>Weak Topics to Focus On:</b>\n${weakTopics.map((t) => `  • ${t.topic}: ${t.accuracy}% accuracy`).join('\n')}`
            : '';

          msg = `📊 <b>Your Week in Review, ${user.first_name}!</b>

This week:
🎯 Accuracy: ${weeklyAccuracy}%
🔥 Current Streak: ${user.streak || 0} days
${weakSection}

Keep up the momentum — exams reward consistency! 💪

💎 <i>Upgrade to Premium for full subject breakdowns, week-over-week tracking, and personalised drill suggestions.</i> /subscribe

Ready to practise? /practice`;
        }

        await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
        sent++;
      } catch {
        /* user blocked or unavailable */
      }
    }

    console.log(`[CRON] Weekly summaries sent to ${sent} users`);
  });

  console.log('⏰ Cron jobs started');
}
