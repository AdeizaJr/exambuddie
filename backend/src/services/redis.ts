// src/services/redis.ts — Redis-backed session/state store
import { createClient, RedisClientType } from 'redis';

const client: RedisClientType = createClient({ url: process.env.REDIS_URL });
client.on('error', (err) => console.error('[redis] client error:', err.message));
client.connect().catch((err) => console.error('[redis] failed to connect:', err.message));

const SUBJECT_WINDOW_SECS = 6 * 60 * 60; // 6 hours
const SESSION_TTL_SECS = 6 * 60 * 60; // abandoned sessions/quizzes expire after 6 hours
const BURST_WINDOW_SECS = 3;
const BURST_MAX_ACTIONS = 8;

interface SubjectUsage {
  count: number;
  expiresAt: number;
}

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await client.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setJson(key: string, value: unknown, ttlSecs: number): Promise<void> {
  await client.set(key, JSON.stringify(value), { EX: ttlSecs });
}

export const getSubjectUsage = async (
  telegramId: number | string,
  subject: string
): Promise<SubjectUsage> => {
  const key = `sublimit:${telegramId}:${subject}`;
  const entry = await getJson<SubjectUsage>(key);
  if (!entry) {
    return { count: 0, expiresAt: Date.now() + SUBJECT_WINDOW_SECS * 1000 };
  }
  return entry;
};

export const incrementSubjectUsage = async (
  telegramId: number | string,
  subject: string
): Promise<SubjectUsage> => {
  const key = `sublimit:${telegramId}:${subject}`;
  const existing = await getJson<SubjectUsage>(key);
  const entry: SubjectUsage = existing
    ? { ...existing, count: existing.count + 1 }
    : { count: 1, expiresAt: Date.now() + SUBJECT_WINDOW_SECS * 1000 };
  const ttlSecs = Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  await setJson(key, entry, ttlSecs);
  return entry;
};

export const getSession = async (telegramId: number | string): Promise<any> => {
  return getJson(`session:${telegramId}`);
};

export const setSession = async (telegramId: number | string, data: any): Promise<void> => {
  await setJson(`session:${telegramId}`, data, SESSION_TTL_SECS);
};

export const clearSession = async (telegramId: number | string): Promise<void> => {
  await client.del(`session:${telegramId}`);
};

export const updateSession = async (telegramId: number | string, updates: any): Promise<any> => {
  const current = (await getJson<any>(`session:${telegramId}`)) || {};
  const updated = { ...current, ...updates };
  await setJson(`session:${telegramId}`, updated, SESSION_TTL_SECS);
  return updated;
};

// Returns true when the user has exceeded BURST_MAX_ACTIONS within BURST_WINDOW_SECS
export const checkBurst = async (telegramId: number | string): Promise<boolean> => {
  const key = `burst:${telegramId}`;
  const count = await client.incr(key);
  if (count === 1) await client.expire(key, BURST_WINDOW_SECS);
  return count > BURST_MAX_ACTIONS;
};

export const saveQuizState = async (telegramId: number | string, quizData: any): Promise<void> => {
  await setJson(`quiz:${telegramId}`, quizData, SESSION_TTL_SECS);
};

export const getQuizState = async (telegramId: number | string): Promise<any> => {
  return getJson(`quiz:${telegramId}`);
};

export const clearQuizState = async (telegramId: number | string): Promise<void> => {
  await client.del(`quiz:${telegramId}`);
};

const PHONE_NUDGE_TTL_SKIP  = 60 * 60 * 24 * 7;  // 7 days — re-show after a week if skipped
const PHONE_NUDGE_TTL_SHOWN = 60 * 60 * 24 * 30; // 30 days — suppress while nudge is pending action

export const hasSeenPhoneNudge = async (telegramId: number | string): Promise<boolean> => {
  const val = await client.get(`phone_nudge:${telegramId}`);
  return val !== null;
};

export const markPhoneNudgeSent = async (telegramId: number | string): Promise<void> => {
  await client.set(`phone_nudge:${telegramId}`, '1', { EX: PHONE_NUDGE_TTL_SHOWN });
};

