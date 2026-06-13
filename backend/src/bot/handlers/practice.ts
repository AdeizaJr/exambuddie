// src/bot/handlers/practice.ts
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import * as timerService from '../../services/timer';
import { User, Question } from '../../types';

async function requireProfile(ctx: any): Promise<User | null> {
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) {
    await ctx.reply('Please set up your profile first using /start');
    return null;
  }
  return user;
}

async function checkSubjectLimit(ctx: any, user: User, subject: string): Promise<boolean> {
  if (user.plan === 'premium') return true;
  const usage = await redis.getSubjectUsage(ctx.from.id, subject);
  if (usage.count >= fmt.SUBJECT_Q_LIMIT) {
    const msLeft = usage.expiresAt - Date.now();
    await ctx.reply(
      fmt.subjectLimitMessage(fmt.SUBJECT_MAP[subject] || subject, msLeft),
      { parse_mode: 'HTML', reply_markup: fmt.subjectLimitKeyboard(subject, user.plan) }
    );
    return false;
  }
  return true;
}

async function sendQuestion(ctx: any, question: Question, session: { qNum: number; total?: number | string; mode: string; questionTimerSecs?: number }): Promise<void> {
  const timerSecs = session.questionTimerSecs || 0;
  const baseText = fmt.formatQuestion(question, session.qNum, session.total || '?', session.mode)
    + fmt.answerOptions(question);
  const timerLine = (secs: number) => `\n\n⏱️ <i>${secs}s remaining</i>`;
  const hasOptionE = !!question.option_e;
  const keyboard = fmt.answerKeyboard(hasOptionE);

  const sentMsg = await ctx.reply(
    baseText + (timerSecs > 0 ? timerLine(timerSecs) : ''),
    { parse_mode: 'HTML', reply_markup: keyboard },
  );

  if (timerSecs > 0) {
    const deadline = Date.now() + timerSecs * 1000;
    await redis.updateSession(ctx.from.id, { questionDeadline: deadline });

    const telegramId = ctx.from.id;
    const chatId = ctx.chat.id;
    const messageId = sentMsg.message_id;
    const telegram = ctx.telegram;

    timerService.setQuestionTimer(
      telegramId,
      timerSecs,
      (secsLeft) => {
        telegram.editMessageText(chatId, messageId, undefined, baseText + timerLine(secsLeft), {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }).catch(() => {});
      },
      async () => {
        const sess = await redis.getSession(telegramId);
        if (!sess?.questionDeadline || sess.questionDeadline !== deadline) return;

        const q = sess.currentQuestion;
        await redis.updateSession(telegramId, {
          questionDeadline: undefined,
          awaitingNext: true,
          total: (sess.total || 0) + 1,
        });

        const explanation = q?.explanation ? `\n\n💡 ${q.explanation}` : '';
        await telegram.sendMessage(telegramId,
          `⏱️ <b>Time's up!</b>\n\nThe correct answer was <b>${q?.correct_option}</b>.${explanation}`,
          { parse_mode: 'HTML', reply_markup: fmt.afterAnswerKeyboard(sess.mode) },
        );
      },
    );
  }
}

export async function handlePractice(ctx: any): Promise<void> {
  const user = await requireProfile(ctx);
  if (!user) return;

  if (user.plan === 'premium') {
    const allSubjects = Object.keys(fmt.SUBJECT_MAP);
    await redis.setSession(ctx.from.id, { step: 'picking_multisubject', selectedSubjects: [...user.subjects] });
    await ctx.reply(
      '📚 <b>Practice Mode</b>\n\nSelect any subjects to practise (your profile subjects are pre-selected):',
      { parse_mode: 'HTML', reply_markup: fmt.practiceMultiSubjectKeyboard(allSubjects, [...user.subjects]) }
    );
  } else {
    await ctx.reply(
      '📚 <b>Practice Mode</b>\n\nWhich subject would you like to practise?',
      { parse_mode: 'HTML', reply_markup: fmt.practiceSubjectKeyboard(user.subjects) }
    );
  }
}

