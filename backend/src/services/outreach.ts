// src/services/outreach.ts — guard rails for messages the bot sends on its own
// (cron nudges, daily facts, QOTD) rather than in reply to something the user did.
import * as db from '../db';
import * as redis from './redis';

// Most unprompted messages one user gets per WAT day. Messages the user asked for
// (their own daily reminder, exam timetable alerts) or needs (subscription expiry,
// exam-day note) are not counted against this.
export const DAILY_UNPROMPTED_CAP = 3;

function watDate(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().split('T')[0];
}

// Reserve one of today's unprompted-message slots. Returns false when the user has
// already had their fill for the day, in which case the caller should skip the send.
// Fails open: if Redis is unreachable we would rather send than go silent.
export async function claimBudget(telegramId: number | string): Promise<boolean> {
  return redis.claimOutreachSlot(telegramId, watDate(), DAILY_UNPROMPTED_CAP).catch(() => true);
}

// Give a reserved slot back when the send did not actually go out.
export async function refundBudget(telegramId: number | string): Promise<void> {
  await redis.releaseOutreachSlot(telegramId, watDate()).catch(() => {});
}

// True when Telegram says this chat is gone for good: the user blocked the bot or
// deleted their account. Anything else (rate limit, network blip) is temporary.
export function isBlockedError(err: any): boolean {
  const reason: string = err?.response?.description || err?.description || err?.message || '';
  return /bot was blocked by the user|user is deactivated|chat not found/i.test(reason);
}

// Call from the catch of any proactive send. Records a block so later crons stop
// messaging this user and the admin dashboard can count who has left.
export async function noteSendFailure(telegramId: number | string, err: any): Promise<void> {
  if (!isBlockedError(err)) return;
  await db.markUserBlocked(telegramId).catch(() => {});
}
