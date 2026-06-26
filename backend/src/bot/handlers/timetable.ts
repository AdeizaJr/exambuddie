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

export function getExamDate(examType: string, subject: string): Date | null {
  if (examType === 'JAMB') return new Date(JAMB_2026);
  const map = examType === 'NECO' ? NECO_2026 : WAEC_2026;
  const iso = map[subject];
  return iso ? new Date(iso) : null;
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
  return new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
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

  const year = 2026;
  let text = `📅 <b>${examType} ${year} Timetable</b>\n`;
  text += `<i>(Approximate dates — verify with official WAEC/JAMB/NECO site)</i>\n\n`;

  if (examType === 'JAMB') {
    const date = new Date(JAMB_2026);
    const days = daysUntil(date);
    text += `🎯 <b>JAMB UTME:</b> ${formatDate(JAMB_2026)} — <b>${urgencyLabel(days)}</b>\n`;
    text += `\n<i>JAMB CBT tests all your subjects on the same day.</i>`;
  } else {
    const timetable = examType === 'NECO' ? NECO_2026 : WAEC_2026;

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
        if (days < 0) continue; // skip past dates in "other" section
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