export async function handleMultiSubjectToggle(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const subject = ctx.callbackQuery.data.split(':')[3];
  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  const session = await redis.getSession(ctx.from.id);
  let selected: string[] = session?.selectedSubjects || [...user.subjects];

  if (selected.includes(subject)) {
    selected = selected.filter(s => s !== subject);
  } else {
    selected = [...selected, subject];
  }

  await redis.updateSession(ctx.from.id, { selectedSubjects: selected });
  try {
    await ctx.editMessageReplyMarkup(fmt.practiceMultiSubjectKeyboard(Object.keys(fmt.SUBJECT_MAP), selected));
  } catch {
    // ignore "message is not modified" and similar transient errors
  }
}

export async function handleMultiSubjectStart(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const session = await redis.getSession(ctx.from.id);

  const selected: string[] = session?.selectedSubjects || [];
  if (selected.length === 0) {
    await ctx.answerCbQuery('Select at least one subject first!', { show_alert: true });
    return;
  }

  if (selected.length === 1) {
    const user = await db.getUser(ctx.from.id);
    if (!user) return;
    await startPractice(ctx, user, selected[0]);
    return;
  }

  await ctx.reply(
    '📚 <b>Which subject would you like to practise?</b>',
    { parse_mode: 'HTML', reply_markup: fmt.practiceSubjectKeyboard(selected) }
  );
}

// Subject tapped from the subject picker
export async function handleSubjectPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const subject = ctx.callbackQuery.data.split(':')[2];
  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  // Premium: year=undefined triggers the year picker step inside startPractice
  // Free: use saved target_year directly (no extra steps)
  const year = user.plan === 'premium' ? undefined : (user.target_year ?? null);
  await startPractice(ctx, user, subject, year);
}

// Explicit year picker — only reached from "Change Year" on the session summary
export async function handleYearPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const subject = ctx.callbackQuery.data.split(':')[2];
  const subjectName = fmt.SUBJECT_MAP[subject] || subject;
  await ctx.reply(
    `📅 <b>${subjectName}</b>\n\nWhich year would you like to practise?`,
    { parse_mode: 'HTML', reply_markup: fmt.yearPickerKeyboard(subject) }
  );
}

