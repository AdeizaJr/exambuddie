// src/bot/handlers/spaced_repetition.ts — Dedicated spaced repetition review mode
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import * as achievements from './achievements';

export async function handleSRMenu(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }
  if (user.plan !== 'premium') {
    await ctx.reply(fmt.upgradeMessage(), { parse_mode: 'HTML', reply_markup: fmt.subscribeKeyboard() });
    return;
  }

  const [due, total] = await Promise.all([
    db.getSRDueCount(user.id),
    db.getSRTotalCount(user.id),
  ]);

  if (total === 0) {
    await ctx.reply(
      '📖 <b>Review Deck</b>\n\nYour deck is empty! Answer questions in Practice or CBT — wrong answers automatically get added here for spaced review.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📚 Start Practising', callback_data: 'practice:pick' }],
            [{ text: '📋 Take a Quiz', callback_data: 'quiz:pick' }],
          ],
        },
      }
    );
    return;
  }

  if (due === 0) {
    await ctx.reply(
      `📖 <b>Review Deck</b>\n\n✅ All caught up! <b>${total}</b> card${total > 1 ? 's' : ''} in your deck — none due right now.\n\nCheck back later as cards become due.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📚 Practice Instead', callback_data: 'practice:pick' }],
          ],
        },
      }
    );
    return;
  }

  await ctx.reply(
    `📖 <b>Review Deck</b>\n\n<b>${due}</b> card${due > 1 ? 's' : ''} due for review (${total} total in deck).\n\nCards you answer correctly get pushed further into the future. Wrong answers come back tomorrow.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `▶️ Start Review (${due} cards)`, callback_data: 'sr:start' }],
          [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

export async function handleSRStart(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  const cards = await db.getSRCards(user.id, 20);
  if (!cards.length) {
    await ctx.reply('No cards due right now! Check back later.');
    return;
  }

  const sessionId = uuidv4();
  await redis.setSession(ctx.from.id, {
    mode: 'sr_review',
    sessionId,
    srCards: cards,
    srIndex: 0,
    correct: 0,
    total: cards.length,
    currentQuestion: cards[0],
    startTime: Date.now(),
  });

  await sendSRCard(ctx, cards[0], 1, cards.length);
}

async function sendSRCard(ctx: any, q: any, num: number, total: number): Promise<void> {
  const text = fmt.formatQuestion(q, num, total, 'sr_review') + fmt.answerOptions(q);
  const keyboard = fmt.answerKeyboard(!!q.option_e);
  const imageUrl = q.image_url?.startsWith('/')
    ? `${process.env.APP_URL || ''}${q.image_url}`
    : q.image_url;

  try {
    if (imageUrl) {
      await ctx.replyWithPhoto(imageUrl, { caption: text, parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }
}

export async function handleSRAnswer(ctx: any, selected: string): Promise<void> {
  const session = await redis.getSession(ctx.from.id);
  if (!session || session.mode !== 'sr_review') return;

  const q = session.currentQuestion;
  if (!q) return;

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  const isCorrect = selected === q.correct_option;

  // Update SR interval and log attempt
  await Promise.all([
    db.updateSRCard(user.id, q.id, isCorrect),
    db.logAttempt({
      userId: user.id,
      questionId: q.id,
      selectedOption: selected,
      isCorrect,
      sessionId: session.sessionId,
    }),
  ]);

  const newCorrect = session.correct + (isCorrect ? 1 : 0);
  const nextIndex = session.srIndex + 1;

  await redis.updateSession(ctx.from.id, { correct: newCorrect, srIndex: nextIndex });

  await ctx.reply(fmt.correctAnswer(q, selected), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        nextIndex < session.total
          ? [{ text: '➡️ Next Card', callback_data: 'sr:next' }]
          : [{ text: '✅ Finish Review', callback_data: 'sr:done' }],
      ],
    },
  });
}

export async function handleSRNext(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const session = await redis.getSession(ctx.from.id);
  if (!session || session.mode !== 'sr_review') return;

  const nextIndex = session.srIndex;
  const q = session.srCards[nextIndex];
  if (!q) {
    await handleSRDone(ctx);
    return;
  }

  await redis.updateSession(ctx.from.id, { currentQuestion: q });
  await sendSRCard(ctx, q, nextIndex + 1, session.total);
}

export async function handleSRDone(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const session = await redis.getSession(ctx.from.id);
  if (!session) return;

  const correct = session.correct ?? 0;
  const total = session.total ?? 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  await redis.clearSession(ctx.from.id);

  const user = await db.getUser(ctx.from.id);
  if (user) {
    achievements.checkAndGrantBadges(ctx.telegram, user.id, ctx.from.id, { srDone: true }).catch(() => {});
  }

  const grade =
    accuracy >= 80 ? '🏆 Excellent retention!' :
    accuracy >= 60 ? '🌟 Good progress!' :
    '💪 Keep reviewing — repetition is key!';

  await ctx.reply(
    `📖 <b>Review Complete!</b>\n\n${grade}\n\n✅ Correct: ${correct}/${total}\n🎯 Accuracy: ${accuracy}%\n\nWrong answers will reappear tomorrow. Correct ones are pushed further out.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Review Again', callback_data: 'sr:start' }],
          [{ text: '📚 Practice', callback_data: 'practice:pick' }],
          [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}
