// src/services/redis.ts — In-memory fallback (no Redis required)
const store = new Map<string, any>();

const SUBJECT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

interface SubjectUsage {
  count: number;
  expiresAt: number;
}

export const getSubjectUsage = async (
  telegramId: number | string,
  subject: string
): Promise<SubjectUsage> => {
  const entry: SubjectUsage | undefined = store.get(`sublimit:${telegramId}:${subject}`);
  if (!entry || Date.now() > entry.expiresAt) {
    return { count: 0, expiresAt: Date.now() + SUBJECT_WINDOW_MS };
  }
  return entry;
};

export const incrementSubjectUsage = async (
  telegramId: number | string,
  subject: string
): Promise<SubjectUsage> => {
  const key = `sublimit:${telegramId}:${subject}`;
  let entry: SubjectUsage = store.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    entry = { count: 0, expiresAt: Date.now() + SUBJECT_WINDOW_MS };
  }
  entry = { ...entry, count: entry.count + 1 };
  store.set(key, entry);
  return entry;
};

export const getSession = async (telegramId: number | string): Promise<any> => {
  return store.get(`session:${telegramId}`) || null;
};

export const setSession = async (telegramId: number | string, data: any): Promise<void> => {
  store.set(`session:${telegramId}`, data);
};

export const clearSession = async (telegramId: number | string): Promise<void> => {
  store.delete(`session:${telegramId}`);
};

export const updateSession = async (telegramId: number | string, updates: any): Promise<any> => {
  const current = store.get(`session:${telegramId}`) || {};
  const updated = { ...current, ...updates };
  store.set(`session:${telegramId}`, updated);
  return updated;
};

export const checkBurst = async (_telegramId: number | string): Promise<boolean> => {
  return false; // no burst limiting without Redis
};

export const saveQuizState = async (telegramId: number | string, quizData: any): Promise<void> => {
  store.set(`quiz:${telegramId}`, quizData);
};

export const getQuizState = async (telegramId: number | string): Promise<any> => {
  return store.get(`quiz:${telegramId}`) || null;
};

export const clearQuizState = async (telegramId: number | string): Promise<void> => {
  store.delete(`quiz:${telegramId}`);
};

export const deleteUserData = async (telegramId: number | string): Promise<void> => {
  for (const key of store.keys()) {
    if (
      key === `session:${telegramId}` ||
      key === `quiz:${telegramId}` ||
      key.startsWith(`sublimit:${telegramId}:`)
    ) {
      store.delete(key);
    }
  }
};

export const getClient = async (): Promise<null> => {
  return null;
};
