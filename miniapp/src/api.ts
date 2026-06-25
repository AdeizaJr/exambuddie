import { tg } from './telegram';
import type { User, Question, Stats, QuizResult } from './types';

export interface LeaderboardEntry {
  rank: number;
  first_name: string;
  telegram_id: number;
  correct: number;
  total: number;
  accuracy: number;
}

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/miniapp';

// In dev mode, send x-dev-user-id so the backend bypasses initData validation.
// Set VITE_DEV_USER_ID in miniapp/.env.local to your Telegram user ID.
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID;

// Session-scoped TTL cache — avoids redundant fetches across page mounts
const _cache = new Map<string, { data: unknown; expires: number }>();

function cacheGet<T>(key: string): T | null {
  const e = _cache.get(key);
  if (e && Date.now() < e.expires) return e.data as T;
  _cache.delete(key);
  return null;
}

function cacheSet(key: string, data: unknown, ttlMs: number) {
  _cache.set(key, { data, expires: Date.now() + ttlMs });
}

export function invalidateCache(key?: string) {
  if (key) _cache.delete(key);
  else _cache.clear();
}

function authHeader(): Record<string, string> {
  const initData = tg?.initData || '';
  const headers: Record<string, string> = {
    'Authorization': `tma ${initData}`,
    'Content-Type': 'application/json',
  };
  if (import.meta.env.DEV && DEV_USER_ID) {
    headers['x-dev-user-id'] = String(DEV_USER_ID);
  }
  return headers;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeader(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getMe: () => {
    const cached = cacheGet<User>('me');
    if (cached) return Promise.resolve(cached);
    return req<User>('GET', '/me').then(u => { cacheSet('me', u, 30_000); return u; });
  },

  getTopics: (subject: string, examType?: string) => {
    const qs = new URLSearchParams({ subject });
    if (examType) qs.set('examType', examType);
    const key = `topics:${subject}:${examType ?? ''}`;
    const cached = cacheGet<string[]>(key);
    if (cached) return Promise.resolve(cached);
    return req<string[]>('GET', `/topics?${qs}`).then(t => { cacheSet(key, t, 300_000); return t; });
  },

  getQuestion: (params: {
    subject: string;
    examType: string;
    excludeIds?: number[];
    year?: number | null;
    topic?: string | null;
  }) => {
    const qs = new URLSearchParams({
      subject: params.subject,
      examType: params.examType,
    });
    if (params.year) qs.set('year', String(params.year));
    if (params.excludeIds?.length) qs.set('excludeIds', params.excludeIds.join(','));
    if (params.topic) qs.set('topic', params.topic);
    return req<Question | null>('GET', `/question?${qs}`);
  },

  submitAnswer: (body: {
    questionId: number;
    selectedOption: string;
    sessionId: string;
    timeTakenMs: number;
    subject: string;
  }) => req<{ ok: boolean }>('POST', '/answer', body),

  getStats: (examType?: string) => {
    const qs = examType ? `?examType=${examType}` : '';
    return req<Stats>('GET', `/stats${qs}`);
  },

  startQuiz: (body: { subject: string; examType: string }) =>
    req<{ questions: Question[]; sessionId: string }>('POST', '/quiz/start', body),

  completeQuiz: (body: {
    sessionId: string;
    subject: string;
    answers: { qId: number; selected: string; correct: string; isCorrect: boolean }[];
    durationSecs: number;
  }) => req<QuizResult>('POST', '/quiz/complete', body),

  getWeakTopics: (subject: string) => {
    const key = `weak:${subject}`;
    const cached = cacheGet<{ topic: string; accuracy: number }[]>(key);
    if (cached) return Promise.resolve(cached);
    return req<{ topic: string; accuracy: number }[]>('GET', `/weak-topics?subject=${subject}`)
      .then(t => { cacheSet(key, t, 120_000); return t; });
  },

  getDrillQuestions: (subject: string, topic: string) =>
    req<Question[]>('GET', `/drill?subject=${subject}&topic=${encodeURIComponent(topic)}`),

  updateProfile: (body: { exam_type?: string; subjects?: string[] }) =>
    req<User>('PUT', '/me', body),

  checkDailyLimit: () =>
    req<{ allowed: boolean; used: number; limit: number }>('GET', '/limit'),

  getBookmarks: () => req<Question[]>('GET', '/bookmarks'),

  addBookmark: (questionId: number) =>
    req<{ ok: boolean }>('POST', `/bookmarks/${questionId}`),

  removeBookmark: (questionId: number) =>
    req<{ ok: boolean }>('DELETE', `/bookmarks/${questionId}`),

  checkBookmark: (questionId: number) =>
    req<{ bookmarked: boolean }>('GET', `/bookmarks/${questionId}/check`),

  getLeaderboard: () =>
    req<{ entries: LeaderboardEntry[]; myRank: number | null }>('GET', '/leaderboard'),
};
