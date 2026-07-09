// src/bot/handlers/bookmarks.ts
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import { Question } from '../../types';

async function sendBookmarkQuestion(
  ctx: any,
  question: Question,
  qNum: number,
  total: number
): Promise<void> {
  const baseText = fmt.formatQuestion(question, qNum, total, 'revision') + fmt.answerOptions(question);
  const keyboard = fmt.answerKeyboard(!!question.option_e);
  const imageUrl = question.image_url?.startsWith('/')
    ? `${process.env.APP_URL || ''}${question.image_url}`
    : question.image_url;

  try {
    if (imageUrl) {
      await ctx.replyWithPhoto(imageUrl, { caption: baseText, parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(baseText, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch {
    await ctx.reply(baseText, { parse_mode: 'HTML', reply_markup: keyboard });
  }
}

export async function handleBookmarkToggle(ctx: any): Promise<void> {
  const parts = ctx.callbackQuery.data.split(':');
  const questionId = parseInt(parts[2], 10);

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  const already = await db.isBookmarked(user.id, questionId);
  if (already) {
    await db.removeBookmark(user.id, questionId);
    await ctx.answerCbQuery('Removed from bookmarks', { show_alert: false });
  } else {
    await db.addBookmark(user.id, questionId);
    await ctx.answerCbQuery('⭐ Saved to bookmarks!', { show_alert: false });
  }
}

export async function handleBookmarks(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const count = await db.getBookmarkCount(user.id);

  if (count === 0) {
    await ctx.reply(
      `⭐ <b>Saved Questions</b>\n\nNo saved questions yet. Press ⭐ after answering any question to save it!\n\nBookmarks let you build your own revision list from questions you found useful.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📚 Practice', callback_data: 'practice:pick' }],
            [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
          ],
        },
      }
    );
    return;
  }

  await ctx.reply(
    `⭐ <b>Saved Questions</b>\n\nYou have <b>${count}</b> saved question${count === 1 ? '' : 's'}.\n\nWhat would you like to do?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📚 Practice Bookmarks', callback_data: 'bookmark:practice' }],
          [{ text: '🗑 Clear All Bookmarks', callback_data: 'bookmark:clear' }],
          [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

export async function handleBookmarkPractice(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  const questions = await db.getUserBookmarks(user.id);
  if (questions.length === 0) {
    await ctx.reply('No bookmarks found. Save questions with ⭐ after answering!', {
      reply_markup: { inline_keyboard: [[{ text: '📚 Practice', callback_data: 'practice:pick' }]] },
    });
    return;
  }

  const sessionId = uuidv4();
  await redis.setSession(ctx.from.id, {
    mode: 'revision',
    subject: questions[0]?.subject || (user.subjects[0] ?? ''),
    examType: user.exam_type || '',
    sessionId,
    qNum: 1,
    correct: 0,
    total: 0,
    currentQuestion: questions[0],
    startTime: Date.now(),
    usedIds: [questions[0].id],
    revisionPool: questions.map(q => q.id),
    revisionQuestions: questions,
    revisionIndex: 0,
  });

  await ctx.reply(
    `📚 <b>Bookmark Practice</b> — ${questions.length} saved question${questions.length === 1 ? '' : 's'}\n\nLet's go!`,
    { parse_mode: 'HTML' }
  );
  await sendBookmarkQuestion(ctx, questions[0], 1, questions.length);
}

export async function handleBookmarkClear(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  await db.clearBookmarks(user.id);
  await ctx.reply(
    '🗑 <b>Bookmarks Cleared</b>\n\nAll saved questions have been removed.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📚 Practice', callback_data: 'practice:pick' }],
          [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}
