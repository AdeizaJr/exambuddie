// src/bot/handlers/qotd.ts — Question of the Day answer handler
import * as db from '../../db';
import * as redis from '../../services/redis';
import { correctAnswer, formatStreakCard, qotdResultKeyboard } from '../formatter';

// QOTD answer is handled outside a session — look up the question directly
export async function handleQOTDAnswer(ctx: any, questionId: string, option: string): Promise<void> {
  const qId = parseInt(questionId, 10);
  if (!qId) { await ctx.answerCbQuery(); return; }

  // Prevent double-answering — the SET NX below is the atomic guard (returns false if
  // already marked), closing the gap a separate read-then-write-later left for two
  // near-simultaneous taps to both pass a check before either write landed.
  const date = new Date(Date.now() + 3600_000).toISOString().split('T')[0]; // WAT date

  // These three reads/writes are independent of each other — run concurrently
  // instead of stacking their round-trip latencies, which was the main source
  // of the delay users saw before the result/explanation appeared.
  const [user, answeredOk, q] = await Promise.all([
    db.getUser(ctx.from.id),
    redis.markQOTDAnswered(ctx.from.id, date),
    db.getQuestionById(qId),
  ]);

  if (!user) { await ctx.answerCbQuery(); return; }
  if (!answeredOk) {
    await ctx.answerCbQuery('You already answered today\'s question!', { show_alert: true });
    return;
  }
  await ctx.answerCbQuery();
  if (!q) return;

  const isCorrect = option === q.correct_option;

  // Fire-and-forget: the user doesn't need this write acknowledged to see their result.
  db.logAttempt({
    userId: user.id,
    questionId: q.id,
    selectedOption: option,
    isCorrect,
    sessionId: `qotd_${date}`,
  }).catch((err) => console.error('[handleQOTDAnswer] logAttempt persist error:', err));
  const streakPromise = db.updateStreak(ctx.from.id).catch((err) => {
    console.error('[handleQOTDAnswer] updateStreak error:', err);
    return undefined;
  });

  await ctx.reply(
    `📅 <b>Question of the Day: Result</b>\n\n${correctAnswer(q, option)}`,
    {
      parse_mode: 'HTML',
      reply_markup: qotdResultKeyboard(q.id, q.question_text.includes('*')),
    }
  );

  const streakResult = await streakPromise;
  if (streakResult?.isFirstToday) {
    const weekActivity = await db.getWeeklyActivity(user.id);
    await ctx.reply(formatStreakCard(streakResult.streak, weekActivity), { parse_mode: 'HTML' });
  }
}
