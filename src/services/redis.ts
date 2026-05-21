// src/services/redis.ts — In-memory fallback (no Redis required)
const store = new Map<string, any>();

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

export const getClient = async (): Promise<null> => {
  return null;
};
