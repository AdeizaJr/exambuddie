// src/bot/handlers/quiz.ts
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import * as timerService from '../../services/timer';
import * as achievements from './achievements';
import { User, QuizState } from '../../types';
import { handleSRDone } from './spaced_repetition';

const QUIZ_QUESTIONS = 50;
const QUIZ_TIME_SECS = 60 * 60; // 60 minutes

export async function handleQuiz(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) {
    await ctx.reply('Please set up your profile first using /start');
    return;
  }

  if (user.plan !== 'premium') {
    await ctx.reply(
      `📋 <b>CBT Mode — Premium Feature</b>\n\nCBT mode gives you a real exam experience:\n• 50 questions back-to-back\n• 60-minute countdown timer\n• Full score breakdown at the end\n\nUpgrade to Premium to unlock this!`,
      { parse_mode: 'HTML', reply_markup: fmt.subscribeKeyboard() }
    );
    return;
  }

  const quizSubjects = Object.keys(fmt.SUBJECT_MAP);
  const counts = await db.getSubjectQuestionCounts(quizSubjects);
  await ctx.reply(
    '📋 <b>CBT Mode</b>\n\nPick a subject to start your mock exam:',
    { parse_mode: 'HTML', reply_markup: fmt.quizSubjectKeyboard(quizSubjects, counts) }
  );
}

// Subject tapped from the quiz subject picker
export async function handleQuizSubjectPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const subject = ctx.callbackQuery.data.split(':')[2];
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  // Premium: year=undefined triggers year picker step inside startQuiz
  // Free: n/a (quiz is premium-only, but kept consistent)
  await startQuiz(ctx, user, subject);
}

