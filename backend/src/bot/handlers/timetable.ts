// src/bot/handlers/timetable.ts — upcoming exam season timetable & subject-specific reminders
import * as db from '../../db';
import { SUBJECT_MAP, SUBJECT_EMOJI } from '../formatter';

// Fill these in only from the OFFICIAL timetables once WAEC/NECO/JAMB publish them.
// Until then they stay empty: /timetable shows the expected window instead, and the
// exam-day and countdown reminders stay silent rather than firing on guessed dates.
export const EXAM_SEASON = {
  year: 2027,
  waec: {} as Record<string, string>, // subject slug → 'YYYY-MM-DD'
  neco: {} as Record<string, string>,
  jamb: null as string | null, // UTME start date
  // Shown while the official dates above are missing. Based on the 2026 sittings.
  expected: {
    WAEC: 'April to June 2027',
    NECO: 'mid-June to late July 2027',
    JAMB: 'March to May 2027',
  } as Record<string, string>,
};

export function examTable(examType: string): Record<string, string> {
  return examType === 'NECO' ? EXAM_SEASON.neco : EXAM_SEASON.waec;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Which of a user's subjects (if any) have their exam sitting today. JAMB is a single
// unified date across all subjects, so a match returns the sentinel ['ALL'] rather than
// enumerating every subject the user picked.
export function todaysExamSubjects(examType: string, userSubjects: string[]): string[] {
  const today = todayIso();
  if (examType === 'JAMB') return EXAM_SEASON.jamb === today ? ['ALL'] : [];
  const table = examTable(examType);
  return userSubjects.filter(s => table[s] === today);
}

function daysUntil(date: Date): number {
  const now = new Date();
  const diff = date.setHours(0, 0, 0, 0) - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil(diff / 86400000);
}

function urgencyLabel(days: number): string {
  if (days < 0) return '✅ Done';
  if (days === 0) return '🔴 TODAY';
  if (days === 1) return '🔴 Tomorrow';
  if (days <= 3) return `🟠 ${days} days`;
  if (days <= 7) return `🟡 ${days} days`;
  if (days <= 14) return `📅 ${days} days`;
  return `📅 ${days} days`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export async function handleTimetable(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  const examType = user.exam_type;
  const subjects = user.subjects || [];

  if (!examType) {
    await ctx.reply('Set your exam type in /settings first.', { parse_mode: 'HTML' });
    return;
  }

  // 'ALL'/'BOTH' users get the WAEC table, same as examTable() falls back to
  const board = examType === 'JAMB' || examType === 'NECO' ? examType : 'WAEC';
  const official = board === 'JAMB' ? EXAM_SEASON.jamb !== null : Object.keys(examTable(board)).length > 0;
  const expected = EXAM_SEASON.expected[board];

  let text = `📅 <b>${board} ${EXAM_SEASON.year} Timetable</b>\n\n`;

  if (!official) {
    text += `The official ${board} ${EXAM_SEASON.year} timetable is not out yet.\n\n`;
    if (expected) text += `🗓 <b>Expected:</b> ${expected}\n\n`;
    text += `<i>Your exam dates will show here once ${board} publishes the official timetable. Until then, keep practising daily so you're ready whenever it starts.</i>`;
  } else if (board === 'JAMB') {
    const jambIso = EXAM_SEASON.jamb!;
    const days = daysUntil(new Date(jambIso));
    text += `🎯 <b>JAMB UTME:</b> ${formatDate(jambIso)} — <b>${urgencyLabel(days)}</b>\n`;
    text += `\n<i>JAMB CBT tests all your subjects on the same day.</i>`;
  } else {
    text += `<i>Official dates. Confirm with your school before each paper.</i>\n\n`;
    const timetable = examTable(board);

    // User's subjects first, sorted by date
    const userSubjectEntries = subjects
      .filter(s => timetable[s])
      .map(s => [s, timetable[s]] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1]));

    if (userSubjectEntries.length > 0) {
      text += `<b>Your Subjects:</b>\n`;
      for (const [s, iso] of userSubjectEntries) {
        const days = daysUntil(new Date(iso));
        const emoji = SUBJECT_EMOJI[s] || '📖';
        const name = SUBJECT_MAP[s] || s;
        text += `${emoji} <b>${name}</b>: ${formatDate(iso)} — ${urgencyLabel(days)}\n`;
      }
    }

    // Subjects not in user's list that have dates
    const otherEntries: [string, string][] = Object.entries(timetable)
      .filter(([s]) => !subjects.includes(s))
      .sort((a, b) => a[1].localeCompare(b[1]));

    if (otherEntries.length > 0) {
      text += `\n<b>Other Subjects:</b>\n`;
      for (const [s, iso] of otherEntries) {
        const days = daysUntil(new Date(iso));
        const emoji = SUBJECT_EMOJI[s] || '📖';
        const name = SUBJECT_MAP[s] || s;
        text += `${emoji} ${name}: ${formatDate(iso)} — ${urgencyLabel(days)}\n`;
      }
    }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📚 Practice Now', callback_data: 'practice:pick' }],
        [{ text: '⚙️ Update Subjects', callback_data: 'settings:subjects' }],
      ],
    },
  });
}
