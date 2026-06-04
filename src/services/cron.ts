// src/services/cron.ts
import cron from 'node-cron';
import * as db from '../db';
import * as payments from './payments';
import * as fmt from '../bot/formatter';

export default function startCrons(bot: any): void {
  // ── Every midnight WAT (UTC+1) — reset daily counts ─────────────────────
  cron.schedule('0 23 * * *', async () => {
    // WAT midnight = 23:00 UTC
    console.log('[CRON] Resetting daily question counts...');
    await db.query(
      `UPDATE users SET daily_count = 0, daily_reset_at = CURRENT_DATE`
    );
  }, { timezone: 'UTC' } as any);

  // ── Every hour — check expired subscriptions ──────────────────────────────
  cron.schedule('0 * * * *', async () => {
    const expired = await payments.checkExpiredSubscriptions();
    for (const user of expired) {
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          `⏰ *Your ExamBuddi Premium has expired, ${user.first_name}!*\n\nYou're back on the free plan (5 questions/day). Renew to keep unlimited access.\n\n👇 Tap /subscribe to continue your exam prep.`,
          { parse_mode: 'HTML' }
        );
      } catch (e) { /* user may have blocked the bot */ }
    }
    if (expired.length > 0) console.log(`[CRON] Downgraded ${expired.length} expired subscriptions`);
  });

  // ── 3-day expiry reminders — runs daily at 9am WAT (8am UTC) ──────────────
  cron.schedule('0 8 * * *', async () => {
    const { rows } = await db.query(
      `SELECT telegram_id, first_name, plan_expires_at
       FROM users
       WHERE plan = 'premium'
       AND plan_expires_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'`
    );

    for (const user of rows) {
      const expiryDate = new Date(user.plan_expires_at).toLocaleDateString('en-NG');
      try {
        await bot.telegram.sendMessage(
          user.telegram_id,
          `⚠️ *Reminder, ${user.first_name}!*\n\nYour ExamBuddi Premium expires on *${expiryDate}*. Renew now to keep uninterrupted access to unlimited questions.\n\n/subscribe`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    }
  });

  // ── Sunday 10am WAT — weekly summary messages ─────────────────────────────
  cron.schedule('0 9 * * 0', async () => {
    console.log('[CRON] Sending weekly summaries...');

    // Get active users from last 7 days with notifications on
    const { rows: users } = await db.query(
      `SELECT DISTINCT u.id, u.telegram_id, u.first_name, u.subjects, u.streak, u.notifications_enabled
       FROM users u
       JOIN attempts a ON a.user_id = u.id
       WHERE a.attempted_at > NOW() - INTERVAL '7 days'
       AND u.notifications_enabled = true`
    );

    let sent = 0;
    for (const user of users) {
      try {
        const stats = await db.getUserStats(user.id);
        const subject = user.subjects?.[0];
        const weakTopics = subject ? await db.getWeakTopics(user.id, subject) : [];

        const weeklyAccuracy = await (async () => {
          const { rows } = await db.query(
            `SELECT ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) as acc
             FROM attempts WHERE user_id = $1 AND attempted_at > NOW() - INTERVAL '7 days'`,
            [user.id]
          );
          return rows[0]?.acc || 0;
        })();

        const weakSection = weakTopics.length > 0
          ? `\n⚠️ *Weak Topics to Focus On:*\n${weakTopics.map(t =>
              `  • ${t.topic}: ${t.accuracy}% accuracy`).join('\n')}`
          : '';

        const msg = `📊 *Your Week in Review, ${user.first_name}!*

This week:
🎯 Accuracy: ${weeklyAccuracy}%
🔥 Current Streak: ${user.streak || 0} days
${weakSection}

Keep up the momentum — exams reward consistency! 💪

Ready to practise? /practice`;

        await bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'HTML' });
        sent++;
      } catch (e) { /* user blocked or unavailable */ }
    }

    console.log(`[CRON] Weekly summaries sent to ${sent} users`);
  });

  console.log('⏰ Cron jobs started');
}
