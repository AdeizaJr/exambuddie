import * as db from '../../db';
import { getRank } from '../formatter';

export interface Badge {
  code: string;
  name: string;
  emoji: string;
  desc: string;
  group: 'questions' | 'streaks' | 'quiz' | 'accuracy';
}

export const ALL_BADGES: Badge[] = [
  // Questions milestones
  { code: 'first_question',  name: 'First Step',     emoji: '🎯', desc: 'Answered your first question',      group: 'questions' },
  { code: 'questions_10',    name: 'Getting Started', emoji: '📚', desc: 'Answered 10 questions',             group: 'questions' },
  { code: 'questions_50',    name: 'On a Roll',       emoji: '📈', desc: 'Answered 50 questions',             group: 'questions' },
  { code: 'questions_100',   name: 'Century Club',    emoji: '💯', desc: 'Answered 100 questions',            group: 'questions' },
  { code: 'questions_500',   name: 'Power User',      emoji: '⚡', desc: 'Answered 500 questions',            group: 'questions' },
  { code: 'questions_1000',  name: 'Hustler',         emoji: '🌟', desc: 'Answered 1,000 questions',          group: 'questions' },
  { code: 'questions_2500',  name: 'Grinder',         emoji: '💪', desc: 'Answered 2,500 questions',          group: 'questions' },
  { code: 'questions_5000',  name: 'Odogwu',          emoji: '👑', desc: 'Answered 5,000 questions',          group: 'questions' },
  { code: 'questions_7500',  name: 'Legend',          emoji: '🏆', desc: 'Answered 7,500 questions',          group: 'questions' },

  // Streaks
  { code: 'streak_3',        name: 'Hat Trick',       emoji: '🔥', desc: '3-day practice streak',             group: 'streaks' },
  { code: 'streak_7',        name: 'Week Warrior',    emoji: '🔥', desc: '7-day practice streak',             group: 'streaks' },
  { code: 'streak_30',       name: 'Month Master',    emoji: '🏆', desc: '30-day practice streak',            group: 'streaks' },

  // Quiz & Exams
  { code: 'quiz_complete',   name: 'Quiz Finisher',   emoji: '📋', desc: 'Completed your first CBT quiz',     group: 'quiz' },
  { code: 'mock_exam',       name: 'Mock Master',     emoji: '🎓', desc: 'Completed a full mock exam',        group: 'quiz' },
  { code: 'perfect_quiz',    name: 'Flawless',        emoji: '✨', desc: '100% on a CBT quiz (10+ questions)', group: 'quiz' },
  { code: 'sr_complete',     name: 'Deep Reviewer',   emoji: '📖', desc: 'Completed a spaced repetition session', group: 'quiz' },

  // Accuracy
  { code: 'accuracy_80',     name: 'Sharp Mind',      emoji: '🧠', desc: '80%+ accuracy over 50+ questions', group: 'accuracy' },
];

const BADGE_MAP = new Map(ALL_BADGES.map(b => [b.code, b]));

const GROUP_LABELS: Record<string, string> = {
  questions: '📚 Questions',
  streaks:   '🔥 Streaks',
  quiz:      '📋 Quiz & Exams',
  accuracy:  '🧠 Accuracy',
};

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
    if (context.totalAttempts >= 2500) toCheck.push('questions_2500');
    if (context.totalAttempts >= 5000) toCheck.push('questions_5000');
    if (context.totalAttempts >= 7500) toCheck.push('questions_7500');
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

  const groups = ['questions', 'streaks', 'quiz', 'accuracy'] as const;
  const sections = groups.map(group => {
    const badges = ALL_BADGES.filter(b => b.group === group);
    const lines = badges.map(b =>
      unlocked.has(b.code)
        ? `  ${b.emoji} <b>${b.name}</b> — <i>${b.desc}</i>`
        : `  🔒 <b>${b.name}</b> — <i>${b.desc}</i>`
    );
    return `<b>${GROUP_LABELS[group]}</b>\n${lines.join('\n')}`;
  });

  await ctx.reply(
    `🏅 <b>Achievements</b>\n\n${unlocked.size}/${ALL_BADGES.length} unlocked\n\n${sections.join('\n\n')}`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    }
  );
}

const RANK_UP_MESSAGES: Record<string, string> = {
  'Hustler I':    "You're grinding now. Keep it up! 💪",
  'Grinder I':    "You're in the top half — serious student energy. 🔥",
  'Sharp Guy I':  "Sharp Guy tier. You're outpacing most students. ⚡",
  'Odogwu I':     "Odogwu! You've answered more questions than 90% of users. 👑",
  'Legend I':     "LEGEND. You've reached the highest tier. Hall of fame. 🏆",
};

export async function checkRankUp(
  telegram: any,
  telegramId: number,
  prevTotal: number,
  newTotal: number
): Promise<void> {
  const prevRank = getRank(Math.max(0, prevTotal));
  const newRank = getRank(newTotal);
  if (prevRank.label === newRank.label) return;

  const extra = RANK_UP_MESSAGES[newRank.label] ?? '';
  await telegram.sendMessage(
    telegramId,
    `🎉 <b>Rank Up!</b>\n\nYou're now <b>${newRank.label}</b>!\n${extra}\n\n<i>Check your rank anytime with /stats</i>`,
    { parse_mode: 'HTML' }
  ).catch(() => {});
}
