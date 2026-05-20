// src/services/redis.ts
import { createClient, RedisClientType } from 'redis';
import { SessionState, QuizState } from '../types';

let client: RedisClientType | undefined;

export async function getClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL }) as RedisClientType;
    client.on('error', (err) => console.error('Redis error:', err));
    await client.connect();
  }
  return client;
}

const SESSION_TTL = 60 * 60 * 24; // 24 hours

// ── User session state ──────────────────────────────────────────────────────
export async function getSession(telegramId: number | string): Promise<SessionState | null> {
  const c = await getClient();
  const raw = await c.get(`session:${telegramId}`);
  return raw ? (JSON.parse(raw) as SessionState) : null;
}

export async function setSession(telegramId: number | string, data: SessionState): Promise<void> {
  const c = await getClient();
  await c.setEx(`session:${telegramId}`, SESSION_TTL, JSON.stringify(data));
}

export async function clearSession(telegramId: number | string): Promise<void> {
  const c = await getClient();
  await c.del(`session:${telegramId}`);
}

export async function updateSession(
  telegramId: number | string,
  updates: Partial<SessionState>
): Promise<SessionState> {
  const current = (await getSession(telegramId)) || {};
  const updated = { ...current, ...updates };
  await setSession(telegramId, updated);
  return updated;
}

// ── Rate limiting ────────────────────────────────────────────────────────────
// (Daily limit is handled in DB; this is for burst protection)
export async function checkBurst(telegramId: number | string): Promise<boolean> {
  const c = await getClient();
  const key = `burst:${telegramId}`;
  const count = await c.incr(key);
  if (count === 1) await c.expire(key, 3); // 3-second window
  return count > 5; // block if > 5 messages in 3s
}

// ── Quiz state (stored separately, larger payload) ──────────────────────────
export async function saveQuizState(telegramId: number | string, quizData: QuizState): Promise<void> {
  const c = await getClient();
  await c.setEx(`quiz:${telegramId}`, 60 * 60 * 3, JSON.stringify(quizData)); // 3h TTL
}

export async function getQuizState(telegramId: number | string): Promise<QuizState | null> {
  const c = await getClient();
  const raw = await c.get(`quiz:${telegramId}`);
  return raw ? (JSON.parse(raw) as QuizState) : null;
}

export async function clearQuizState(telegramId: number | string): Promise<void> {
  const c = await getClient();
  await c.del(`quiz:${telegramId}`);
}
