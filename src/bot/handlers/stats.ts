// src/bot/handlers/stats.ts
import * as db from '../../db';
import * as fmt from '../formatter';
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
  if (!user) return;

  const [stats, subjectStats, weakTopics] = await Promise.all([
    db.getUserStats(user.id, examType),
    db.getSubjectStats(user.id, examType),
    user.subjects && user.subjects.length > 0
      ? db.getWeakTopics(user.id, user.subjects[0], examType)
      : Promise.resolve([]),
  ]);

  await ctx.reply(fmt.statsMessage(user, stats, weakTopics, examType, subjectStats), { parse_mode: 'HTML' });
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
  if (!user) return;

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

export async function handleFlagQuestion(ctx: any): Promise<void> {
  await ctx.answerCbQuery('Thanks for the flag! We\'ll review this explanation. 🙏', { show_alert: true });

  const s = await redis.getSession(ctx.from.id);
  if (!s || !s.currentQuestion) return;

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  await db.query(
    `INSERT INTO flagged_explanations (question_id, user_id, reason)
     VALUES ($1, $2, 'User flagged as incorrect')`,
    [s.currentQuestion.id, user.id]
  );

  await db.query(
    `UPDATE questions SET flag_count = flag_count + 1 WHERE id = $1`,
    [s.currentQuestion.id]
  );
}
