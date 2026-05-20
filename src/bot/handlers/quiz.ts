// src/bot/handlers/quiz.ts
import { v4 as uuidv4 } from 'uuid';
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
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

export async function startQuiz(ctx: any, user: User | null, subject: string): Promise<void> {
  if (!user) user = await db.getUser(ctx.from.id);
  if (!user) return;
  const questions = await db.getQuizQuestions(user.exam_type || '', subject, QUIZ_QUESTIONS);

  if (questions.length < 5) {
    await ctx.reply('Not enough questions available for a full quiz. Try again soon!');
    return;
  }

  const sessionId = uuidv4();
  const quizState: QuizState = {
    mode: 'quiz',
    subject,
    sessionId,
    questions,       // full question objects
    qIndex: 0,
    correct: 0,
    total: questions.length,
    startTime: Date.now(),
    deadline: Date.now() + QUIZ_TIME_SECS * 1000,
    answers: [],
  };

  await redis.saveQuizState(ctx.from.id, quizState);
  await redis.setSession(ctx.from.id, { mode: 'quiz', subject, sessionId });
  await db.updateStreak(ctx.from.id);

  const timeMsg = `⏱️ You have *45 minutes* to complete ${questions.length} questions.\nGood luck! 🍀`;
  await ctx.replyWithMarkdown(
    `📋 *Quiz Mode Started*\n${fmt.SUBJECT_MAP[subject] || subject}\n\n${timeMsg}\n\nTap /stop at any time to end early.`
  );

  await sendQuizQuestion(ctx, quizState);
}

export async function sendQuizQuestion(ctx: any, quizState: QuizState): Promise<void> {
  const q = quizState.questions[quizState.qIndex];
  const timeLeft = Math.max(0, Math.round((quizState.deadline - Date.now()) / 1000));
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  const text = fmt.formatQuestion(q, quizState.qIndex + 1, quizState.total, 'quiz')
    + fmt.answerOptions(q)
    + `\n\n⏱️ _Time left: ${mins}:${secs.toString().padStart(2, '0')}_`;

  await ctx.replyWithMarkdown(text, { reply_markup: fmt.answerKeyboard() });
}

export async function handleQuizAnswer(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const selected = ctx.callbackQuery.data.split(':')[1];
  const quizState = await redis.getQuizState(ctx.from.id);
  if (!quizState) {
    await ctx.reply('Quiz expired. Use /quiz to start a new one.');
    return;
  }

  // Check timer
  if (Date.now() > quizState.deadline) {
    await endQuiz(ctx, quizState, 'timeout');
    return;
  }

  const q = quizState.questions[quizState.qIndex];
  const isCorrect = selected === q.correct_option;
  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  await db.logAttempt({
    userId: user.id,
    questionId: q.id,
    selectedOption: selected,
    isCorrect,
    sessionId: quizState.sessionId,
  });

  quizState.answers.push({ qId: q.id, selected, correct: q.correct_option, isCorrect });
  if (isCorrect) quizState.correct++;

  // Show brief feedback then move on
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
  await redis.clearQuizState(ctx.from.id);
  await redis.clearSession(ctx.from.id);

  const durationSecs = Math.round((Date.now() - quizState.startTime) / 1000);
  const accuracy = quizState.total > 0
    ? Math.round((quizState.correct / quizState.total) * 100) : 0;

  const reasonNote = reason === 'timeout' ? '\n⏰ _Time ran out!_' : '';

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
