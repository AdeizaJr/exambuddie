// src/bot/handlers/quiz.ts
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import * as timerService from '../../services/timer';
import { User, Question, QuizState } from '../../types';

const QUIZ_QUESTIONS = 40;
const QUIZ_TIME_SECS = 45 * 60; // 45 minutes

export async function handleQuiz(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) {
    await ctx.reply('Please set up your profile first using /start');
    return;
  }

  if (user.plan !== 'premium') {
    await ctx.replyWithMarkdown(
      `📋 *Quiz Mode — Premium Feature*\n\nQuiz mode gives you a real exam experience:\n• 40 questions back-to-back\n• 45-minute countdown timer\n• Full score breakdown at the end\n\nUpgrade to Premium to unlock this!`,
      { reply_markup: fmt.subscribeKeyboard() }
    );
    return;
  }

  if (user.subjects.length === 1) {
    await startQuiz(ctx, user, user.subjects[0]);
  } else {
    await ctx.replyWithMarkdown(
      '📋 *Quiz Mode*\n\nWhich subject for your mock exam?',
      { reply_markup: fmt.practiceSubjectKeyboard(user.subjects) }
    );
  }
}

export async function startQuiz(ctx: any, user: User | null, subject: string, questionTimerSecs?: number, sessionExamType?: string): Promise<void> {
  if (!user) user = await db.getUser(ctx.from.id);
  if (!user) return;

  // Step 1: pick exam type
  if (sessionExamType === undefined) {
    await redis.setSession(ctx.from.id, { pendingSubject: subject, pendingMode: 'quiz' });
    await ctx.replyWithMarkdown(
      '📋 *Which exam would you like to be quizzed on?*',
      { reply_markup: fmt.examTypePickerKeyboard('quiz') }
    );
    return;
  }
  // Step 2: pick timer
  if (questionTimerSecs === undefined) {
    await redis.updateSession(ctx.from.id, { pendingExamType: sessionExamType });
    await ctx.replyWithMarkdown(
      '⏱️ *Set a per-question timer?*\n\nPick how long you want for each question, or tap No Timer to go at your own pace.',
      { reply_markup: fmt.timerPickerKeyboard('quiz') }
    );
    return;
  }

  const examType = sessionExamType || user.exam_type || '';
  const questions = await db.getQuizQuestions(examType, subject, QUIZ_QUESTIONS);

  if (questions.length < 5) {
    await ctx.reply('Not enough questions available for a full quiz. Try again soon!');
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
  await db.updateStreak(ctx.from.id);

  const timerNote = timerSecs > 0 ? ` with *${timerSecs}s per question*` : '';
  const timeMsg = `⏱️ You have *45 minutes* to complete ${questions.length} questions${timerNote}.\nGood luck! 🍀`;
  await ctx.replyWithMarkdown(
    `📋 *Quiz Mode Started*\n${fmt.SUBJECT_MAP[subject] || subject}\n\n${timeMsg}\n\nTap /stop at any time to end early.`
  );

  await sendQuizQuestion(ctx, quizState);
}

export async function handleQuizExamTypePick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const examType = ctx.callbackQuery.data.split(':')[2];
  const session = await redis.getSession(ctx.from.id);
  if (!session?.pendingSubject) { await ctx.reply('Session expired. Please start again.'); return; }
  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  await startQuiz(ctx, user, session.pendingSubject, undefined, examType);
}

