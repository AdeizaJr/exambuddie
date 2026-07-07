// src/bot/handlers/qotd.ts — Question of the Day answer handler
import * as db from '../../db';
import * as redis from '../../services/redis';
import { formatExplanation } from '../formatter';

// QOTD answer is handled outside a session — look up the question directly
export async function handleQOTDAnswer(ctx: any, questionId: string, option: string): Promise<void> {
  await ctx.answerCbQuery();
  const qId = parseInt(questionId, 10);
  if (!qId) return;

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  // Prevent double-answering
  const date = new Date(Date.now() + 3600_000).toISOString().split('T')[0]; // WAT date
  const alreadyAnswered = await redis.getQOTDAnswered(ctx.from.id, date);
  if (alreadyAnswered) {
    await ctx.answerCbQuery('You already answered today\'s question!', { show_alert: true });
    return;
  }

  const q = await db.getQuestionById(qId);
  if (!q) return;

  const isCorrect = option === q.correct_option;

  await Promise.all([
    redis.markQOTDAnswered(ctx.from.id, date),
    db.logAttempt({
      userId: user.id,
      questionId: q.id,
      selectedOption: option,
      isCorrect,
      sessionId: `qotd_${date}`,
    }),
  ]);

  const resultLine = isCorrect
    ? '✅ <b>Correct!</b>'
    : `❌ <b>Wrong.</b> The answer is <b>${q.correct_option}</b>.`;

  const explanation = q.explanation
    ? `\n\n💡 ${formatExplanation(q.explanation)}`
    : '';

  const correctOptKey = `option_${q.correct_option.toLowerCase()}` as keyof typeof q;
  const correctText = q[correctOptKey] as string || '';

  await ctx.reply(
    `📅 <b>Question of the Day: Result</b>\n\n${resultLine}\n<b>${q.correct_option}.</b> ${correctText}${explanation}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📚 Keep Practising', callback_data: 'practice:pick' }],
          [{ text: '📋 Take a Quiz', callback_data: 'quiz:pick' }],
        ],
      },
    }
  );
}
