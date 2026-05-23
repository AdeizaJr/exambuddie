import { tg } from './telegram';
import type { User, Question, Stats, QuizResult } from './types';

const BASE = '/api/miniapp';

// In dev mode, send x-dev-user-id so the backend bypasses initData validation.
// Set VITE_DEV_USER_ID in miniapp/.env.local to your Telegram user ID.
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID;

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
  getMe: () => req<User>('GET', '/me'),

  getQuestion: (params: {
    subject: string;
    examType: string;
    excludeIds?: number[];
    year?: number | null;
  }) => {
    const qs = new URLSearchParams({
      subject: params.subject,
      examType: params.examType,
    });
    if (params.year) qs.set('year', String(params.year));
    if (params.excludeIds?.length) qs.set('excludeIds', params.excludeIds.join(','));
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

  getWeakTopics: (subject: string) =>
    req<{ topic: string; accuracy: number }[]>('GET', `/weak-topics?subject=${subject}`),

  getDrillQuestions: (subject: string, topic: string) =>
    req<Question[]>('GET', `/drill?subject=${subject}&topic=${encodeURIComponent(topic)}`),

  updateProfile: (body: { exam_type?: string; subjects?: string[] }) =>
    req<User>('PUT', '/me', body),

  checkDailyLimit: () =>
    req<{ allowed: boolean; used: number; limit: number }>('GET', '/limit'),
};
