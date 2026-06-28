import * as db from '../../db';
import { pool } from '../../db';
import * as redis from '../../services/redis';
import { SUBJECT_MAP } from '../formatter';

function subjectLabel(code: string): string {
  return SUBJECT_MAP[code] || code;
}

export async function handleTheoryStart(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) {
    await ctx.reply('Please set up your profile first using /start');
    return;
  }

  const subjects = user.subjects?.length ? user.subjects : ['math'];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];

  const q = await db.getRandomTheoryQuestion(subject, user.exam_type);
  if (!q) {
    await ctx.reply(
      `No theory questions available for ${subjectLabel(subject)} yet.\n\nTry again after we finish loading questions.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  await redis.updateSession(ctx.from.id, {
    mode: 'theory_attempt',
    theoryQuestionId: q.id,
    theorySubject: q.subject,
    theoryYear: q.year,
    theoryExamType: q.exam_type,
  });

  const header = `📝 <b>Theory Question</b>\n${subjectLabel(q.subject)} • ${q.exam_type} ${q.year}\n\n`;
  await ctx.reply(
    `${header}${q.question_text}\n\n<i>Type your answer below:</i>`,
    { parse_mode: 'HTML' }
  );
}

export async function handleTheoryAnswer(ctx: any): Promise<void> {
  const session = await redis.getSession(ctx.from.id);
  if (!session?.theoryQuestionId) {
    await redis.updateSession(ctx.from.id, { mode: null });
    return;
  }

  const userAnswer = (ctx.message?.text || '').trim();
  if (!userAnswer) return;

  const { rows } = await pool.query(
    `SELECT id, question_text, worked_solution, subject, exam_type, year
     FROM theory_questions WHERE id = $1`,
    [session.theoryQuestionId]
  );
  const q = rows[0];

  await redis.updateSession(ctx.from.id, { mode: null, theoryQuestionId: null });

  if (!q) {
    await ctx.reply('Question not found. Please try /theory again.');
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (user) {
    await db.logTheoryAttempt(user.id, q.id, userAnswer);
  }

  const solutionBlock = q.worked_solution
    ? `\n\n📖 <b>Worked Solution:</b>\n${q.worked_solution}`
    : '';

  await ctx.reply(
    `✅ <b>Answer received!</b>\n\nYour answer: <i>${userAnswer}</i>${solutionBlock}\n\n<i>Use /theory for another question.</i>`,
    { parse_mode: 'HTML' }
  );
}
