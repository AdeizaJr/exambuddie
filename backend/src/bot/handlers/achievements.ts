import * as db from '../../db';

export interface Badge {
  code: string;
  name: string;
  emoji: string;
  desc: string;
}

export const ALL_BADGES: Badge[] = [
  { code: 'first_question',  name: 'First Step',     emoji: '🎯', desc: 'Answered your first question' },
  { code: 'questions_10',    name: 'Getting Started', emoji: '📚', desc: 'Answered 10 questions' },
  { code: 'questions_50',    name: 'On a Roll',       emoji: '📈', desc: 'Answered 50 questions' },
  { code: 'questions_100',   name: 'Century Club',    emoji: '💯', desc: 'Answered 100 questions' },
  { code: 'questions_500',   name: 'Power User',      emoji: '⚡', desc: 'Answered 500 questions' },
  { code: 'questions_1000',  name: 'Legend',          emoji: '🌟', desc: 'Answered 1,000 questions' },
  { code: 'streak_3',        name: 'Hat Trick',       emoji: '🔥', desc: '3-day practice streak' },
  { code: 'streak_7',        name: 'Week Warrior',    emoji: '🔥', desc: '7-day practice streak' },
  { code: 'streak_30',       name: 'Month Master',    emoji: '🏆', desc: '30-day practice streak' },
  { code: 'perfect_quiz',    name: 'Flawless',        emoji: '✨', desc: '100% on a CBT quiz (10+ questions)' },
  { code: 'quiz_complete',   name: 'Quiz Finisher',   emoji: '📋', desc: 'Completed your first CBT quiz' },
  { code: 'mock_exam',       name: 'Mock Master',     emoji: '🎓', desc: 'Completed a full mock exam' },
  { code: 'sr_complete',     name: 'Deep Reviewer',   emoji: '📖', desc: 'Completed a spaced repetition session' },
  { code: 'accuracy_80',     name: 'Sharp Mind',      emoji: '🧠', desc: '80%+ accuracy over 50+ questions' },
];

const BADGE_MAP = new Map(ALL_BADGES.map(b => [b.code, b]));

export async function checkAndGrantBadges(
  telegram: any,
  userId: number,
  telegramId: number,
  context: {
    totalAttempts?: number;
    streak?: number;
    quizScore?: { correct: number; total: number };
    accuracy?: number;
    srDone?: boolean;
    quizDone?: boolean;
    mockDone?: boolean;
  }
): Promise<void> {
  const toCheck: string[] = [];

  if (context.totalAttempts !== undefined) {
    if (context.totalAttempts >= 1)    toCheck.push('first_question');
    if (context.totalAttempts >= 10)   toCheck.push('questions_10');
    if (context.totalAttempts >= 50)   toCheck.push('questions_50');
    if (context.totalAttempts >= 100)  toCheck.push('questions_100');
    if (context.totalAttempts >= 500)  toCheck.push('questions_500');
    if (context.totalAttempts >= 1000) toCheck.push('questions_1000');
  }

  if (context.streak !== undefined) {
    if (context.streak >= 3)  toCheck.push('streak_3');
    if (context.streak >= 7)  toCheck.push('streak_7');
    if (context.streak >= 30) toCheck.push('streak_30');
  }

  if (context.quizDone) toCheck.push('quiz_complete');
  if (context.mockDone) { toCheck.push('quiz_complete'); toCheck.push('mock_exam'); }
  if (context.srDone)   toCheck.push('sr_complete');

  if (
    context.quizScore &&
    context.quizScore.total >= 10 &&
    context.quizScore.correct === context.quizScore.total
  ) {
    toCheck.push('perfect_quiz');
  }

  if (
    context.accuracy !== undefined &&
    context.accuracy >= 80 &&
    (context.totalAttempts ?? 0) >= 50
  ) {
    toCheck.push('accuracy_80');
  }

  for (const code of [...new Set(toCheck)]) {
    const isNew = await db.grantBadge(userId, code);
    if (!isNew) continue;
    const badge = BADGE_MAP.get(code);
    if (!badge) continue;
    await telegram.sendMessage(
      telegramId,
      `🏅 <b>Achievement Unlocked!</b>\n\n${badge.emoji} <b>${badge.name}</b>\n<i>${badge.desc}</i>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }
}

export async function handleBadges(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  const unlocked = new Set(await db.getUserBadgeCodes(user.id));

  const lines = ALL_BADGES.map(b =>
    unlocked.has(b.code)
      ? `${b.emoji} <b>${b.name}</b> — <i>${b.desc}</i>`
      : `🔒 <b>${b.name}</b> — <i>${b.desc}</i>`
  );

  await ctx.reply(
    `🏅 <b>Achievements</b>\n\n${unlocked.size}/${ALL_BADGES.length} unlocked\n\n${lines.join('\n')}`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    }
  );
}