export async function handleQuizTimerPick(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const timerSecs = parseInt(ctx.callbackQuery.data.split(':')[2], 10);
  const session = await redis.getSession(ctx.from.id);
  if (!session?.pendingSubject) {
    await ctx.reply('Session expired. Please start again.');
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  await startQuiz(ctx, user, session.pendingSubject, timerSecs, session.pendingExamType);
}

export async function sendQuizQuestion(ctx: any, quizState: QuizState): Promise<void> {
  const q = quizState.questions[quizState.qIndex];
  const overallLeft = () => {
    const s = Math.max(0, Math.round((quizState.deadline - Date.now()) / 1000));
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const timerSecs = quizState.questionTimerSecs && quizState.questionTimerSecs > 0 ? quizState.questionTimerSecs : 0;
  const baseText = fmt.formatQuestion(q, quizState.qIndex + 1, quizState.total, 'quiz') + fmt.answerOptions(q);
  const timerLine = (secsLeft: number) =>
    timerSecs > 0
      ? `\n\n⏱️ _${secsLeft}s remaining  |  Overall: ${overallLeft()} left_`
      : `\n\n⏱️ _Overall: ${overallLeft()} left_`;

  const keyboard = fmt.answerKeyboard();
  const sentMsg = await ctx.replyWithMarkdown(baseText + timerLine(timerSecs), { reply_markup: keyboard });

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
        telegram.editMessageText(chatId, messageId, undefined, baseText + timerLine(secsLeft), {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }).catch(() => {});
      },
      async () => {
        const state = await redis.getQuizState(telegramId);
        if (!state || state.questionDeadline !== deadline) return;

        state.answers.push({ qId: q.id, selected: '', correct: q.correct_option, isCorrect: false });
        state.questionDeadline = undefined;
        state.qIndex++;
        await redis.saveQuizState(telegramId, state);

        await telegram.sendMessage(telegramId,
          `⏱️ *Time's up!* _(${q.correct_option} was correct)_`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '➡️ Next', callback_data: 'quiz:next' }]] },
          },
        );
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

  quizState.answers.push({ qId: q.id, selected, correct: q.correct_option, isCorrect });
  if (isCorrect) quizState.correct++;

  const icon = isCorrect ? '✅' : `❌ _(${q.correct_option} was correct)_`;

  await ctx.replyWithMarkdown(icon, {
    reply_markup: {
      inline_keyboard: [[
        { text: '➡️ Next', callback_data: 'quiz:next' },
        { text: '🚩 Flag', callback_data: 'flag:question' },
      ]],
    },
  });

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

export async function endQuiz(ctx: any, quizState: QuizState, reason: string): Promise<void> {
  timerService.clearQuestionTimer(ctx.from.id);
  await redis.clearQuizState(ctx.from.id);
  await redis.clearSession(ctx.from.id);

  const durationSecs = Math.round((Date.now() - quizState.startTime) / 1000);
  const accuracy = quizState.total > 0
    ? Math.round((quizState.correct / quizState.total) * 100) : 0;

  const reasonNote = reason === 'timeout' ? '\n⏰ _Time ran out!_'
    : reason === 'revoked' ? '\n🔒 _Your premium access was revoked._'
    : '';

  const grade =
    accuracy >= 80 ? '🏆 Outstanding!' :
    accuracy >= 65 ? '🌟 Excellent!' :
    accuracy >= 50 ? '👍 Good effort!' :
    '💪 Keep practising!';

  const mins = Math.floor(durationSecs / 60);
  const secs = durationSecs % 60;

  const summary = `📋 *Quiz Complete!*${reasonNote}

${grade}

📚 Subject: ${fmt.SUBJECT_MAP[quizState.subject] || quizState.subject}
✅ Score: ${quizState.correct}/${quizState.total}
🎯 Accuracy: ${accuracy}%
⏱️ Time: ${mins}m ${secs}s

${accuracy < 50 ? '💡 _Tip: Use /drill to focus on your weak topics._' : ''}
${accuracy >= 80 ? '🔥 You\'re exam-ready! Keep it consistent.' : ''}`;

  await ctx.replyWithMarkdown(summary, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Take Another Quiz', callback_data: 'quiz:pick' },
         { text: '🎯 Drill Weak Topics', callback_data: `drill:auto:${quizState.subject}` }],
        [{ text: '📊 My Stats', callback_data: 'stats:show' }],
      ],
    },
  });
}
