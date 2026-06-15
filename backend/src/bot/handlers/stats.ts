// src/bot/handlers/stats.ts
import * as db from '../../db';
import * as fmt from '../formatter';
import { SUBJECT_MAP } from '../formatter';
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

export async function handleQuizHistory(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) return;

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
  if (!user) return;

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

  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  const subjectName = q.subject.charAt(0).toUpperCase() + q.subject.slice(1).replace(/-/g, ' ');
  const toast = `🚩 Flagged: ${subjectName} ${q.exam_type} ${q.year}. We'll review it — thanks!`;
  await ctx.answerCbQuery(toast, { show_alert: true });

  await db.query(
    `INSERT INTO flagged_explanations (question_id, user_id, reason)
     VALUES ($1, $2, 'User flagged as incorrect')`,
    [q.id, user.id]
  );

  await db.query(
    `UPDATE questions SET flag_count = flag_count + 1 WHERE id = $1`,
    [q.id]
  );
}
