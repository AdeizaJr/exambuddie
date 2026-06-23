// src/bot/handlers/revision.ts
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import { User, Question } from '../../types';

// Sends a question for revision/bookmark sessions — avoids circular import from practice.ts
async function sendRevisionQuestion(
  ctx: any,
  question: Question,
  qNum: number,
  total: number,
  mode: string
): Promise<void> {
  const baseText = fmt.formatQuestion(question, qNum, total, mode) + fmt.answerOptions(question);
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

export async function startRevisionSession(ctx: any, user: User, questions: Question[]): Promise<void> {
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
    `🔄 <b>Revision Mode</b> — ${questions.length} mistake${questions.length === 1 ? '' : 's'} to review\n\nLet's go! Answer each question again to clear it.`,
    { parse_mode: 'HTML' }
  );
  await sendRevisionQuestion(ctx, questions[0], 1, questions.length, 'revision');
}

export async function handleRevision(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) {
    await ctx.reply('Please set up your profile first using /start');
    return;
  }

  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const questions = await db.getRevisionQuestions(user.id, user.subjects, user.exam_type);

  if (questions.length === 0) {
    await ctx.reply(
      `🎉 <b>Nothing to revise!</b>\n\nNo mistakes to revise yet! Keep practising and wrong answers will appear here.`,
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

  // Store questions in session temporarily so revision:start can use them
  await redis.setSession(ctx.from.id, { pendingRevisionQuestions: questions });

  await ctx.reply(
    `🔄 <b>Revision Mode</b>\n\nYou have <b>${questions.length}</b> question${questions.length === 1 ? '' : 's'} from recent wrong answers ready to review.\n\nRevising mistakes is the fastest way to improve!`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Start Revision', callback_data: 'revision:start' }],
          [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

export async function handleRevisionStart(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  const session = await redis.getSession(ctx.from.id);
  const questions: Question[] = session?.pendingRevisionQuestions || [];

  if (questions.length === 0) {
    // Fallback: re-fetch
    const fetched = await db.getRevisionQuestions(user.id, user.subjects, user.exam_type);
    if (fetched.length === 0) {
      await ctx.reply('No mistakes found. Keep practising!', {
        reply_markup: { inline_keyboard: [[{ text: '📚 Practice', callback_data: 'practice:pick' }]] },
      });
      return;
    }
    return startRevisionSession(ctx, user, fetched);
  }

  return startRevisionSession(ctx, user, questions);
}

// Called from handleNext in practice.ts when session.revisionPool exists
export async function getNextRevisionQuestion(
  revisionQuestions: Question[],
  revisionIndex: number
): Promise<{ question: Question; index: number } | null> {
  const nextIndex = revisionIndex + 1;
  if (nextIndex >= revisionQuestions.length) return null;
  return { question: revisionQuestions[nextIndex], index: nextIndex };
}
