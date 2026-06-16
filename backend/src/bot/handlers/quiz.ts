// src/bot/handlers/quiz.ts
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import * as timerService from '../../services/timer';
import { User, QuizState } from '../../types';

const QUIZ_QUESTIONS = 40;
const QUIZ_TIME_SECS = 45 * 60; // 45 minutes

export async function handleQuiz(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) {
    await ctx.reply('Please set up your profile first using /start');
    return;
  }

  if (user.plan !== 'premium') {
    await ctx.reply(
      `📋 <b>Quiz Mode — Premium Feature</b>\n\nQuiz mode gives you a real exam experience:\n• 40 questions back-to-back\n• 45-minute countdown timer\n• Full score breakdown at the end\n\nUpgrade to Premium to unlock this!`,
      { parse_mode: 'HTML', reply_markup: fmt.subscribeKeyboard() }
    );
    return;
  }

  const counts = await db.getSubjectQuestionCounts(user.subjects);
  await ctx.reply(
    '📋 <b>Quiz Mode</b>\n\nPick a subject to start your mock exam:',
    { parse_mode: 'HTML', reply_markup: fmt.quizSubjectKeyboard(user.subjects, counts) }
  );
}

// Subject tapped from the quiz subject picker
export async function handleQuizSubjectPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const subject = ctx.callbackQuery.data.split(':')[2];
  const user = await db.getUser(ctx.from.id);
  if (!user) return;
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
  if (!user) return;
  await startQuiz(ctx, user, session.pendingSubject, year);
}

export async function startQuiz(ctx: any, user: User | null, subject: string, year?: number | null, questionTimerSecs?: number, sessionExamType?: string): Promise<void> {
  if (!user) user = await db.getUser(ctx.from.id);
  if (!user) return;

  // Step 0: pick year
  if (year === undefined) {
    await redis.setSession(ctx.from.id, { pendingSubject: subject, pendingMode: 'quiz' });
    await ctx.reply(
      '📅 <b>Which exam year would you like to be quizzed on?</b>',
      { parse_mode: 'HTML', reply_markup: fmt.flowYearKeyboard('quiz') }
    );
    return;
  }
  // Step 1: pick exam type
  if (sessionExamType === undefined) {
    await redis.setSession(ctx.from.id, { pendingSubject: subject, pendingYear: year ?? null, pendingMode: 'quiz' });
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
  const timeMsg = `⏱️ You have <b>45 minutes</b> to complete ${questions.length} questions${timerNote}.\nGood luck! 🍀`;
  await ctx.reply(
    `📋 <b>Quiz Mode Started</b>\n${fmt.SUBJECT_MAP[subject] || subject}\n\n${timeMsg}\n\nTap /stop or use ⏹ End Quiz at any time to stop early.`,
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
  if (!user) return;
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
  if (!user) return;

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
  if (!user) return;
  await startQuiz(ctx, user, subject, year, undefined, examType);
}

export async function sendQuizQuestion(ctx: any, quizState: QuizState): Promise<void> {
  const q = quizState.questions[quizState.qIndex];
  const timerSecs = quizState.questionTimerSecs && quizState.questionTimerSecs > 0 ? quizState.questionTimerSecs : 0;

  const overallSecsLeft = Math.max(0, Math.floor((quizState.deadline - Date.now()) / 1000));
  const mins = Math.floor(overallSecsLeft / 60);
  const secs = overallSecsLeft % 60;
  const overallTimeLine = `\n⏳ <b>${mins}:${secs.toString().padStart(2, '0')}</b> overall time left`;

  const baseText = fmt.formatQuestion(q, quizState.qIndex + 1, quizState.total, 'quiz') + fmt.answerOptions(q) + overallTimeLine;
  const timerLine = (secsLeft: number) =>
    timerSecs > 0 ? `\n\n⏱️ <i>${secsLeft}s remaining</i>` : '';

  const keyboard = fmt.answerKeyboard();
  const msgText = baseText + timerLine(timerSecs);
  let sentMsg;
  try {
    sentMsg = q.image_url
      ? await ctx.replyWithPhoto(q.image_url, { caption: msgText, parse_mode: 'HTML', reply_markup: keyboard })
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
    const chatId = ctx.chat.id;
    const messageId = sentMsg.message_id;
    const telegram = ctx.telegram;

    timerService.setQuestionTimer(
      telegramId,
      timerSecs,
      (secsLeft) => {
        if (q.image_url) {
          telegram.editMessageCaption(chatId, messageId, undefined, baseText + timerLine(secsLeft), {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          }).catch(() => {});
        } else {
          telegram.editMessageText(chatId, messageId, undefined, baseText + timerLine(secsLeft), {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          }).catch(() => {});
        }
      },
      async () => {
        const state = await redis.getQuizState(telegramId);
        if (!state || state.questionDeadline !== deadline) return;

        state.answers.push({ qId: q.id, selected: '', correct: q.correct_option, isCorrect: false });
        state.questionDeadline = undefined;
        state.qIndex++;
        await redis.saveQuizState(telegramId, state);

        const timesUpText = `⏱️ <b>Time's up!</b>\n\n` + fmt.correctAnswer(q, '');
        await telegram.sendMessage(telegramId, timesUpText, {
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
  if (!user) return;

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
  await db.updateStreak(ctx.from.id);

  quizState.answers.push({ qId: q.id, selected, correct: q.correct_option, isCorrect });
  if (isCorrect) quizState.correct++;

  await ctx.reply(fmt.correctAnswer(q, selected), {
    parse_mode: 'HTML',
    reply_markup: fmt.afterAnswerKeyboard('quiz', q.question_text.includes('*')),
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
    await ctx.replyWithDice({ emoji: '🎉' });
    await ctx.reply(milestone);
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
  if (!user) return;

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

  await redis.clearQuizState(ctx.from.id);
  await redis.clearSession(ctx.from.id);

  const durationSecs = Math.round((Date.now() - quizState.startTime) / 1000);
  const accuracy = quizState.total > 0
    ? Math.round((quizState.correct / quizState.total) * 100) : 0;

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

  const subjectDisplay = fmt.SUBJECT_MAP[quizState.subject] || quizState.subject;

  const summary = `📋 <b>Quiz Complete!</b>${reasonNote}

${grade}

📚 Subject: ${subjectDisplay}
✅ Score: ${quizState.correct}/${quizState.total}
🎯 Accuracy: ${accuracy}%
⏱️ Time: ${mins}m ${secs}s

${accuracy < 50 ? '💡 <i>Tip: Use /drill to focus on your weak topics.</i>' : ''}
${accuracy >= 80 ? '🔥 You\'re exam-ready! Keep it consistent.' : ''}`;

  await ctx.reply(summary, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Take Another Quiz', callback_data: 'quiz:pick' },
         { text: '🎯 Drill Weak Topics', callback_data: `drill:auto:${quizState.subject}` }],
        [{ text: '📜 Quiz History', callback_data: 'quiz:history' },
         { text: '📊 My Stats', callback_data: 'stats:show' }],
        [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
      ],
    },
  });
}
