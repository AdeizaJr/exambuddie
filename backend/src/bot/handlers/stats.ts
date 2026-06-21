// src/bot/handlers/stats.ts
import * as db from '../../db';
import * as fmt from '../formatter';
import { SUBJECT_MAP, SUBJECT_EMOJI } from '../formatter';
import * as payments from '../../services/payments';
import * as redis from '../../services/redis';

export async function handleStats(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    '📊 <b>Which exam would you like to see stats for?</b>',
    { parse_mode: 'HTML', reply_markup: fmt.statsFilterKeyboard() }
  );
}

export async function handleStatsFilter(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const examType = ctx.callbackQuery.data.split(':')[2]; // 'WAEC' | 'NECO' | 'JAMB' | 'all'

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  const subjects = user.subjects && user.subjects.length > 0 ? user.subjects : [];
  const [stats, subjectStats, ...perSubjectWeakTopics] = await Promise.all([
    db.getUserStats(user.id, examType),
    db.getSubjectStats(user.id, examType),
    ...subjects.map(s => db.getWeakTopics(user.id, s, examType)),
  ]);
  const weakTopics = (perSubjectWeakTopics as any[][])
    .flat()
    .sort((a: any, b: any) => a.accuracy - b.accuracy)
    .slice(0, 3);

  await ctx.reply(fmt.statsMessage(user, stats, weakTopics, examType, subjectStats), { parse_mode: 'HTML' });
}

// Called from bot.start() when user arrives via landing page deep link
export async function handleSubscribeDeepLink(ctx: any, plan: string): Promise<void> {
  const user = await db.upsertUser(ctx);
  if (user.plan === 'premium' && user.plan_expires_at && new Date(user.plan_expires_at) > new Date()) {
    await ctx.reply('✅ You already have an active Premium plan! Use /stats to track your progress.', { parse_mode: 'HTML' });
    return;
  }
  if (!payments.PLANS[plan]) {
    await handleSubscribe(ctx);
    return;
  }
  try {
    const { link, txRef } = await payments.createPaymentLink(user, plan);
    const planInfo = payments.PLANS[plan];
    await ctx.reply(
      fmt.paymentLinkMessage(link, planInfo.label, txRef),
      { parse_mode: 'HTML', disable_web_page_preview: false }
    );
  } catch (err: any) {
    console.error('Payment link error:', err.message);
    await ctx.reply('Sorry, we could not generate a payment link right now. Please try again in a moment.');
  }
}

export async function handleSubscribe(ctx: any): Promise<void> {
  await ctx.reply(fmt.upgradeMessage(), {
    parse_mode: 'HTML',
    reply_markup: fmt.subscribeKeyboard(),
    disable_web_page_preview: true,
  });
}

export async function handleSubscribePlan(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const plan = ctx.callbackQuery.data.split(':')[1]; // 'monthly' | 'yearly'
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  try {
    const { link, txRef } = await payments.createPaymentLink(user, plan);
    const planInfo = payments.PLANS[plan];

    await ctx.reply(
      fmt.paymentLinkMessage(link, planInfo.label, txRef),
      { parse_mode: 'HTML', disable_web_page_preview: false }
    );
  } catch (err: any) {
    console.error('Payment link error:', err.message);
    await ctx.reply('Sorry, we could not generate a payment link right now. Please try again in a moment.');
  }
}

export async function handleQuizHistory(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  const history = await db.getQuizHistory(user.id);

  if (history.length === 0) {
    await ctx.reply(
      '📜 <b>Quiz History</b>\n\nNo quizzes completed yet. Take your first quiz!',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Take a Quiz', callback_data: 'quiz:pick' }],
            [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
          ],
        },
      }
    );
    return;
  }

  let text = '📜 <b>Quiz History</b> (last 10)\n\n';
  for (const s of history) {
    const accuracy =
      s.total_questions > 0 ? Math.round((s.correct_count / s.total_questions) * 100) : 0;
    const date = new Date(s.started_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const durationMs = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
    const durationMins = Math.round(durationMs / 60000);
    const subject = SUBJECT_MAP[s.subject] || s.subject;
    const grade =
      accuracy >= 80 ? '🏆' : accuracy >= 65 ? '🌟' : accuracy >= 50 ? '👍' : '💪';
    text += `${grade} <b>${subject}</b>\n   ${s.correct_count}/${s.total_questions} • ${accuracy}% • ${durationMins}m • ${date}\n\n`;
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Take Another Quiz', callback_data: 'quiz:pick' }],
        [{ text: '📊 My Stats', callback_data: 'stats:show' },
         { text: '🏠 Main Menu', callback_data: 'menu:main' }],
      ],
    },
  });
}

