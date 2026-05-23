// src/bot/handlers/practice.ts
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import { User, Question } from '../../types';

async function requireProfile(ctx: any): Promise<User | null> {
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) {
    await ctx.reply('Please set up your profile first using /start');
    return null;
  }
  return user;
}

async function checkLimit(ctx: any, user: User): Promise<boolean> {
  const check = await db.checkDailyLimit(user);
  if (!check.allowed) {
    const msg = fmt.freeLimitMessage(0, check.limit);
    if (msg) {
      await ctx.replyWithMarkdown(msg, {
        reply_markup: fmt.subscribeKeyboard(),
        disable_web_page_preview: true,
      });
    }
    return false;
  }
  return true;
}

async function checkSubjectLimit(ctx: any, user: User, subject: string): Promise<boolean> {
  if (user.plan === 'premium') return true;
  const usage = await redis.getSubjectUsage(ctx.from.id, subject);
  if (usage.count >= fmt.SUBJECT_Q_LIMIT) {
    const msLeft = usage.expiresAt - Date.now();
    await ctx.replyWithMarkdown(
      fmt.subjectLimitMessage(fmt.SUBJECT_MAP[subject] || subject, msLeft),
      { reply_markup: fmt.subjectLimitKeyboard(subject) }
    );
    return false;
  }
  return true;
}

async function sendQuestion(ctx: any, question: Question, session: { qNum: number; total?: number | string; mode: string }): Promise<void> {
  const text = fmt.formatQuestion(question, session.qNum, session.total || '?', session.mode)
    + fmt.answerOptions(question);

  await ctx.replyWithMarkdown(text, {
    reply_markup: fmt.answerKeyboard(!!question.option_e),
  });
}

export async function handlePractice(ctx: any): Promise<void> {
  const user = await requireProfile(ctx);
  if (!user) return;

  await ctx.replyWithMarkdown(
    '📚 *Practice Mode*\n\nWhich subject would you like to practise?',
    { reply_markup: fmt.practiceSubjectKeyboard(user.subjects) }
  );
}

export async function handleYearPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const subject = ctx.callbackQuery.data.split(':')[2];
  const subjectName = fmt.SUBJECT_MAP[subject] || subject;
  await ctx.replyWithMarkdown(
    `📅 *${subjectName}*\n\nWhich year would you like to practise?`,
    { reply_markup: fmt.yearPickerKeyboard(subject) }
  );
}

export async function startPractice(ctx: any, user: User | null, subject: string, year?: number | null): Promise<void> {
  if (!user) user = await requireProfile(ctx);
  if (!user) return;
  if (!(await checkLimit(ctx, user))) return;
  if (!(await checkSubjectLimit(ctx, user, subject))) return;

  const q = await db.getRandomQuestion(user.exam_type || '', subject, [], year);
  if (!q) {
    const yearStr = year ? ` for ${year}` : '';
    await ctx.reply(`No questions found for ${subject}${yearStr}. Try a different year or subject!`);
    return;
  }

  const sessionId = uuidv4();
  await redis.setSession(ctx.from.id, {
    mode: 'practice',
    subject,
    year: year || null,
    sessionId,
    qNum: 1,
    correct: 0,
    total: 0,
    currentQuestion: q,
    startTime: Date.now(),
    usedIds: [q.id],
  });

  await db.updateStreak(ctx.from.id);
  await sendQuestion(ctx, q, { mode: 'practice', qNum: 1 });
}

