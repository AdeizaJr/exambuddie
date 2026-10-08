// src/bot/handlers/practice.ts
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import * as timerService from '../../services/timer';
import * as achievements from './achievements';
import { checkRankUp } from './achievements';
import { maybeAskPhone } from './phone';
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
      { parse_mode: 'HTML', reply_markup: fmt.subjectLimitKeyboard(user.plan) }
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
  const keyboard = (session.mode === 'practice' || session.mode === 'drill')
    ? fmt.practiceAnswerKeyboard(hasOptionE)
    : fmt.answerKeyboard(hasOptionE);

  const msgText = baseText + (timerSecs > 0 ? timerLine(timerSecs) : '');
  const imageUrl = question.image_url?.startsWith('/')
    ? `${process.env.APP_URL || ''}${question.image_url}`
    : question.image_url;
  let sentMsg;
  try {
    sentMsg = imageUrl
      ? await ctx.replyWithPhoto(imageUrl, { caption: msgText, parse_mode: 'HTML', reply_markup: keyboard })
      : await ctx.reply(msgText, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    // Dead image link or blocked user — fall back to text so the question still gets sent
    console.error(`[practice] failed to send question ${question.id} to ${ctx.from.id}:`, (err as Error).message);
    sentMsg = await ctx.reply(msgText, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  if (timerSecs > 0) {
    const deadline = Date.now() + timerSecs * 1000;
    await redis.updateSession(ctx.from.id, { questionDeadline: deadline });

    const telegramId = ctx.from.id;

    timerService.startDisplayTimer(
      telegramId,
      timerSecs,
      { telegram: ctx.telegram, chatId: ctx.chat.id, messageId: sentMsg.message_id, imageUrl, baseText, timerLine, keyboard },
      async () => {
        const sess = await redis.getSession(telegramId);
        if (!sess?.questionDeadline || sess.questionDeadline !== deadline) return;

        // handleAnswer holds this same lock while it scores/logs/writes the session for a
        // manual tap landing in the same instant the timer fires. Without contending for
        // it here too, both paths could pass the questionDeadline check above (read before
        // the other's write lands) and each overwrite fields the other just set — the user
        // could get both the "time's up" message and the manual result message, and either
        // one's session write could silently wipe the other's (e.g. a genuine correct
        // answer's score getting clobbered by the timer's awaitingNext/total write).
        if (!(await redis.acquireActionLock(telegramId, 'practice:answer'))) return;

        const q = sess.currentQuestion;
        await redis.updateSession(telegramId, {
          questionDeadline: undefined,
          awaitingNext: true,
          total: (sess.total || 0) + 1,
        });

        const explanation = q?.explanation ? `\n\n💡 ${fmt.formatExplanation(q.explanation, q?.subject)}` : '';
        await ctx.telegram.sendMessage(telegramId,
          `⏱️ <b>Time's up!</b>\n\nThe correct answer was <b>${q?.correct_option}</b>.${explanation}`,
          { parse_mode: 'HTML', reply_markup: fmt.afterAnswerKeyboard(sess.mode, q?.question_text?.includes('*') ?? false) },
        ).catch((err: any) => console.error(`[practice] timer expiry sendMessage failed for ${telegramId}:`, err.message));
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
    await redis.clearSession(ctx.from.id);
    const counts = await db.getSubjectQuestionCounts(user.subjects);
    await ctx.reply(
      '📚 <b>Practice Mode</b>\n\nWhich subject would you like to practise?',
      { parse_mode: 'HTML', reply_markup: fmt.practiceSubjectKeyboard(user.subjects, counts) }
    );
  }
}

export async function handleMultiSubjectToggle(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const subject = ctx.callbackQuery.data.split(':')[3];
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

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
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.answerCbQuery(); await ctx.reply('Something went wrong. Please try /start.'); return; }

  if (user.plan !== 'premium') {
    await ctx.answerCbQuery();
    await ctx.reply(
      `📚 <b>Multi-Subject Practice — Premium Feature</b>\n\nUpgrade to Premium to practise multiple subjects in one session!`,
      { parse_mode: 'HTML', reply_markup: fmt.subscribeKeyboard() }
    );
    return;
  }

  const session = await redis.getSession(ctx.from.id);

  const selected: string[] = session?.selectedSubjects || [];
  if (selected.length === 0) {
    await ctx.answerCbQuery('Select at least one subject first!', { show_alert: true });
    return;
  }
  await ctx.answerCbQuery();

  if (selected.length === 1) {
    await startPractice(ctx, user, selected[0]);
    return;
  }

  const counts = await db.getSubjectQuestionCounts(selected);
  await ctx.reply(
    '📚 <b>Which subject would you like to practise?</b>',
    { parse_mode: 'HTML', reply_markup: fmt.practiceSubjectKeyboard(selected, counts) }
  );
}

// Subject tapped from the subject picker — show year picker for all users
export async function handleSubjectPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const subject = ctx.callbackQuery.data.split(':')[2];
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  await redis.updateSession(ctx.from.id, { pendingSubject: subject });
  const subjectName = fmt.SUBJECT_MAP[subject] || subject;
  await ctx.reply(
    `📅 <b>${subjectName}</b>\n\nWhich year would you like to practise?`,
    { parse_mode: 'HTML', reply_markup: fmt.yearPickerKeyboard(subject) }
  );
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
    const topics = await db.getTopicsForSubject(examType, subject, year);
    if (topics.length > 0) {
      // Not scoped to `year`: diagram questions are unevenly spread across years (some
      // years have zero for a given exam type), so a year-scoped check made the button
      // vanish and reappear inconsistently as users switched years. Show it whenever the
      // subject has diagrams in any year; an empty year still falls through to the normal
      // "no questions found, try another year" message below.
      const hasDiagrams = await db.subjectHasDiagrams(examType, subject);
      await redis.updateSession(ctx.from.id, {
        pendingSubject: subject,
        pendingYear: year ?? null,
        pendingExamType: sessionExamType,
pendingTimerSecs: questionTimerSecs ?? 0,
      });
      await ctx.reply(
        '🎯 <b>Which topic would you like to practise?</b>',
        { parse_mode: 'HTML', reply_markup: fmt.topicKeyboard(topics, hasDiagrams) }
      );
      return;
    }
    topic = null; // no topics available — skip filter
  }

  if (!(await checkSubjectLimit(ctx, user, subject))) return;

  // For non-premium, year may be undefined here — fall back to their saved target_year
  const effectiveYear = year !== undefined ? year : (user.target_year ?? null);
  const diagramOnly = topic === '__diagram__';
  const effectiveTopic = (topic === '__all__' || topic === '__diagram__') ? null : topic;
  const q = await db.getRandomQuestion(examType, subject, [], effectiveYear, effectiveTopic, user.id, diagramOnly);
  if (!q) {
    const availability = await db.getSubjectAvailability(subject);
    const subjectName = fmt.SUBJECT_MAP[subject] || subject;
    const examStr = examType && !['ALL', 'BOTH'].includes(examType) ? ` under ${examType}` : '';
    const topicStr = diagramOnly ? ` with a diagram` : (effectiveTopic ? ` on topic "<b>${effectiveTopic}</b>"` : '');
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
    diagramOnly,
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
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
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
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
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
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
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
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
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
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  await startPractice(ctx, user, session.pendingSubject, session.pendingYear ?? null, timerSecs, session.pendingExamType);
}

// Handles answer:A/B/C/D callback
export async function handleAnswer(ctx: any): Promise<void> {
  const selected = ctx.callbackQuery.data.split(':')[1];

  // Parallel: session + user (user hits Redis cache on repeat calls)
  const [session, user] = await Promise.all([
    redis.getSession(ctx.from.id),
    db.getUser(ctx.from.id),
  ]);

  if (!session || !session.currentQuestion) {
    await ctx.answerCbQuery('No active session.', { show_alert: false });
    return;
  }
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  const q = session.currentQuestion;

  // Timer already fired automatically — ignore late tap
  if (session.awaitingNext && !session.questionDeadline) return;

  // Two taps (e.g. A then B) landing close enough that both read the session above
  // before either write below completes — without this, both would score, log an
  // attempt, and message the user. Same lock practice.ts's handleNext already uses.
  if (!(await redis.acquireActionLock(ctx.from.id, 'practice:answer'))) {
    await ctx.answerCbQuery();
    return;
  }

  ctx.answerCbQuery().catch(() => {}); // fire and forget — removes Telegram spinner immediately

  const isCorrect = selected === q.correct_option;
  const newConsecutive = isCorrect ? (session.consecutiveCorrect || 0) + 1 : 0;
  const hyped = fmt.consecutiveHype(newConsecutive);
  const newTotal = (session.total || 0) + 1;
  const newCorrect = (session.correct || 0) + (isCorrect ? 1 : 0);

  timerService.clearQuestionTimer(ctx.from.id);

  // Kick off all writes + slow reads in parallel — don't block the reply
  const streakPromise = db.updateStreak(ctx.from.id);

  const writesPromise = Promise.all([
    db.logAttempt({
      userId: user.id,
      questionId: q.id,
      selectedOption: selected,
      isCorrect,
      sessionId: session.sessionId || '',
      timeTakenMs: Date.now() - (session.lastQuestionTime || session.startTime || Date.now()),
    }),
    db.incrementDailyCount(ctx.from.id),
    user.plan !== 'premium' ? redis.incrementSubjectUsage(ctx.from.id, session.subject || '') : Promise.resolve(),
    redis.updateSession(ctx.from.id, {
      questionDeadline: undefined,
      total: newTotal,
      correct: newCorrect,
      consecutiveCorrect: newConsecutive,
      lastAnswer: selected,
      lastQuestionTime: Date.now(),
      awaitingNext: true,
    }),
  ]).catch((err) => console.error('[handleAnswer] persist error:', err));

  // Chained onto writesPromise, not fired independently — this was racing logAttempt's own
  // INSERT instead of running after it, so the count it read excluded the answer that was
  // just submitted. Milestone badges (e.g. "First Step" for the first question) fired one
  // question late as a result: the count on question N only reflected questions 1..N-1.
  const totalAttemptsPromise = writesPromise.then(() => db.getTotalAttempts(user.id));

  // Referral reward — already fire-and-forget
  db.checkAndGrantReferralReward(user.id).then(({ granted, referrer }) => {
    if (granted && referrer) {
      ctx.telegram.sendMessage(
        referrer.telegram_id,
        `🎁 <b>Referral Reward Unlocked!</b>\n\nTwo of your invited friends just started practising on ExamBuddie. You've earned <b>3 days Premium free</b>! 🎉\n\nKeep sharing — /invite`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
  }).catch(() => {});

  // ── REPLY — user sees this while DB writes are still in flight ──────────────
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
    reply_markup: fmt.afterAnswerKeyboard(session.mode, q.question_text.includes('*'), q.id, !!q.explanation),
  });

  // ── Follow-up messages — await the in-flight promises now ──────────────────
  const [streakResult, totalAttempts] = await Promise.all([streakPromise, totalAttemptsPromise]);
  const milestone = fmt.totalMilestone(totalAttempts);

  // Badge check (fire-and-forget)
  achievements.checkAndGrantBadges(ctx.telegram, user.id, ctx.from.id, {
    totalAttempts,
    streak: streakResult?.streak,
  }).catch(() => {});

  // Rank-up check — notify if user just crossed a rank threshold
  checkRankUp(ctx.telegram, ctx.from.id, totalAttempts - 1, totalAttempts).catch(() => {});

  if (!isCorrect) {
    db.addSRCard(user.id, q.id).catch(() => {});
    const totalWrong = await db.getTotalWrongAttempts(user.id);
    if (totalWrong === 1) {
      await ctx.reply(
        "💪 Don't let that stop you — getting it wrong is part of the process. Every question you attempt makes you sharper. Keep going!"
      );
    }
  }

  if (hyped) {
    if (newConsecutive === 10) await ctx.replyWithDice({ emoji: '🎲' });
    await ctx.reply(hyped);
  }
  if (milestone) {
    await ctx.replyWithDice({ emoji: '🎲' });
    await ctx.reply(milestone);
  }

  if (streakResult?.isFirstToday) {
    const weekActivity = await db.getWeeklyActivity(user.id);
    await ctx.reply(fmt.formatStreakCard(streakResult.streak, weekActivity), { parse_mode: 'HTML' });
  }

  // One-time phone nudge for users who haven't shared their number
  if (!user.phone_number && !(await redis.hasSeenPhoneNudge(ctx.from.id))) {
    await redis.markPhoneNudgeSent(ctx.from.id);
    await redis.setPhonePending(ctx.from.id);
    await ctx.reply(
      '📱 <b>Quick one!</b> Share your phone number so we can reach you about your subscription.\n\n<i>Optional — tap Skip if you prefer not to.</i>',
      {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '📱 Share Phone Number', request_contact: true }],
            [{ text: 'Skip for now →' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
  }
}

// Shared by handleNext and handleSkip — picks the next question for a practice
// session given its subject/topic/year/usedIds filters. Does not touch the
// session or reply; callers own persisting the result and messaging the user.
async function pickNextQuestion(ctx: any, session: any, user: User): Promise<{ q: Question | null; pickedSubject: string }> {
  let q: Question | null = null;
  let pickedSubject = session.subject || '';

  if (session.practiceSubjects && session.practiceSubjects.length > 1) {
    // Multi-subject: try subjects in random order until one yields a question, skipping any subject that's hit its daily limit
    const shuffled = [...session.practiceSubjects].sort(() => Math.random() - 0.5);
    for (const subj of shuffled) {
      if (user.plan !== 'premium') {
        const usage = await redis.getSubjectUsage(ctx.from.id, subj);
        if (usage.count >= fmt.SUBJECT_Q_LIMIT) continue;
      }
      q = await db.getRandomQuestion(session.examType || user.exam_type || '', subj, session.usedIds || [], session.year, session.topic, user.id, session.diagramOnly);
      if (q) { pickedSubject = subj; break; }
    }
    if (!q) {
      // Either no questions left or every subject is at its daily limit — report against current subject
      if (!(await checkSubjectLimit(ctx, user, session.subject || ''))) return { q: null, pickedSubject };
    }
  } else {
    if (!(await checkSubjectLimit(ctx, user, session.subject || ''))) return { q: null, pickedSubject };
    // Adaptive: when no explicit topic chosen, 60% probability drill a weak topic.
    // Skipped when diagram-only — a random weak topic isn't guaranteed to have diagram
    // questions, and would silently break the filter the user explicitly asked for.
    const requestedTopic = session.topic;
    let adaptiveTopic = requestedTopic;
    if (!adaptiveTopic && !session.diagramOnly) {
      const weak = await db.getWeakTopics(user.id, session.subject || '', session.examType || user.exam_type || '');
      if (weak.length > 0 && Math.random() < 0.6) {
        adaptiveTopic = weak[Math.floor(Math.random() * Math.min(3, weak.length))].topic;
      }
    }
    q = await db.getRandomQuestion(session.examType || user.exam_type || '', session.subject || '', session.usedIds || [], session.year, adaptiveTopic, user.id, session.diagramOnly);
    // The adaptive topic pick isn't scoped to the current year/topic filters (it comes from
    // the user's overall weak-topic history), so it can legitimately match zero rows within
    // this specific year even when plenty of other unseen questions remain there. Retry
    // without it before concluding the pool is exhausted — but only when it was an internal
    // adaptive guess, not a topic the user explicitly asked to drill.
    if (!q && adaptiveTopic && adaptiveTopic !== requestedTopic) {
      q = await db.getRandomQuestion(session.examType || user.exam_type || '', session.subject || '', session.usedIds || [], session.year, requestedTopic, user.id, session.diagramOnly);
    }
  }

  return { q, pickedSubject };
}

// Skip the current question without answering it — bookmarks it for later review
// and immediately advances, same as handleNext but with no attempt logged and no
// daily-limit/stats impact (the free-tier subject cap only counts answered
// questions, via incrementSubjectUsage in handleAnswer, so skipping doesn't burn it).
export async function handleSkip(ctx: any): Promise<void> {
  const session = await redis.getSession(ctx.from.id);
  if (!session || !session.currentQuestion) {
    await ctx.answerCbQuery('No active question.', { show_alert: false });
    return;
  }

  // Same stale-button guard as handleAnswer/handleNext: ignore a tap on a question
  // that's already been answered and superseded (double-tap, or a late tap after
  // the timer already advanced the session).
  if (session.awaitingNext) {
    await ctx.answerCbQuery();
    return;
  }

  if (!(await redis.acquireActionLock(ctx.from.id, 'practice:answer'))) {
    await ctx.answerCbQuery();
    return;
  }
  ctx.answerCbQuery('⏭ Skipped — saved for review').catch(() => {});

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  timerService.clearQuestionTimer(ctx.from.id);
  const skippedQuestion = session.currentQuestion;
  await db.addBookmark(user.id, skippedQuestion.id).catch((err) => console.error('[practice:skip] bookmark failed:', err.message));

  const { q, pickedSubject } = await pickNextQuestion(ctx, session, user);

  if (!q) {
    const yearStr = session.year ? ` for ${session.year}` : '';
    const topicStr = session.diagramOnly ? ` with a diagram` : (session.topic ? ` on topic "${fmt.escHtml(session.topic)}"` : '');
    const subjectLabel = session.practiceSubjects && session.practiceSubjects.length > 1
      ? 'all selected subjects'
      : `this subject${yearStr}${topicStr}`;
    await ctx.reply(
      `🔖 Saved for review. But that was the last question available for ${subjectLabel}! Try another year or subject.`,
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
    usedIds: [...(session.usedIds || []), skippedQuestion.id, q.id],
  });

  await db.incrementDailyCount(ctx.from.id);
  await sendQuestion(ctx, q, { mode: 'practice', qNum: newQNum, questionTimerSecs: session.questionTimerSecs });
}

// Next question in practice
export async function handleNext(ctx: any): Promise<void> {
  const session = await redis.getSession(ctx.from.id);
  if (!session) {
    await ctx.answerCbQuery();
    await ctx.reply('Session expired.', {
      reply_markup: { inline_keyboard: [[{ text: '📚 Pick a Subject', callback_data: 'practice:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
    return;
  }

  // Tapping a stale "Next Question" button (from an earlier message, or a double-tap)
  // while the current question is still unanswered — awaitingNext only flips true once
  // handleAnswer actually processes an answer. Reject with an alert instead of silently
  // sending a second question that would orphan the first one's answer buttons.
  if (session.currentQuestion && !session.awaitingNext) {
    await ctx.answerCbQuery('⚠️ You have an unanswered question — answer it first!', { show_alert: true });
    return;
  }

  // Belt-and-suspenders against the sub-second race: two taps landing close enough that
  // both read awaitingNext=true before either write completes.
  if (!(await redis.acquireActionLock(ctx.from.id, 'practice:next'))) {
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery();

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  // If premium was revoked mid-session, cancel the per-question timer
  if (session.questionTimerSecs && user.plan !== 'premium') {
    timerService.clearQuestionTimer(ctx.from.id);
    await redis.updateSession(ctx.from.id, { questionTimerSecs: 0 });
    session.questionTimerSecs = 0;
    await ctx.reply('⚠️ <i>Your premium access has been revoked. The per-question timer has been removed.</i>', { parse_mode: 'HTML' });
  }

  // Revision / bookmark mode: serve questions from the pre-selected pool
  if (session.revisionPool && Array.isArray(session.revisionPool)) {
    const nextIndex = (session.revisionIndex ?? 0) + 1;
    const revisionQuestions: any[] = session.revisionQuestions || [];

    if (nextIndex >= revisionQuestions.length) {
      // All revision questions done
      const accuracy = session.total > 0
        ? Math.round((session.correct / session.total) * 100) : 0;
      await redis.clearSession(ctx.from.id);
      await ctx.reply(
        `🎉 <b>Revision Complete!</b>\n\n✅ ${session.correct}/${session.total} correct · 🎯 ${accuracy}% accuracy\n\n${accuracy >= 70 ? 'Great job! Keep it up 🔥' : 'Keep practising to improve! 💪'}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Revise Again', callback_data: 'revision:start_fresh' }],
              [{ text: '📚 Practice', callback_data: 'practice:pick' }],
              [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
            ],
          },
        }
      );
      return;
    }

    const nextQ = revisionQuestions[nextIndex];
    const newQNum = (session.qNum || 1) + 1;
    await redis.updateSession(ctx.from.id, {
      qNum: newQNum,
      subject: nextQ.subject || session.subject,
      currentQuestion: nextQ,
      lastQuestionTime: Date.now(),
      awaitingNext: false,
      revisionIndex: nextIndex,
      usedIds: [...(session.usedIds || []), nextQ.id],
    });
    await sendQuestion(ctx, nextQ, { mode: session.mode || 'revision', qNum: newQNum, total: revisionQuestions.length });
    return;
  }

  // Auto-challenge: end after autoTotal questions
  if (session.autoChallenge && session.total >= (session.autoTotal || 5)) {
    const accuracy = session.total > 0 ? Math.round((session.correct / session.total) * 100) : 0;
    await redis.clearSession(ctx.from.id);
    await ctx.reply(
      `🎯 <b>Daily Challenge Complete!</b>\n\n✅ ${session.correct}/${session.total} correct · 🎯 ${accuracy}% accuracy\n\n${accuracy >= 70 ? '🔥 Excellent! Keep that streak going.' : '💪 Keep practising for better results!'}`,
      {
        parse_mode: 'HTML',
        reply_markup: fmt.sessionKeyboard(session.subject || '', session.year),
      }
    );
    return;
  }

  const { q, pickedSubject } = await pickNextQuestion(ctx, session, user);

  if (!q) {
    const yearStr = session.year ? ` for ${session.year}` : '';
    const topicStr = session.diagramOnly ? ` with a diagram` : (session.topic ? ` on topic "${fmt.escHtml(session.topic)}"` : '');
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

  await db.incrementDailyCount(ctx.from.id);
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

  // A finished session is a natural pause — the one place we ask for a phone number
  await maybeAskPhone(ctx, await db.getUser(ctx.from.id));
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
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  if (user.subjects.length === 1) {
    await startPractice(ctx, user, user.subjects[0]);
    return;
  }

  const counts = await db.getSubjectQuestionCounts(user.subjects);
  await ctx.reply(
    '📚 <b>Change Subject</b>\n\nWhich subject would you like to switch to?',
    { parse_mode: 'HTML', reply_markup: fmt.practiceSubjectKeyboard(user.subjects, counts) }
  );
}

// /drill command or auto-drill
export async function handleDrill(ctx: any, topicOverride?: string, subjectHint?: string): Promise<void> {
  // Guards against a double-tap firing two overlapping drill starts, which each ran the
  // full question-select + session-write flow independently and sent the question twice.
  if (!(await redis.acquireActionLock(ctx.from.id, 'drill:start'))) return;

  const user = await requireProfile(ctx);
  if (!user) return;
  if (user.plan !== 'premium') {
    await ctx.reply(fmt.upgradeMessage(), { parse_mode: 'HTML', reply_markup: fmt.subscribeKeyboard() });
    return;
  }
  // Get topic from command args or auto-detect weak topic
  const args = ctx.message?.text?.split(' ').slice(1).join(' ');
  const topic = topicOverride || args;

  if (!topic) {
    await ctx.reply(
      `🎯 <b>Topic Drill</b>\n\nUsage: <code>/drill [topic]</code>\nExample: <code>/drill Algebra</code> or <code>/drill Cell Biology</code>\n\nOr tap below for your weakest topics:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Auto-detect weak topics', callback_data: 'drill:auto:' + user.subjects[0] }],
            [{ text: '❌ Cancel', callback_data: 'menu:main' }],
          ],
        },
      }
    );
    return;
  }

  // Topic names aren't unique across subjects (e.g. "Reproduction" is Biology, not
  // whatever the user's first subject happens to be) — try each of the user's
  // subjects until one actually has matching questions. When the caller already
  // knows the subject (e.g. from a "Did you know" fact's own subject_code), check
  // it first so the common case is one query instead of scanning every subject.
  let subject = user.subjects[0];
  let questions: Question[] = [];
  const subjectsToTry = subjectHint && user.subjects.includes(subjectHint)
    ? [subjectHint, ...user.subjects.filter(s => s !== subjectHint)]
    : user.subjects;
  for (const s of subjectsToTry) {
    questions = await db.getQuestionsByTopic(user.exam_type || '', s, topic, 10);
    if (questions.length > 0) { subject = s; break; }
  }
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
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

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
  const subject = parts[2] || undefined;
  const topic = parts.slice(3).join(':');
  await handleDrill(ctx, topic, subject);
}
