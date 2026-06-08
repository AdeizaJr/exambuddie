import type { Stats, Flag, Question, User, Subscription, Analytics, PaginatedResponse } from './types';

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/admin';

function getToken(): string {
  return localStorage.getItem('admin_token') || '';
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  let url = BASE + path;
  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += '?' + qs;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function loginAdmin(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch(BASE + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>('PUT', '/password', { currentPassword, newPassword });
}

export async function getStats(): Promise<Stats> {
  return req<Stats>('GET', '/stats');
}

export async function getFlags(): Promise<Flag[]> {
  return req<Flag[]>('GET', '/flags');
}

export async function resolveFlag(id: number, explanation?: string): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>('POST', `/flags/${id}/resolve`, { explanation });
}

export interface QuestionsFilter {
  page?: number;
  limit?: number;
  subject?: string;
  exam_type?: string;
  year?: number;
  search?: string;
}

export async function getQuestions(filter: QuestionsFilter = {}): Promise<PaginatedResponse<Question>> {
  return req<PaginatedResponse<Question>>('GET', '/questions', undefined, filter as Record<string, string | number | undefined>);
}

export async function updateQuestion(id: number, data: Partial<Question>): Promise<Question> {
  return req<Question>('PUT', `/questions/${id}`, data);
}

export async function deleteQuestion(id: number): Promise<{ ok: boolean; deleted: number }> {
  return req<{ ok: boolean; deleted: number }>('DELETE', `/questions/${id}`);
}

export interface UsersFilter {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getUsers(filter: UsersFilter = {}): Promise<PaginatedResponse<User>> {
  return req<PaginatedResponse<User>>('GET', '/users', undefined, filter as Record<string, string | number | undefined>);
}

export async function updateUserPlan(
  telegramId: number,
  plan: 'premium' | 'free',
  months?: number
): Promise<User> {
  return req<User>('PUT', `/users/${telegramId}/plan`, { plan, months });
}

export async function getSubscriptions(): Promise<Subscription[]> {
  return req<Subscription[]>('GET', '/subscriptions');
}

export async function getAnalytics(): Promise<Analytics> {
  return req<Analytics>('GET', '/analytics');
}

export type BroadcastTarget = 'all' | 'waec' | 'jamb' | 'neco' | 'premium' | 'free';

export async function broadcast(
  message: string,
  target: BroadcastTarget
): Promise<{ sent: number; failed: number; total: number }> {
  return req<{ sent: number; failed: number; total: number }>('POST', '/broadcast', { message, target });
}