export const snoozePhoneNudge = async (telegramId: number | string): Promise<void> => {
  await client.set(`phone_nudge:${telegramId}`, '1', { EX: PHONE_NUDGE_TTL_SKIP });
};

// Tracks that the phone keyboard is currently shown (separate from session so it doesn't clash with practice/quiz)
export const setPhonePending = async (telegramId: number | string): Promise<void> => {
  await client.set(`phone_pending:${telegramId}`, '1', { EX: 3600 });
};

export const getPhonePending = async (telegramId: number | string): Promise<boolean> => {
  return (await client.get(`phone_pending:${telegramId}`)) !== null;
};

export const clearPhonePending = async (telegramId: number | string): Promise<void> => {
  await client.del(`phone_pending:${telegramId}`);
};

export const setSupportStep = async (telegramId: number | string, step: string): Promise<void> => {
  await client.set(`support_step:${telegramId}`, step, { EX: 1800 });
};
export const getSupportStep = async (telegramId: number | string): Promise<string | null> => {
  return client.get(`support_step:${telegramId}`);
};
export const clearSupportStep = async (telegramId: number | string): Promise<void> => {
  await client.del(`support_step:${telegramId}`);
};

const QUIZ_RESULT_TTL = 60 * 60; // 1 hour

export interface QuizResultSummary {
  subject: string;
  correct: number;
  total: number;
  accuracy: number;
  durationSecs: number;
}

export const saveQuizResult = async (telegramId: number | string, result: QuizResultSummary): Promise<void> => {
  await setJson(`quiz_result:${telegramId}`, result, QUIZ_RESULT_TTL);
};

export const getQuizResult = async (telegramId: number | string): Promise<QuizResultSummary | null> => {
  return getJson<QuizResultSummary>(`quiz_result:${telegramId}`);
};

export const getCachedAdminStats = async (): Promise<Record<string, unknown> | null> => {
  return getJson<Record<string, unknown>>('cache:admin_stats');
};

export const setCachedAdminStats = async (data: Record<string, unknown>): Promise<void> => {
  await setJson('cache:admin_stats', data, 30); // 30-second TTL
};

export const getCachedUser = async (telegramId: number | string): Promise<Record<string, unknown> | null> => {
  return getJson<Record<string, unknown>>(`user_cache:${telegramId}`);
};

export const setCachedUser = async (telegramId: number | string, user: unknown): Promise<void> => {
  await setJson(`user_cache:${telegramId}`, user, 60); // 60-second TTL
};

export const clearCachedUser = async (telegramId: number | string): Promise<void> => {
  await client.del(`user_cache:${telegramId}`);
};

const QUIZ_REVIEW_TTL = 30 * 60; // 30 minutes

export interface QuizReviewItem {
  question: any;
  selected: string;
  correct: string;
}

export const setQuizReview = async (telegramId: number | string, items: QuizReviewItem[]): Promise<void> => {
  await setJson(`quiz_review:${telegramId}`, items, QUIZ_REVIEW_TTL);
};

export const getQuizReview = async (telegramId: number | string): Promise<QuizReviewItem[] | null> => {
  return getJson<QuizReviewItem[]>(`quiz_review:${telegramId}`);
};

export const clearQuizReview = async (telegramId: number | string): Promise<void> => {
  await client.del(`quiz_review:${telegramId}`);
};

export const deleteUserData = async (telegramId: number | string): Promise<void> => {
  const keys = await client.keys(`*${telegramId}*`);
  const toDelete = keys.filter(
    (key) =>
      key === `session:${telegramId}` ||
      key === `quiz:${telegramId}` ||
      key === `burst:${telegramId}` ||
      key === `phone_nudge:${telegramId}` ||
      key === `phone_pending:${telegramId}` ||
      key === `support_step:${telegramId}` ||
      key === `user_cache:${telegramId}` ||
      key === `quiz_review:${telegramId}` ||
      key.startsWith(`sublimit:${telegramId}:`)
  );
  if (toDelete.length) await client.del(toDelete);
};
