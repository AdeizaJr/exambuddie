// src/bot/handlers/theory.ts
// WAEC theory/practical practice: show a question, the student types an answer
// (or taps Show answer), then we reveal the model answer. Attempts are saved to
// theory_attempts so we do not repeat a question until the subject is used up.
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';
import { TheoryQuestion } from '../../db';
import { User } from '../../types';

const MAX_MSG = 3900; // Telegram caps messages at 4096 chars
const MAX_ANSWER_SAVE = 4000;

// Split escaped HTML text into Telegram-sized chunks on line breaks (or spaces for
// a very long line), so an entity like &amp; is never cut in half.
function chunk(text: string, limit = MAX_MSG): string[] {
  const out: string[] = [];
  let cur = '';
  const push = () => { if (cur.trim()) out.push(cur); cur = ''; };
  for (const line of text.split('\n')) {
    let rest = line;
    while (rest.length > limit) {
      let cut = rest.lastIndexOf(' ', limit);
      if (cut <= 0) cut = limit;
      const amp = rest.lastIndexOf('&', cut);
      if (amp > cut - 8 && rest.indexOf(';', amp) >= cut) cut = amp;
      push();
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (cur.length + rest.length + 1 > limit) push();
    cur += (cur ? '\n' : '') + rest;
  }
  push();
  return out;
}

async function sendLong(ctx: any, text: string, replyMarkup?: any): Promise<void> {
  const parts = chunk(text);
  for (let i = 0; i < parts.length; i++) {
    const last = i === parts.length - 1;
    await ctx.reply(parts[i], { parse_mode: 'HTML', ...(last && replyMarkup ? { reply_markup: replyMarkup } : {}) });
  }
}

function header(q: TheoryQuestion): string {
  const kind = q.paper_type === 'practical' ? 'Practical' : 'Theory';
  const num = q.question_number ? ` • Q${q.question_number}` : '';
  const subject = fmt.SUBJECT_MAP[q.subject] || q.subject;
  return `✍️ <b>${kind} Question</b>\n${fmt.SUBJECT_EMOJI[q.subject] || '📖'} ${subject} • ${q.exam_type} ${q.year}${num}`;
}

function questionKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '👀 Show answer', callback_data: 'theory:reveal' }, { text: '⏭ Skip', callback_data: 'theory:skip' }],
      [{ text: '⏹ Stop', callback_data: 'theory:stop' }],
    ],
  };
}

function afterRevealKeyboard(subject: string) {
  return {
    inline_keyboard: [
      [{ text: '➡️ Next question', callback_data: 'theory:next' }],
      [{ text: '📅 Change year', callback_data: `theory:subject:${subject}` }, { text: '🔄 Change subject', callback_data: 'theory:pick' }],
      [{ text: '⏹ Stop', callback_data: 'theory:stop' }],
    ],
  };
}

function subjectKeyboard(subjects: string[], counts: Record<string, number>) {
  const sorted = [...subjects].sort((a, b) => (fmt.SUBJECT_MAP[a] || a).localeCompare(fmt.SUBJECT_MAP[b] || b));
  const buttons = sorted.map(s => ({
    text: `${fmt.SUBJECT_EMOJI[s] || '📖'} ${fmt.SUBJECT_MAP[s] || s} (${(counts[s] || 0).toLocaleString()})`,
    callback_data: `theory:subject:${s}`,
  }));
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([{ text: '➕ Add / Remove Subjects', callback_data: 'practice:add_subject' }]);
  return { inline_keyboard: rows };
}

// /theory, the menu button, or "Change subject"
export async function handleTheory(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
  const user = await db.getUser(ctx.from.id);
  if (!user || !user.exam_type) { await ctx.reply('Please set up your profile first using /start'); return; }

  const counts = await db.getTheorySubjectCounts(user.subjects);
  const available = user.subjects.filter(s => counts[s] > 0);
  if (!available.length) {
    await ctx.reply(
      '✍️ <b>Theory Practice</b>\n\nNone of your subjects have theory questions yet. Add a subject with theory papers to try it.',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '➕ Add / Remove Subjects', callback_data: 'practice:add_subject' }]] } }
    );
    return;
  }
  await ctx.reply(
    '✍️ <b>Theory Practice</b>\n\nReal WAEC Paper 2 and practical questions. Type your answer, then compare it with the model answer.\n\nWhich subject?',
    { parse_mode: 'HTML', reply_markup: subjectKeyboard(available, counts) }
  );
}

// Subject picked (from /theory or the practice Objective / Theory choice): pick a year
export async function handleTheorySubject(ctx: any): Promise<void> {
  await ctx.answerCbQuery().catch(() => {});
  const subject = ctx.callbackQuery.data.split(':')[2];
  const years = await db.getTheoryYearCounts(subject);
  if (!years.length) {
    await ctx.reply(`No theory questions for ${fmt.SUBJECT_MAP[subject] || subject} yet.`);
    return;
  }
  const total = years.reduce((n, y) => n + y.count, 0);
  const rows: any[][] = [[{ text: `📅 Any Year (${total.toLocaleString()})`, callback_data: `theory:year:${subject}:any` }]];
  const buttons = years.map(y => ({ text: `${y.year} (${y.count})`, callback_data: `theory:year:${subject}:${y.year}` }));
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  rows.push([{ text: '← Back to Subjects', callback_data: 'theory:pick' }]);
  await ctx.reply(
    `📅 <b>${fmt.SUBJECT_MAP[subject] || subject} Theory</b>\n\nWhich year would you like to practise?`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
  );
}

