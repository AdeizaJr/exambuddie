// src/bot/handlers/phone.ts — optional phone-number ask, shown only once a student
// has actually used the bot (asking during signup cost us people before their first
// question).
import * as db from '../../db';
import * as redis from '../../services/redis';
import { User } from '../../types';

export const PHONE_ASK_MIN_ATTEMPTS = 10;

// Shows the "share your phone number" keyboard if this user has no number on file,
// has not been asked recently, and has answered enough questions to care. Safe to call
// at any natural pause (end of a session, /start). Returns true if the ask was shown.
export async function maybeAskPhone(ctx: any, user: User | null, totalAttempts?: number): Promise<boolean> {
  try {
    if (!user || user.phone_number) return false;
    if (await redis.hasSeenPhoneNudge(ctx.from.id)) return false;

    const attempts = totalAttempts ?? Number((await db.getUserStats(user.id)).total_attempts);
    if (attempts < PHONE_ASK_MIN_ATTEMPTS) return false;

    await redis.markPhoneNudgeSent(ctx.from.id);
    await redis.setPhonePending(ctx.from.id);
    await ctx.reply(
      '📱 <b>Quick one!</b> Share your phone number so we can reach you about your subscription and account.\n\n<i>Optional — tap Skip if you prefer not to.</i>',
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
    return true;
  } catch {
    return false; // never let an optional ask break the flow it was attached to
  }
}
