// src/bot/handlers/timetable.ts — 2026 exam timetable & subject-specific reminders
import * as db from '../../db';
import { SUBJECT_MAP, SUBJECT_EMOJI } from '../formatter';

// Approximate 2026 dates — updated once official timetables are published
export const WAEC_2026: Record<string, string> = {
  english:          '2026-05-04',
  accounts:         '2026-05-11',
  math:             '2026-05-14',
  commerce:         '2026-05-18',
  biology:          '2026-05-21',
  'home-economics': '2026-05-25',
  chemistry:        '2026-05-28',
  crk:              '2026-06-01',
  irk:              '2026-06-01',
  physics:          '2026-06-04',
  economics:        '2026-06-08',
  government:       '2026-06-11',
  agric:            '2026-06-15',
  geography:        '2026-06-16',
  'further-math':   '2026-06-17',
  literature:       '2026-06-22',
  history:          '2026-06-23',
};

export const NECO_2026: Record<string, string> = {
  english:          '2026-05-18',
  math:             '2026-05-27',
  biology:          '2026-06-02',
  chemistry:        '2026-06-09',
  physics:          '2026-06-16',
  economics:        '2026-06-22',
  government:       '2026-06-25',
  'further-math':   '2026-06-30',
  literature:       '2026-07-06',
  agric:            '2026-07-09',
  geography:        '2026-07-13',
  crk:              '2026-07-15',
};

// JAMB UTME: single unified exam date (all subjects same day)
export const JAMB_2026 = '2026-04-14';

// Re-stamps a 'YYYY-MM-DD' date onto a different year, keeping month/day.
export function withYear(iso: string, year: number): string {
  return `${year}${iso.slice(4)}`;
}

// This year's sitting if it hasn't happened yet, otherwise next year's — each subject
// rolls forward independently, since a season spans ~2 months and some subjects will
// already be written while later ones aren't (e.g. checking in mid-June: English/Math
// are done, but Government/Agric are still ahead).
export function nextOccurrence(iso: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thisYear = withYear(iso, now.getFullYear());
  return new Date(thisYear) < now ? withYear(iso, now.getFullYear() + 1) : thisYear;
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
  if (examType === 'JAMB') return nextOccurrence(JAMB_2026) === today ? ['ALL'] : [];
  const table = examType === 'NECO' ? NECO_2026 : WAEC_2026;
  return userSubjects.filter(s => table[s] && nextOccurrence(table[s]) === today);
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

  let text = `📅 <b>${examType} Timetable</b>\n`;
  text += `<i>(Approximate dates — verify with official WAEC/JAMB/NECO site)</i>\n\n`;

  if (examType === 'JAMB') {
    const jambIso = nextOccurrence(JAMB_2026);
    const days = daysUntil(new Date(jambIso));
    text += `🎯 <b>JAMB UTME:</b> ${formatDate(jambIso)} — <b>${urgencyLabel(days)}</b>\n`;
    text += `\n<i>JAMB CBT tests all your subjects on the same day.</i>`;
  } else {
    const baseTimetable = examType === 'NECO' ? NECO_2026 : WAEC_2026;
    const timetable = Object.fromEntries(
      Object.entries(baseTimetable).map(([s, iso]) => [s, nextOccurrence(iso)])
    );

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