export async function handleTheoryYear(ctx: any): Promise<void> {
  await ctx.answerCbQuery().catch(() => {});
  const [, , subject, yearStr] = ctx.callbackQuery.data.split(':');
  const year = yearStr && yearStr !== 'any' ? parseInt(yearStr, 10) : null;
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  await redis.setSession(ctx.from.id, { mode: 'theory_attempt', subject, theoryYear: year, theorySeen: [], theoryDone: 0 });
  await sendNextTheory(ctx, user, subject);
}

async function sendNextTheory(ctx: any, user: User, subject: string): Promise<void> {
  if (user.plan !== 'premium') {
    const usage = await redis.getSubjectUsage(ctx.from.id, subject);
    if (usage.count >= fmt.SUBJECT_Q_LIMIT) {
      await ctx.reply(
        fmt.subjectLimitMessage(fmt.SUBJECT_MAP[subject] || subject, usage.expiresAt - Date.now()),
        { parse_mode: 'HTML', reply_markup: fmt.subjectLimitKeyboard(user.plan) }
      );
      return;
    }
  }

  const session = (await redis.getSession(ctx.from.id)) || {};
  const seen: number[] = session.theorySeen || [];
  const year: number | null = session.theoryYear ?? null;
  const q = await db.getRandomTheoryQuestion(subject, user.id, seen.slice(-200), year);
  if (!q) {
    await ctx.reply(`No theory questions for ${fmt.SUBJECT_MAP[subject] || subject}${year ? ` ${year}` : ''} yet.`);
    return;
  }

  await redis.updateSession(ctx.from.id, {
    mode: 'theory_attempt',
    step: 'theory_answer',
    subject,
    theoryQuestionId: q.id,
    theorySeen: [...seen, q.id],
  });
  if (user.plan !== 'premium') await redis.incrementSubjectUsage(ctx.from.id, subject);

  await sendLong(ctx, `${header(q)}\n\n${fmt.escHtml(q.question_text)}`);
  for (const url of (q.image_urls || []).slice(0, 6)) {
    try {
      await ctx.replyWithPhoto(url);
    } catch (err) {
      console.error(`[theory] image failed for question ${q.id}:`, (err as Error).message);
      await ctx.reply(`🖼 Figure: ${url}`, { link_preview_options: { is_disabled: true } }).catch(() => {});
    }
  }
  await ctx.reply(
    '✍️ <b>Type your answer below</b> and send it. I will then show you the model answer.\n<i>Not sure? Tap Show answer.</i>',
    { parse_mode: 'HTML', reply_markup: questionKeyboard() }
  );
}

async function reveal(ctx: any, answer: string | null): Promise<void> {
  const telegramId = ctx.from.id;
  if (!(await redis.acquireActionLock(telegramId, 'theory:answer'))) return;
  const session = await redis.getSession(telegramId);
  if (session?.mode !== 'theory_attempt' || session.step !== 'theory_answer' || !session.theoryQuestionId) {
    await ctx.reply('That question is already answered. Tap /theory for a new one.');
    return;
  }
  await redis.updateSession(telegramId, { step: 'theory_revealed', theoryDone: (session.theoryDone || 0) + 1 });

  const q = await db.getTheoryQuestion(session.theoryQuestionId);
  if (!q) { await ctx.reply('Question not found. Please try /theory again.'); return; }

  const user = await db.getUser(telegramId);
  if (user) await db.logTheoryAttempt(user.id, q.id, answer ? answer.slice(0, MAX_ANSWER_SAVE) : null).catch(err =>
    console.error(`[theory] failed to log attempt for ${telegramId}:`, err.message));

  const intro = answer
    ? '✅ <b>Answer saved.</b> Compare it with the model answer below. WAEC gives marks for each key point, so check which points you covered.'
    : '📘 Here is the model answer. Read it, then try writing it from memory.';
  const solution = q.worked_solution
    ? `📘 <b>Model answer</b>\n\n${fmt.escHtml(q.worked_solution)}`
    : '📘 No model answer is available for this question yet.';
  await sendLong(ctx, `${intro}\n\n${solution}`, afterRevealKeyboard(q.subject));
}

// Free text while a theory question is waiting for an answer
export async function handleTheoryAnswer(ctx: any): Promise<void> {
  const text: string = ctx.message?.text?.trim() || '';
  if (!text) return;
  await reveal(ctx, text);
}

export async function handleTheoryReveal(ctx: any): Promise<void> {
  await ctx.answerCbQuery().catch(() => {});
  await reveal(ctx, null);
}

export async function handleTheoryNext(ctx: any): Promise<void> {
  await ctx.answerCbQuery().catch(() => {});
  const session = await redis.getSession(ctx.from.id);
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  if (session?.mode !== 'theory_attempt' || !session.subject) return handleTheory(ctx);
  await sendNextTheory(ctx, user, session.subject);
}

export async function handleTheoryStop(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
  const session = await redis.getSession(ctx.from.id);
  const done = session?.mode === 'theory_attempt' ? session.theoryDone || 0 : 0;
  await redis.clearSession(ctx.from.id);
  await ctx.reply(
    `⏹ <b>Theory session ended.</b>\n\nYou worked through ${done} question${done === 1 ? '' : 's'}. Keep it up!`,
    { parse_mode: 'HTML', reply_markup: fmt.persistentMenuKeyboard() }
  );
}

// Subject picker tap in /practice: subjects that have theory papers get an
// Objective / Theory choice first.
export function practiceModeKeyboard(subject: string) {
  return {
    inline_keyboard: [
      [{ text: '🔘 Objective (A to D)', callback_data: `practice:mode_obj:${subject}` }],
      [{ text: '✍️ Theory (WAEC Paper 2 and practicals)', callback_data: `theory:subject:${subject}` }],
      [{ text: '← Back to Subjects', callback_data: 'practice:pick' }],
    ],
  };
}