// Handles answer:A/B/C/D callback
export async function handleAnswer(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const selected = ctx.callbackQuery.data.split(':')[1];
  const session = await redis.getSession(ctx.from.id);

  if (!session || !session.currentQuestion) {
    await ctx.reply('No active session. Use /practice to start.');
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  const q = session.currentQuestion;
  const isCorrect = selected === q.correct_option;

  // Log attempt
  await db.logAttempt({
    userId: user.id,
    questionId: q.id,
    selectedOption: selected,
    isCorrect,
    sessionId: session.sessionId || '',
    timeTakenMs: Date.now() - (session.lastQuestionTime || session.startTime || Date.now()),
  });

  // Update daily count and per-subject usage (free users)
  if (user.plan !== 'premium') {
    await db.incrementDailyCount(ctx.from.id);
    await redis.incrementSubjectUsage(ctx.from.id, session.subject || '');
  }

  const newTotal = (session.total || 0) + 1;
  const newCorrect = (session.correct || 0) + (isCorrect ? 1 : 0);

  // Show result — edit message to remove answer buttons
  const resultText = fmt.correctAnswer(q, selected);

  try {
    await ctx.editMessageText(
      fmt.formatQuestion(q, session.qNum || 1, session.total || '?', session.mode)
      + fmt.answerOptions(q),
      { parse_mode: 'Markdown' }
    );
  } catch (_) {}

  await ctx.replyWithMarkdown(resultText, {
    reply_markup: fmt.afterAnswerKeyboard(session.mode),
  });

  // Update session
  await redis.updateSession(ctx.from.id, {
    total: newTotal,
    correct: newCorrect,
    lastAnswer: selected,
    lastQuestionTime: Date.now(),
    awaitingNext: true,
  });
}

// Next question in practice
export async function handleNext(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const session = await redis.getSession(ctx.from.id);
  if (!session) { await ctx.reply('Session expired. Use /practice to start again.'); return; }

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  // Check daily and per-subject limits
  if (!(await checkLimit(ctx, user))) return;
  if (!(await checkSubjectLimit(ctx, user, session.subject || ''))) return;

  const q = await db.getRandomQuestion(user.exam_type || '', session.subject || '', session.usedIds || [], session.year);
  if (!q) {
    const yearStr = session.year ? ` for ${session.year}` : '';
    await ctx.replyWithMarkdown(
      `🎉 You've gone through all available questions for this subject${yearStr}! Try another year or subject.`,
      { reply_markup: fmt.sessionKeyboard(session.subject || '', session.year) }
    );
    return;
  }

  const newQNum = (session.qNum || 1) + 1;
  await redis.updateSession(ctx.from.id, {
    qNum: newQNum,
    currentQuestion: q,
    lastQuestionTime: Date.now(),
    awaitingNext: false,
    usedIds: [...(session.usedIds || []), q.id],
  });

  if (user.plan !== 'premium') await db.incrementDailyCount(ctx.from.id);
  await sendQuestion(ctx, q, { mode: 'practice', qNum: newQNum });
}

// Stop session
export async function handleStop(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const session = await redis.getSession(ctx.from.id);
  if (!session) { await ctx.reply('No active session.'); return; }

  const durationSecs = Math.round((Date.now() - (session.startTime || Date.now())) / 1000);
  const summary = fmt.sessionSummary({
    correct: session.correct || 0,
    total: session.total || 0,
    subject: session.subject || '',
    mode: session.mode || 'practice',
    durationSecs,
  });

  await redis.clearSession(ctx.from.id);
  await ctx.replyWithMarkdown(summary, {
    reply_markup: fmt.sessionKeyboard(session.subject || '', session.year),
  });
}

// Switch to a different subject — clears current session and shows subject picker
export async function handleChangeSubject(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  await redis.clearSession(ctx.from.id);

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  if (user.subjects.length === 1) {
    await startPractice(ctx, user, user.subjects[0]);
    return;
  }

  await ctx.replyWithMarkdown(
    '📚 *Change Subject*\n\nWhich subject would you like to switch to?',
    { reply_markup: fmt.practiceSubjectKeyboard(user.subjects) }
  );
}

// /drill command or auto-drill
export async function handleDrill(ctx: any, topicOverride?: string): Promise<void> {
  const user = await requireProfile(ctx);
  if (!user) return;
  if (!(await checkLimit(ctx, user))) return;

  // Get topic from command args or auto-detect weak topic
  const args = ctx.message?.text?.split(' ').slice(1).join(' ');
  const topic = topicOverride || args;

  const subject = user.subjects[0]; // default to first subject

  if (!topic) {
    await ctx.replyWithMarkdown(
      `🎯 *Topic Drill*\n\nUsage: \`/drill [topic]\`\nExample: \`/drill Algebra\` or \`/drill Cell Biology\`\n\nOr tap below for your weakest topics:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Auto-detect weak topics', callback_data: 'drill:auto:' + subject }],
            [{ text: '❌ Cancel', callback_data: 'menu:main' }],
          ],
        },
      }
    );
    return;
  }

  const questions = await db.getQuestionsByTopic(user.exam_type || '', subject, topic, 10);
  if (questions.length === 0) {
    await ctx.reply(`No questions found for topic "${topic}". Try a different topic or subject.`);
    return;
  }

  const sessionId = uuidv4();
  await redis.setSession(ctx.from.id, {
    mode: 'drill',
    subject,
    topic,
    sessionId,
    qNum: 1,
    total: questions.length,
    correct: 0,
    questions: questions.map(q => q.id),
    questionIndex: 0,
    currentQuestion: questions[0],
    startTime: Date.now(),
  });

  await sendQuestion(ctx, questions[0], { mode: 'drill', qNum: 1, total: questions.length });
}

export async function handleAutoDrill(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const parts = ctx.callbackQuery.data.split(':');
  const subject = parts[2] || null;
  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  const targetSubject = subject || user.subjects[0];
  const weakTopics = await db.getWeakTopics(user.id, targetSubject);
  if (weakTopics.length === 0) {
    await ctx.replyWithMarkdown(
      '📊 Not enough data yet to detect weak topics. Keep practising and I\'ll identify them for you!'
    );
    return;
  }

  const buttons = weakTopics.map(t => ([{
    text: `🎯 ${t.topic} (${t.accuracy}% accuracy)`,
    callback_data: `drill:topic:${targetSubject}:${t.topic}`,
  }]));

  await ctx.replyWithMarkdown(
    `⚠️ *Your Weakest Topics in ${targetSubject}:*\n\nPick one to drill:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

export async function handleDrillTopic(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const parts = ctx.callbackQuery.data.split(':');
  const subject = parts[2];
  const topic = parts.slice(3).join(':');
  await handleDrill(ctx, topic);
}