export async function handleFlagUnderline(ctx: any): Promise<void> {
  const s = await redis.getSession(ctx.from.id);
  const quizState = await redis.getQuizState(ctx.from.id);
  const q = s?.currentQuestion ?? quizState?.questions[quizState.qIndex] ?? null;

  if (!q || !q.question_text.includes('*')) {
    await ctx.answerCbQuery('Nothing to flag right now.', { show_alert: false });
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  await ctx.answerCbQuery('🔤 Underline flagged — we\'ll fix it!', { show_alert: true });

  await db.query(
    `INSERT INTO flagged_explanations (question_id, user_id, reason)
     VALUES ($1, $2, 'wrong_underline')`,
    [q.id, user.id]
  );
  await db.query(`UPDATE questions SET flag_count = flag_count + 1 WHERE id = $1`, [q.id]);
}

export async function handleFlagQuestion(ctx: any): Promise<void> {
  const s = await redis.getSession(ctx.from.id);
  const quizState = await redis.getQuizState(ctx.from.id);

  const q = s?.currentQuestion ?? quizState?.questions[quizState.qIndex] ?? null;

  if (!q) {
    await ctx.answerCbQuery('Nothing to flag right now.', { show_alert: false });
    return;
  }

  await ctx.answerCbQuery();
  await ctx.reply('🚩 What\'s wrong with this question?', {
    reply_markup: fmt.flagReasonKeyboard(),
  });
}

export async function handleFlagReason(ctx: any, reasonCode: string): Promise<void> {
  const s = await redis.getSession(ctx.from.id);
  const quizState = await redis.getQuizState(ctx.from.id);
  const q = s?.currentQuestion ?? quizState?.questions[quizState.qIndex] ?? null;

  if (!q) {
    await ctx.answerCbQuery('Nothing to flag right now.', { show_alert: false });
    return;
  }

  const reasonLabel = fmt.FLAG_REASONS[reasonCode];
  if (!reasonLabel) {
    await ctx.answerCbQuery('Unknown reason.', { show_alert: false });
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  await ctx.answerCbQuery('🚩 Flagged — we\'ll review it. Thanks!', { show_alert: true });

  await db.query(
    `INSERT INTO flagged_explanations (question_id, user_id, reason)
     VALUES ($1, $2, $3)`,
    [q.id, user.id, reasonLabel]
  );

  await db.query(`UPDATE questions SET flag_count = flag_count + 1 WHERE id = $1`, [q.id]);

  await ctx.editMessageText('✅ Thanks — flagged for review.').catch(() => {});
}

export async function handleFlagCancel(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Cancelled.').catch(() => {});
}

export async function handleWeeklyReport(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  if (user.plan !== 'premium') {
    await ctx.reply(
      '💎 Weekly reports are a Premium feature.\n\nUpgrade to see your full breakdown, week-over-week accuracy, weak topics, and peer ranking.',
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '💎 Upgrade to Premium', callback_data: 'menu:subscribe' }]] },
      }
    );
    return;
  }

  const report = await db.getWeeklyReport(user.id);
  const { thisWeek, lastWeek, subjectBreakdown, weakTopics, bestSubject, coverageStats, percentileRank } = report;

  if (thisWeek.attempts === 0) {
    await ctx.reply("📊 No questions answered this week yet.\n\nStart practising to see your report! /practice");
    return;
  }

  const delta = lastWeek.attempts > 0 ? thisWeek.accuracy - lastWeek.accuracy : null;
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

  const msg = `💎 <b>Your Weekly Report</b>

📅 <b>This Week:</b>
📝 Questions answered: ${thisWeek.attempts}
🎯 Accuracy: ${thisWeek.accuracy}%${deltaStr}
🔥 Streak: ${user.streak || 0} days${bestLine}${percentileLine}${subjectBreakdown.length > 0 ? `

📚 <b>Subject Breakdown:</b>
${subjectLines}` : ''}${coverageLines ? `

📈 <b>Progress:</b>
${coverageLines}` : ''}${weakTopics.length > 0 ? `

⚠️ <b>Focus Areas:</b>
${weakLines}` : '\n\n✅ No weak topics this week — great work!'}`;

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '← Back to Settings', callback_data: 'settings:back' }]] },
  });
}
