// src/services/outreach.ts — guard rails for messages the bot sends on its own
// (cron nudges, daily facts, QOTD) rather than in reply to something the user did.
import { AsyncLocalStorage } from 'async_hooks';
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

// ── Per-user log of automatic messages ──────────────────────────────────────
// Every cron job runs inside cronJob.run(name, ...), so any Telegram send made
// while it runs knows which job sent it. withSendLogging() wraps bot.telegram so
// those sends land in bot_message_log and show up in the admin "Messages" tab.
// Sends made outside a cron job (replies to the user) are not logged.
const cronJob = new AsyncLocalStorage<string>();

export function runAsJob<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return cronJob.run(name, fn);
}

// Telegram HTML -> readable plain text for the admin view.
function toPlainText(html: string): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .slice(0, 4000);
}

function failureReason(err: any): string {
  return String(err?.response?.description || err?.description || err?.message || err).slice(0, 500);
}

export function withSendLogging<T extends object>(telegram: T): T {
  return new Proxy(telegram, {
    get(target: any, prop, _receiver) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') return value;
      if (prop !== 'sendMessage' && prop !== 'sendPhoto') return value.bind(target);
      return async (chatId: number | string, payload: any, extra?: any) => {
        const job = cronJob.getStore();
        const text = prop === 'sendMessage'
          ? toPlainText(payload)
          : `🖼 ${toPlainText(extra?.caption ?? '(photo)')}`;
        try {
          const result = await value.call(target, chatId, payload, extra);
          if (job) db.logBotMessage(chatId, job, text, true, null).catch(() => {});
          return result;
        } catch (err) {
          if (job) db.logBotMessage(chatId, job, text, false, failureReason(err)).catch(() => {});
          throw err;
        }
      };
    },
  });
}