export async function startPractice(ctx: any, user: User | null, subject: string, year?: number | null, questionTimerSecs?: number, sessionExamType?: string, topic?: string | null, practiceSubjects?: string[]): Promise<void> {
  if (!user) user = await requireProfile(ctx);
  if (!user) return;

  // Use saved profile values as defaults — no re-selection needed
  if (year === undefined) year = user.target_year ?? null;
  if (sessionExamType === undefined) sessionExamType = user.exam_type || '';
  if (questionTimerSecs === undefined) questionTimerSecs = 0;

  // Step 2 (all users): pick topic if any exist and none chosen yet
  const examType = sessionExamType || user.exam_type || '';
  if (topic === undefined) {
    const topics = await db.getTopicsForSubject(examType, subject);
    if (topics.length > 0) {
      await redis.updateSession(ctx.from.id, {
        pendingSubject: subject,
        pendingYear: year ?? null,
        pendingExamType: sessionExamType,
        pendingMode: 'practice',
        pendingTimerSecs: questionTimerSecs ?? 0,
      });
      await ctx.reply(
        '🎯 <b>Which topic would you like to practise?</b>',
        { parse_mode: 'HTML', reply_markup: fmt.topicKeyboard(topics) }
      );
      return;
    }
    topic = null; // no topics available — skip filter
  }

  if (!(await checkSubjectLimit(ctx, user, subject))) return;

  // For non-premium, year may be undefined here — fall back to their saved target_year
  const effectiveYear = year !== undefined ? year : (user.target_year ?? null);
  const effectiveTopic = topic === '__all__' ? null : topic;
  const q = await db.getRandomQuestion(examType, subject, [], effectiveYear, effectiveTopic);
  if (!q) {
    const availability = await db.getSubjectAvailability(subject);
    const subjectName = fmt.SUBJECT_MAP[subject] || subject;
    const examStr = examType && !['ALL', 'BOTH'].includes(examType) ? ` under ${examType}` : '';
    const topicStr = effectiveTopic ? ` on topic "<b>${effectiveTopic}</b>"` : '';
    if (availability.length === 0) {
      await ctx.reply(`No questions available for ${subjectName}. Please pick another subject.`, {
        reply_markup: { inline_keyboard: [[{ text: '📚 Pick Another Subject', callback_data: 'practice:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
      });
    } else {
      await ctx.reply(
        `No questions found for <b>${subjectName}</b>${topicStr}${examStr}.\n\nAvailable options for ${subjectName}:`,
        { parse_mode: 'HTML', reply_markup: fmt.subjectAvailabilityKeyboard(subject, availability, 'practice') }
      );
    }
    return;
  }

  const timerSecs = questionTimerSecs ?? 0;
  const sessionId = uuidv4();

  // Carry cumulative stats from previous subjects in this session
  const existing = await redis.getSession(ctx.from.id);
  const carry = existing?.sessionCarry ?? null;

  // Multi-subject: preserve the full subjects list; single-subject: just this subject
  const effectivePracticeSubjects = practiceSubjects && practiceSubjects.length > 1 ? practiceSubjects : undefined;

  await redis.setSession(ctx.from.id, {
    mode: 'practice',
    subject,
    practiceSubjects: effectivePracticeSubjects,
    examType,
    year: effectiveYear,
    topic: effectiveTopic,
    sessionId,
    qNum: 1,
    correct: 0,
    total: 0,
    currentQuestion: q,
    startTime: Date.now(),
    sessionStartTime: carry?.sessionStartTime ?? Date.now(),
    cumulativeCorrect: carry?.cumulativeCorrect ?? 0,
    cumulativeTotal: carry?.cumulativeTotal ?? 0,
    sessionSubjects: carry ? [...carry.sessionSubjects, subject] : [subject],
    usedIds: [q.id],
    questionTimerSecs: timerSecs,
  });

  await sendQuestion(ctx, q, { mode: 'practice', qNum: 1, questionTimerSecs: timerSecs });
}

export async function handlePracticeTopicPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const topic = ctx.callbackQuery.data.split(':').slice(2).join(':'); // preserve colons in topic name
  const session = await redis.getSession(ctx.from.id);
  // pendingSubject set during setup flow; fall back to active session subject when tapping old topic keyboard
  const subject = session?.pendingSubject ?? session?.subject;
  if (!subject) {
    await ctx.reply('Session expired.', {
      reply_markup: { inline_keyboard: [[{ text: '📚 Pick a Subject', callback_data: 'practice:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
    return;
  }
  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  await startPractice(
    ctx, user,
    subject,
    session?.pendingYear ?? session?.year ?? null,
    session?.pendingTimerSecs ?? session?.questionTimerSecs ?? 0,
    session?.pendingExamType ?? session?.examType,
    topic,
  );
}

export async function handlePracticeAvail(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  // practice:avail:<subject>:<examType>:<year>
  const parts = ctx.callbackQuery.data.split(':');
  const subject = parts[2];
  const examType = parts[3];
  const year = parts[4] && parts[4] !== 'any' ? parseInt(parts[4], 10) : null;
  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  await startPractice(ctx, user, subject, year, 0, examType, undefined);
}

// Step 0 callback — year selected in premium practice flow
export async function handlePracticeFlowYear(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const raw = ctx.callbackQuery.data.split(':')[2];
  const year = raw === 'any' ? null : parseInt(raw, 10);
  const session = await redis.getSession(ctx.from.id);
  if (!session?.pendingSubject) {
    await ctx.reply('Session expired.', {
      reply_markup: { inline_keyboard: [[{ text: '📚 Pick a Subject', callback_data: 'practice:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
    return;
  }
  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  await startPractice(ctx, user, session.pendingSubject, year, undefined, undefined);
}

export async function handlePracticeExamTypePick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const examType = ctx.callbackQuery.data.split(':')[2];
  const session = await redis.getSession(ctx.from.id);
  if (!session?.pendingSubject) {
    await ctx.reply('Session expired.', {
      reply_markup: { inline_keyboard: [[{ text: '📚 Pick a Subject', callback_data: 'practice:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
    return;
  }
  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  await startPractice(ctx, user, session.pendingSubject, session.pendingYear ?? null, undefined, examType);
}

export async function handlePracticeTimerPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const timerSecs = parseInt(ctx.callbackQuery.data.split(':')[2], 10);
  const session = await redis.getSession(ctx.from.id);
  if (!session?.pendingSubject) {
    await ctx.reply('Session expired.', {
      reply_markup: { inline_keyboard: [[{ text: '📚 Pick a Subject', callback_data: 'practice:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  await startPractice(ctx, user, session.pendingSubject, session.pendingYear ?? null, timerSecs, session.pendingExamType);
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

  // Timer already fired automatically — ignore late tap
  if (session.awaitingNext && !session.questionDeadline) return;

  // Cancel the per-question timer since user answered in time
  timerService.clearQuestionTimer(ctx.from.id);
  await redis.updateSession(ctx.from.id, { questionDeadline: undefined });

  const isCorrect = selected === q.correct_option;

  // Log attempt and update streak on first real answer of the day
  await db.logAttempt({
    userId: user.id,
    questionId: q.id,
    selectedOption: selected,
    isCorrect,
    sessionId: session.sessionId || '',
    timeTakenMs: Date.now() - (session.lastQuestionTime || session.startTime || Date.now()),
  });
  await db.updateStreak(ctx.from.id);

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
      { parse_mode: 'HTML' }
    );
  } catch { /* message already deleted or not modified */ }

  await ctx.reply(resultText, {
    parse_mode: 'HTML',
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
  if (!session) {
    await ctx.reply('Session expired.', {
      reply_markup: { inline_keyboard: [[{ text: '📚 Pick a Subject', callback_data: 'practice:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  // Check per-subject limit
  if (!(await checkSubjectLimit(ctx, user, session.subject || ''))) return;

  // If premium was revoked mid-session, cancel the per-question timer
  if (session.questionTimerSecs && user.plan !== 'premium') {
    timerService.clearQuestionTimer(ctx.from.id);
    await redis.updateSession(ctx.from.id, { questionTimerSecs: 0 });
    session.questionTimerSecs = 0;
    await ctx.reply('⚠️ <i>Your premium access has been revoked. The per-question timer has been removed.</i>', { parse_mode: 'HTML' });
  }

  let q = null;
  let pickedSubject = session.subject || '';

  if (session.practiceSubjects && session.practiceSubjects.length > 1) {
    // Multi-subject: try subjects in random order until one yields a question
    const shuffled = [...session.practiceSubjects].sort(() => Math.random() - 0.5);
    for (const subj of shuffled) {
      q = await db.getRandomQuestion(session.examType || user.exam_type || '', subj, session.usedIds || [], session.year, session.topic);
      if (q) { pickedSubject = subj; break; }
    }
  } else {
    q = await db.getRandomQuestion(session.examType || user.exam_type || '', session.subject || '', session.usedIds || [], session.year, session.topic);
  }

  if (!q) {
    const yearStr = session.year ? ` for ${session.year}` : '';
    const topicStr = session.topic ? ` on topic "${session.topic}"` : '';
    const subjectLabel = session.practiceSubjects && session.practiceSubjects.length > 1
      ? 'all selected subjects'
      : `this subject${yearStr}${topicStr}`;
    await ctx.reply(
      `🎉 You've gone through all available questions for ${subjectLabel}! Try another year or subject.`,
      { parse_mode: 'HTML', reply_markup: fmt.sessionKeyboard(session.subject || '', session.year) }
    );
    return;
  }

  const newQNum = (session.qNum || 1) + 1;
  await redis.updateSession(ctx.from.id, {
    qNum: newQNum,
    subject: pickedSubject,
    currentQuestion: q,
    lastQuestionTime: Date.now(),
    awaitingNext: false,
    usedIds: [...(session.usedIds || []), q.id],
  });

  if (user.plan !== 'premium') await db.incrementDailyCount(ctx.from.id);
  await sendQuestion(ctx, q, { mode: 'practice', qNum: newQNum, questionTimerSecs: session.questionTimerSecs });
}

// Stop session
export async function handleStop(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const session = await redis.getSession(ctx.from.id);
  if (!session) { await ctx.reply('No active session.'); return; }

  const totalCorrect = (session.cumulativeCorrect || 0) + (session.correct || 0);
  const totalTotal   = (session.cumulativeTotal   || 0) + (session.total   || 0);
  const durationSecs = Math.round((Date.now() - (session.sessionStartTime || session.startTime || Date.now())) / 1000);
  const subjects: string[] = session.practiceSubjects || session.sessionSubjects || [session.subject].filter(Boolean);

  const summary = fmt.sessionSummary({
    correct: totalCorrect,
    total: totalTotal,
    subjects,
    mode: session.mode || 'practice',
    durationSecs,
  });

  await redis.clearSession(ctx.from.id);
  await ctx.reply(summary, {
    parse_mode: 'HTML',
    reply_markup: fmt.sessionKeyboard(session.subject || '', session.year),
  });
}

// Switch to a different subject — preserves cumulative stats across subjects
export async function handleChangeSubject(ctx: any): Promise<void> {
  await ctx.answerCbQuery();

  const session = await redis.getSession(ctx.from.id);
  const carry = session ? {
    cumulativeCorrect: (session.cumulativeCorrect || 0) + (session.correct || 0),
    cumulativeTotal: (session.cumulativeTotal || 0) + (session.total || 0),
    sessionStartTime: session.sessionStartTime || session.startTime || Date.now(),
    sessionSubjects: [...(session.sessionSubjects || (session.subject ? [session.subject] : []))],
  } : null;

  // Store carry so startPractice can merge it into the new session
  await redis.setSession(ctx.from.id, { sessionCarry: carry });

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  if (user.subjects.length === 1) {
    await startPractice(ctx, user, user.subjects[0]);
    return;
  }

  await ctx.reply(
    '📚 <b>Change Subject</b>\n\nWhich subject would you like to switch to?',
    { parse_mode: 'HTML', reply_markup: fmt.practiceSubjectKeyboard(user.subjects) }
  );
}

// /drill command or auto-drill
export async function handleDrill(ctx: any, topicOverride?: string): Promise<void> {
  const user = await requireProfile(ctx);
  if (!user) return;
  // Get topic from command args or auto-detect weak topic
  const args = ctx.message?.text?.split(' ').slice(1).join(' ');
  const topic = topicOverride || args;

  const subject = user.subjects[0]; // default to first subject

  if (!topic) {
    await ctx.reply(
      `🎯 <b>Topic Drill</b>\n\nUsage: <code>/drill [topic]</code>\nExample: <code>/drill Algebra</code> or <code>/drill Cell Biology</code>\n\nOr tap below for your weakest topics:`,
      {
        parse_mode: 'HTML',
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
    await ctx.reply(`Sorry, no questions found for this topic. Please select another topic to continue.`, {
      reply_markup: { inline_keyboard: [[{ text: '📚 Pick Another Topic', callback_data: 'practice:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
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
    await ctx.reply(
      '📊 Not enough data yet to detect weak topics. Keep practising and I\'ll identify them for you!',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const buttons = weakTopics.map(t => ([{
    text: `🎯 ${t.topic} (${t.accuracy}% accuracy)`,
    callback_data: `drill:topic:${targetSubject}:${t.topic}`,
  }]));

  await ctx.reply(
    `⚠️ <b>Your Weakest Topics in ${targetSubject}:</b>\n\nPick one to drill:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }
  );
}

export async function handleDrillTopic(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const parts = ctx.callbackQuery.data.split(':');
  const topic = parts.slice(3).join(':');
  await handleDrill(ctx, topic);
}