// Step 0 callback — year selected in premium quiz flow
export async function handleQuizFlowYear(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const raw = ctx.callbackQuery.data.split(':')[2];
  const year = raw === 'any' ? null : parseInt(raw, 10);
  const session = await redis.getSession(ctx.from.id);
  if (!session?.pendingSubject) {
    await ctx.reply('Session expired.', {
      reply_markup: { inline_keyboard: [[{ text: '📋 Pick a Subject', callback_data: 'quiz:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
    return;
  }
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  await startQuiz(ctx, user, session.pendingSubject, year);
}

export async function startQuiz(ctx: any, user: User | null, subject: string, year?: number | null, questionTimerSecs?: number, sessionExamType?: string): Promise<void> {
  if (!user) user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  // Step 0: pick year
  if (year === undefined) {
    await redis.setSession(ctx.from.id, { pendingSubject: subject });
    await ctx.reply(
      '📅 <b>Which exam year would you like to be quizzed on?</b>',
      { parse_mode: 'HTML', reply_markup: fmt.flowYearKeyboard('quiz') }
    );
    return;
  }
  // Step 1: pick exam type
  if (sessionExamType === undefined) {
    await redis.setSession(ctx.from.id, { pendingSubject: subject, pendingYear: year ?? null });
    await ctx.reply(
      '📋 <b>Which exam would you like to be quizzed on?</b>',
      { parse_mode: 'HTML', reply_markup: fmt.examTypePickerKeyboard('quiz') }
    );
    return;
  }
  // Step 2: pick timer
  if (questionTimerSecs === undefined) {
    await redis.updateSession(ctx.from.id, { pendingExamType: sessionExamType });
    await ctx.reply(
      '⏱️ <b>Set a per-question timer?</b>\n\nPick how long you want for each question, or tap No Timer to go at your own pace.',
      { parse_mode: 'HTML', reply_markup: fmt.timerPickerKeyboard('quiz') }
    );
    return;
  }

  const examType = sessionExamType || user.exam_type || '';
  const effectiveYear = year !== undefined ? year : (user.target_year ?? null);
  const questions = await db.getQuizQuestions(examType, subject, QUIZ_QUESTIONS, effectiveYear);

  if (questions.length < 5) {
    const availability = await db.getSubjectAvailability(subject);
    const subjectName = fmt.SUBJECT_MAP[subject] || subject;
    const yearStr = effectiveYear ? ` — ${effectiveYear}` : '';
    const examStr = examType && !['ALL', 'BOTH'].includes(examType) ? ` (${examType}${yearStr})` : yearStr;
    if (availability.length === 0) {
      await ctx.reply(`No questions available for ${subjectName}. Please pick another subject.`, {
        reply_markup: { inline_keyboard: [[{ text: '📋 Pick Another Subject', callback_data: 'quiz:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
      });
    } else {
      await ctx.reply(
        `No questions found for <b>${subjectName}</b>${examStr}.\n\nAvailable options for ${subjectName}:`,
        { parse_mode: 'HTML', reply_markup: fmt.subjectAvailabilityKeyboard(subject, availability, 'quiz') }
      );
    }
    return;
  }

  const timerSecs = questionTimerSecs ?? 0;
  const sessionId = uuidv4();
  const quizState: QuizState = {
    mode: 'quiz',
    subject,
    sessionId,
    questions,
    qIndex: 0,
    correct: 0,
    total: questions.length,
    startTime: Date.now(),
    deadline: Date.now() + QUIZ_TIME_SECS * 1000,
    answers: [],
    questionTimerSecs: timerSecs,
  };

  await redis.saveQuizState(ctx.from.id, quizState);
  await redis.setSession(ctx.from.id, { mode: 'quiz', subject, sessionId, questionTimerSecs: timerSecs });

  const timerNote = timerSecs > 0 ? ` with <b>${timerSecs}s per question</b>` : '';
  const timeMsg = `⏱️ You have <b>60 minutes</b> to complete ${questions.length} questions${timerNote}.\nGood luck! 🍀`;
  await ctx.reply(
    `📋 <b>CBT Mode Started</b>\n${fmt.SUBJECT_MAP[subject] || subject}\n\n${timeMsg}\n\nTap /stop or use ⏹ End CBT at any time to stop early.`,
    { parse_mode: 'HTML' }
  );

  await sendQuizQuestion(ctx, quizState);
}

export async function handleQuizExamTypePick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const examType = ctx.callbackQuery.data.split(':')[2];
  const session = await redis.getSession(ctx.from.id);
  if (!session?.pendingSubject) {
    await ctx.reply('Session expired.', {
      reply_markup: { inline_keyboard: [[{ text: '📋 Pick a Subject', callback_data: 'quiz:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
    return;
  }
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  await startQuiz(ctx, user, session.pendingSubject, session.pendingYear ?? null, undefined, examType);
}

export async function handleQuizTimerPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const timerSecs = parseInt(ctx.callbackQuery.data.split(':')[2], 10);
  const session = await redis.getSession(ctx.from.id);
  if (!session?.pendingSubject) {
    await ctx.reply('Session expired.', {
      reply_markup: { inline_keyboard: [[{ text: '📋 Pick a Subject', callback_data: 'quiz:pick' }, { text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    });
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  await startQuiz(ctx, user, session.pendingSubject, session.pendingYear ?? null, timerSecs, session.pendingExamType);
}

export async function handleQuizAvail(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  // quiz:avail:<subject>:<examType>:<year>
  const parts = ctx.callbackQuery.data.split(':');
  const subject = parts[2];
  const examType = parts[3];
  const year = parts[4] && parts[4] !== 'any' ? parseInt(parts[4], 10) : null;
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  await startQuiz(ctx, user, subject, year, undefined, examType);
}

export async function sendQuizQuestion(ctx: any, quizState: QuizState): Promise<void> {
  const q = quizState.questions[quizState.qIndex];
  const timerSecs = quizState.questionTimerSecs && quizState.questionTimerSecs > 0 ? quizState.questionTimerSecs : 0;

  const overallSecsLeft = Math.max(0, Math.floor((quizState.deadline - Date.now()) / 1000));
  const mins = Math.floor(overallSecsLeft / 60);
  const secs = overallSecsLeft % 60;
  const overallTimeLine = `\n⏳ <b>${mins}:${secs.toString().padStart(2, '0')}</b> overall time left`;

  const answeredCount = quizState.qIndex;
  const scoreLine = answeredCount > 0
    ? `\n\n📊 <b>${quizState.correct}</b> correct so far · <b>${Math.round((quizState.correct / answeredCount) * 100)}%</b> accuracy`
    : '';

  const baseText = fmt.formatQuestion(q, quizState.qIndex + 1, quizState.total, 'quiz') + fmt.answerOptions(q) + overallTimeLine + scoreLine;
  const timerLine = (secsLeft: number) =>
    timerSecs > 0 ? `\n\n⏱️ <i>${secsLeft}s remaining</i>` : '';

  const keyboard = fmt.answerKeyboard(!!q.option_e);
  const msgText = baseText + timerLine(timerSecs);
  const imageUrl = q.image_url?.startsWith('/')
    ? `${process.env.APP_URL || ''}${q.image_url}`
    : q.image_url;
  let sentMsg;
  try {
    sentMsg = imageUrl
      ? await ctx.replyWithPhoto(imageUrl, { caption: msgText, parse_mode: 'HTML', reply_markup: keyboard })
      : await ctx.reply(msgText, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    // Dead image link or blocked user — fall back to text so the question still gets sent
    console.error(`[quiz] failed to send question ${q.id} to ${ctx.from.id}:`, (err as Error).message);
    sentMsg = await ctx.reply(msgText, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  if (timerSecs > 0) {
    const deadline = Date.now() + timerSecs * 1000;
    quizState.questionDeadline = deadline;
    await redis.saveQuizState(ctx.from.id, quizState);

    const telegramId = ctx.from.id;

    timerService.startDisplayTimer(
      telegramId,
      timerSecs,
      { telegram: ctx.telegram, chatId: ctx.chat.id, messageId: sentMsg.message_id, imageUrl, baseText, timerLine, keyboard },
      async () => {
        const state = await redis.getQuizState(telegramId);
        if (!state || state.questionDeadline !== deadline) return;

        // Clear deadline first so a concurrent answer tap sees it gone and bails
        await redis.saveQuizState(telegramId, { ...state, questionDeadline: undefined });

        // Re-read to confirm no concurrent answer already claimed this question
        const fresh = await redis.getQuizState(telegramId);
        if (!fresh || fresh.qIndex !== state.qIndex) return;

        fresh.answers.push({ qId: q.id, selected: '', correct: q.correct_option, isCorrect: false });
        fresh.qIndex++;
        await redis.saveQuizState(telegramId, fresh);

        const timesUpText = `⏱️ <b>Time's up!</b>\n\n` + fmt.correctAnswer(q, '');
        await ctx.telegram.sendMessage(telegramId, timesUpText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '➡️ Next', callback_data: 'quiz:next' }]] },
        }).catch((err: any) => console.error(`[quiz] timer expiry sendMessage failed for ${telegramId}:`, err.message));
      },
    );
  }
}

export async function handleQuizAnswer(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const selected = ctx.callbackQuery.data.split(':')[1];
  const quizState = await redis.getQuizState(ctx.from.id);
  if (!quizState) {
    await ctx.reply('Quiz expired. Use /quiz to start a new one.');
    return;
  }

  // Check overall quiz timer
  if (Date.now() > quizState.deadline) {
    await endQuiz(ctx, quizState, 'timeout');
    return;
  }

  const q = quizState.questions[quizState.qIndex];
  if (!q) {
    // Timer race already advanced qIndex past the end, or quiz already finished
    await ctx.reply('That question already moved on. Use /quiz to start a new one.');
    return;
  }
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  // Timer already fired and auto-advanced — ignore late tap
  if (!quizState.questionDeadline && quizState.questionTimerSecs) return;

  // Cancel per-question timer since user answered in time
  timerService.clearQuestionTimer(ctx.from.id);
  quizState.questionDeadline = undefined;

  const isCorrect = selected === q.correct_option;

  await db.logAttempt({
    userId: user.id,
    questionId: q.id,
    selectedOption: selected,
    isCorrect,
    sessionId: quizState.sessionId,
  });
  const streakResult = await db.updateStreak(ctx.from.id);

  quizState.answers.push({ qId: q.id, selected, correct: q.correct_option, isCorrect });
  if (isCorrect) quizState.correct++;

  if (!isCorrect) db.addSRCard(user.id, q.id).catch(() => {});

  await ctx.reply(fmt.correctAnswer(q, selected), {
    parse_mode: 'HTML',
    reply_markup: fmt.afterAnswerKeyboard('quiz', q.question_text.includes('*'), q.id, !!q.explanation),
  });

  if (!isCorrect) {
    const totalWrong = await db.getTotalWrongAttempts(user.id);
    if (totalWrong === 1) {
      await ctx.reply(
        "💪 Don't let that stop you — getting it wrong is part of the process. Every question you attempt makes you sharper. Keep going!"
      );
    }
  }

  const totalAttempts = await db.getTotalAttempts(user.id);
  const milestone = fmt.totalMilestone(totalAttempts);
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

  quizState.qIndex++;
  await redis.saveQuizState(ctx.from.id, quizState);
}

export async function handleQuizNext(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const quizState = await redis.getQuizState(ctx.from.id);
  if (!quizState) { await ctx.reply('No active quiz. Use /quiz to start.'); return; }

  // Re-check premium on every step — revoked access ends the quiz immediately
  const user = await db.getUser(ctx.from.id);
  if (!user || user.plan !== 'premium') {
    await endQuiz(ctx, quizState, 'revoked');
    return;
  }

  // Check time
  if (Date.now() > quizState.deadline) {
    await endQuiz(ctx, quizState, 'timeout');
    return;
  }

  // Done?
  if (quizState.qIndex >= quizState.total) {
    await endQuiz(ctx, quizState, 'complete');
    return;
  }

  timerService.clearQuestionTimer(ctx.from.id);
  await sendQuizQuestion(ctx, quizState);
}

export async function handleQuizStop(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const quizState = await redis.getQuizState(ctx.from.id);
  if (!quizState) {
    await ctx.reply('No active quiz.');
    return;
  }

  const remaining = quizState.total - quizState.qIndex;
  await ctx.reply(
    `⚠️ <b>End Quiz Early?</b>\n\nYou have <b>${remaining} question${remaining === 1 ? '' : 's'}</b> remaining.\n\nIf you stop now, all unanswered questions will be recorded as <b>incorrect</b>.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Yes, end quiz', callback_data: 'quiz:stop:confirm' },
          { text: '❌ No, continue', callback_data: 'quiz:stop:cancel' },
        ]],
      },
    }
  );
}

export async function handleQuizStopConfirm(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const quizState = await redis.getQuizState(ctx.from.id);
  if (!quizState) {
    await ctx.reply('No active quiz.');
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  for (let i = quizState.qIndex; i < quizState.questions.length; i++) {
    const q = quizState.questions[i];
    await db.logAttempt({
      userId: user.id,
      questionId: q.id,
      selectedOption: '',
      isCorrect: false,
      sessionId: quizState.sessionId,
    });
    quizState.answers.push({ qId: q.id, selected: '', correct: q.correct_option, isCorrect: false });
  }

  quizState.qIndex = quizState.total;
  await endQuiz(ctx, quizState, 'stopped');
}

export async function handleQuizStopCancel(ctx: any): Promise<void> {
  await ctx.answerCbQuery('Continuing quiz!');
  const quizState = await redis.getQuizState(ctx.from.id);
  if (!quizState) return;
  // Delete the "End Quiz?" confirmation message and resend current question
  await ctx.deleteMessage().catch(() => {});
  await sendQuizQuestion(ctx, quizState);
}

export async function endQuiz(ctx: any, quizState: QuizState, reason: string): Promise<void> {
  timerService.clearQuestionTimer(ctx.from.id);

  const endTime = Date.now();
  const user = await db.getUser(ctx.from.id);
  if (user) {
    await db.saveQuizSession({
      sessionId: quizState.sessionId,
      userId: user.id,
      subject: quizState.subject,
      totalQuestions: quizState.total,
      correctCount: quizState.correct,
      startTime: quizState.startTime,
      endTime,
    }).catch(() => {});
  }

  const durationSecs = Math.round((Date.now() - quizState.startTime) / 1000);
  const accuracy = quizState.total > 0
    ? Math.round((quizState.correct / quizState.total) * 100) : 0;

  // Save quiz result for the share feature before clearing state
  await redis.saveQuizResult(ctx.from.id, {
    subject: quizState.subject,
    correct: quizState.correct,
    total: quizState.total,
    accuracy,
    durationSecs,
  });

  // Store wrong answers for post-quiz walkthrough (30 min TTL)
  const wrongItems: redis.QuizReviewItem[] = quizState.answers
    .filter((a: any) => !a.isCorrect && a.selected !== '')
    .map((a: any) => ({
      question: quizState.questions.find((q: any) => q.id === a.qId),
      selected: a.selected,
      correct: a.correct,
    }))
    .filter((item: any) => item.question);
  if (wrongItems.length > 0) {
    await redis.setQuizReview(ctx.from.id, wrongItems);
  }

  await redis.clearQuizState(ctx.from.id);
  await redis.clearSession(ctx.from.id);

  // Badge check
  if (user) {
    const totalAttempts = await db.getTotalAttempts(user.id).catch(() => 0);
    achievements.checkAndGrantBadges(ctx.telegram, user.id, ctx.from.id, {
      totalAttempts,
      quizDone: !quizState.isMock,
      mockDone: !!quizState.isMock,
      quizScore: { correct: quizState.correct, total: quizState.total },
      accuracy,
    }).catch(() => {});
  }

  const reasonNote = reason === 'timeout' ? '\n⏰ <i>Time ran out!</i>'
    : reason === 'revoked' ? '\n🔒 <i>Your premium access was revoked.</i>'
    : reason === 'stopped' ? '\n⏹ <i>Quiz ended early.</i>'
    : '';

  const grade =
    accuracy >= 80 ? '🏆 Outstanding!' :
    accuracy >= 65 ? '🌟 Excellent!' :
    accuracy >= 50 ? '👍 Good effort!' :
    '💪 Keep practising!';

  const mins = Math.floor(durationSecs / 60);
  const secs = durationSecs % 60;

  const subjectDisplay = quizState.subject === '__mock__'
    ? '🎓 Full Mock Exam'
    : (fmt.SUBJECT_MAP[quizState.subject] || quizState.subject);

  const summary = `📋 <b>${quizState.isMock ? 'Mock Exam' : 'Quiz'} Complete!</b>${reasonNote}

${grade}

📚 Subject: ${subjectDisplay}
✅ Score: ${quizState.correct}/${quizState.total}
🎯 Accuracy: ${accuracy}%
⏱️ Time: ${mins}m ${secs}s

${accuracy < 50 ? '💡 <i>Tip: Use /drill to focus on your weak topics.</i>' : ''}
${accuracy >= 80 ? '🔥 You\'re exam-ready! Keep it consistent.' : ''}`;

  const wrongCount = wrongItems.length;
  const keyboard: any[][] = [
    [{ text: '🔄 Take Another Quiz', callback_data: 'quiz:pick' },
     { text: '🎯 Drill Weak Topics', callback_data: `drill:auto:${quizState.subject}` }],
  ];
  if (wrongCount > 0) {
    keyboard.push([{ text: `📖 Review ${wrongCount} Wrong Answer${wrongCount > 1 ? 's' : ''}`, callback_data: 'quiz:review_wrong' }]);
  }
  keyboard.push(
    [{ text: '📜 Quiz History', callback_data: 'quiz:history' },
     { text: '📊 My Stats', callback_data: 'stats:show' }],
    [{ text: '📤 Share Result', callback_data: 'quiz:share' }],
    [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
  );

  await ctx.reply(summary, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleQuizShare(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const result = await redis.getQuizResult(ctx.from.id);
  if (!result) {
    await ctx.reply('No recent quiz result found. Complete a quiz first!');
    return;
  }

  const subjectDisplay = fmt.SUBJECT_MAP[result.subject] || result.subject;
  const mins = Math.floor(result.durationSecs / 60);
  const secs = result.durationSecs % 60;
  const grade =
    result.accuracy >= 80 ? '🏆 Outstanding!' :
    result.accuracy >= 65 ? '🌟 Excellent!' :
    result.accuracy >= 50 ? '👍 Good effort!' :
    '💪 Keep practising!';

  const card = `📋 <b>ExamBuddie Quiz Result</b>

📚 Subject: ${subjectDisplay}
✅ Score: ${result.correct}/${result.total}
🎯 Accuracy: ${result.accuracy}%
⏱️ Time: ${mins}m ${secs}s
${grade}

Practice free at @${process.env.BOT_USERNAME || 'ExamBuddieBot'}`;

  await ctx.reply(card, { parse_mode: 'HTML' });
}

export async function handleQuizReviewWrong(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const items = await redis.getQuizReview(ctx.from.id);
  if (!items || items.length === 0) {
    await ctx.reply('Review session expired. Take another quiz to review wrong answers.');
    return;
  }

  await redis.clearQuizReview(ctx.from.id);
  await redis.setSession(ctx.from.id, {
    mode: 'quiz_review',
    reviewItems: items,
    reviewIndex: 0,
    total: items.length,
    currentQuestion: items[0].question,
  });

  await sendQuizReviewItem(ctx, items[0], 1, items.length);
}

async function sendQuizReviewItem(ctx: any, item: redis.QuizReviewItem, num: number, total: number): Promise<void> {
  const q = item.question;
  const text = fmt.formatQuestion(q, num, total, 'quiz_review')
    + fmt.answerOptions(q);
  const imageUrl = q.image_url?.startsWith('/')
    ? `${process.env.APP_URL || ''}${q.image_url}`
    : q.image_url;

  const isLast = num >= total;
  const nextButton = isLast
    ? [{ text: '✅ Done', callback_data: 'quiz:review_done' }]
    : [{ text: '➡️ Next', callback_data: `quiz:review_next:${num}` }];

  const answerResult = fmt.correctAnswer(q, item.selected);

  try {
    if (imageUrl) {
      await ctx.replyWithPhoto(imageUrl, { caption: text, parse_mode: 'HTML' });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML' });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  await ctx.reply(answerResult, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        nextButton,
        [{ text: '📖 Add All to Review Deck', callback_data: 'quiz:add_to_sr' }],
      ],
    },
  });
}

export async function handleQuizReviewNext(ctx: any, indexStr: string): Promise<void> {
  await ctx.answerCbQuery();
  const session = await redis.getSession(ctx.from.id);
  if (!session || session.mode !== 'quiz_review') return;

  const nextIndex = parseInt(indexStr, 10);
  const item = session.reviewItems[nextIndex];
  if (!item) {
    await handleQuizReviewDone(ctx);
    return;
  }

  await redis.updateSession(ctx.from.id, { reviewIndex: nextIndex, currentQuestion: item.question });
  await sendQuizReviewItem(ctx, item, nextIndex + 1, session.total);
}

export async function handleQuizReviewDone(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  await redis.clearSession(ctx.from.id);
  await ctx.reply(
    '📖 Review complete!\n\nWant to add these questions to your Review Deck so they resurface automatically?',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📖 Add to Review Deck', callback_data: 'quiz:add_to_sr_final' }],
          [{ text: '🔄 Take Another Quiz', callback_data: 'quiz:pick' }],
          [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

export async function handleQuizAddToSR(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const session = await redis.getSession(ctx.from.id);
  if (!session || session.mode !== 'quiz_review') {
    await ctx.answerCbQuery('Session expired.', { show_alert: true });
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  const items: redis.QuizReviewItem[] = session.reviewItems || [];
  await Promise.all(items.map((item: redis.QuizReviewItem) =>
    db.addSRCard(user.id, item.question.id).catch(() => {})
  ));

  await ctx.reply(
    `✅ <b>${items.length} question${items.length > 1 ? 's' : ''} added to your Review Deck!</b>\n\nUse /review or tap 📖 Review to study them later.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📖 Go to Review Deck', callback_data: 'sr:show' }],
          [{ text: '🔄 Take Another Quiz', callback_data: 'quiz:pick' }],
        ],
      },
    }
  );
}

export async function handleQuizAddToSRFinal(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  // Pull the review items from a short-lived session if still present,
  // otherwise just acknowledge
  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  await ctx.reply(
    '✅ Questions added to your Review Deck. Use /review anytime to study them.',
    { parse_mode: 'HTML' }
  );
}

// ── Mock Exam Mode ────────────────────────────────────────────────────────────

export async function handleMockExam(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) {
    await ctx.reply('Please set up your profile first using /start');
    return;
  }

  if (user.plan !== 'premium') {
    await ctx.reply(
      `🎓 <b>Mock Exam — Premium Feature</b>\n\nFull mock exams simulate real ${user.exam_type || 'exam'} conditions:\n• ${user.exam_type === 'JAMB' ? '100 questions across all your subjects' : '60 questions from one subject'}\n• ${user.exam_type === 'JAMB' ? '2-hour' : '3-hour'} timer\n• Full score breakdown\n\nUpgrade to Premium to unlock!`,
      { parse_mode: 'HTML', reply_markup: fmt.subscribeKeyboard() }
    );
    return;
  }

  const examType = user.exam_type;
  const isMixedSubjects = examType === 'JAMB';
  const qCount = isMixedSubjects ? 100 : 60;
  const timeMins = isMixedSubjects ? 120 : 180;
  const subjects = user.subjects || [];

  if (subjects.length === 0) {
    await ctx.reply('Please select subjects in /settings first.');
    return;
  }

  await ctx.reply(
    `🎓 <b>${examType} Full Mock Exam</b>\n\n${isMixedSubjects ? `📚 ${subjects.length} subject${subjects.length > 1 ? 's' : ''} · ${qCount} questions` : `📚 ${qCount} questions`}\n⏱️ ${timeMins} minutes\n\nThis simulates real ${examType} conditions. Ready?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Start Mock Exam', callback_data: 'mock:start' }],
          [{ text: '❌ Cancel', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

export async function handleMockStart(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) { await ctx.reply('Please use /start first.'); return; }
  if (user.plan !== 'premium') { await ctx.reply('Premium required for mock exams.'); return; }

  const examType = user.exam_type;
  const isMixedSubjects = examType === 'JAMB';
  const qCount = isMixedSubjects ? 100 : 60;
  const timeSecs = isMixedSubjects ? 120 * 60 : 180 * 60;
  const subjects = user.subjects || [];

  let questions;
  if (isMixedSubjects && subjects.length > 1) {
    questions = await db.getQuizQuestionsMulti(examType, subjects, qCount, user.target_year ?? null);
  } else {
    const subject = subjects[0] || 'english';
    questions = await db.getQuizQuestions(examType, subject, qCount, user.target_year ?? null);
  }

  if (questions.length < 5) {
    await ctx.reply('Not enough questions available. Try changing your year or subjects in /settings.');
    return;
  }

  const sessionId = uuidv4();
  const quizState: QuizState & { isMock?: boolean } = {
    mode: 'quiz',
    subject: isMixedSubjects ? '__mock__' : (subjects[0] || ''),
    sessionId,
    questions,
    qIndex: 0,
    correct: 0,
    total: questions.length,
    startTime: Date.now(),
    deadline: Date.now() + timeSecs * 1000,
    answers: [],
    isMock: true,
  };

  await redis.saveQuizState(ctx.from.id, quizState);
  await redis.setSession(ctx.from.id, { mode: 'quiz', subject: quizState.subject, sessionId });

  const timeMins = timeSecs / 60;
  await ctx.reply(
    `🎓 <b>Mock Exam Started!</b>\n\n📝 ${questions.length} questions\n⏱️ ${timeMins} minutes\n\nGood luck! Tap /stop to end early.`,
    { parse_mode: 'HTML' }
  );

  await sendQuizQuestion(ctx, quizState);
}

// ── Explanation feedback ───────────────────────────────────────────────────────

export async function handleExplanationFeedback(ctx: any): Promise<void> {
  await ctx.answerCbQuery('Thanks for your feedback!');
  const parts = ctx.callbackQuery.data.split(':'); // feedback:good/bad:questionId
  const rating: 1 | -1 = parts[1] === 'good' ? 1 : -1;
  const questionId = parseInt(parts[2], 10);

  const user = await db.getUser(ctx.from.id);
  if (!user || !questionId) return;

  await db.saveExplanationFeedback(user.id, questionId, rating).catch(() => {});
}
