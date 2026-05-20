// src/db/index.ts
import { Pool } from 'pg';
import { User, Question, AttemptLog, UserStats, WeakTopic } from '../types';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

// Helper for raw queries
export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

// Helpers
export async function getUser(telegramId: number | string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    'SELECT * FROM users WHERE telegram_id = $1', [telegramId]
  );
  return rows[0] || null;
}

export async function upsertUser(ctx: any): Promise<User> {
  const { id, username, first_name } = ctx.from;
  const { rows } = await pool.query<User>(
    `INSERT INTO users (telegram_id, username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE
       SET username = $2, first_name = $3, updated_at = NOW()
     RETURNING *`,
    [id, username || null, first_name || 'Student']
  );
  return rows[0];
}

export async function updateUser(telegramId: number | string, fields: Partial<User>): Promise<User> {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await pool.query<User>(
    `UPDATE users SET ${setClause}, updated_at = NOW()
     WHERE telegram_id = $1 RETURNING *`,
    [telegramId, ...values]
  );
  return rows[0];
}

export async function getRandomQuestion(examType: string, subject: string, excludeIds: number[] = []): Promise<Question | null> {
  const exclude = excludeIds.length > 0
    ? `AND id NOT IN (${excludeIds.map((_, i) => `$${i + 3}`).join(',')})`
    : '';
  const { rows } = await pool.query<Question>(
    `SELECT * FROM questions
     WHERE exam_type = $1 AND subject = $2 ${exclude}
     ORDER BY RANDOM() LIMIT 1`,
    [examType, subject, ...excludeIds]
  );
  return rows[0] || null;
}

export async function getQuestionsByTopic(examType: string, subject: string, topic: string, limit = 10): Promise<Question[]> {
  const { rows } = await pool.query<Question>(
    `SELECT * FROM questions
     WHERE exam_type = $1 AND subject = $2 AND topic ILIKE $3
     ORDER BY RANDOM() LIMIT $4`,
    [examType, subject, `%${topic}%`, limit]
  );
  return rows;
}

export async function getQuizQuestions(examType: string, subject: string, limit = 40): Promise<Question[]> {
  const { rows } = await pool.query<Question>(
    `SELECT * FROM questions
     WHERE exam_type = $1 AND subject = $2
     ORDER BY RANDOM() LIMIT $3`,
    [examType, subject, limit]
  );
  return rows;
}

export async function logAttempt({ userId, questionId, selectedOption, isCorrect, sessionId, timeTakenMs }: AttemptLog): Promise<void> {
  await pool.query(
    `INSERT INTO attempts (user_id, question_id, selected_option, is_correct, session_id, time_taken_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, questionId, selectedOption, isCorrect, sessionId, timeTakenMs || 0]
  );
}

export async function getUserStats(userId: number): Promise<UserStats> {
  const { rows } = await pool.query<UserStats>(
    `SELECT
       COUNT(*) as total_attempts,
       SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
       ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
     FROM attempts WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
}

export async function getWeakTopics(userId: number, subject: string): Promise<WeakTopic[]> {
  const { rows } = await pool.query<WeakTopic>(
    `SELECT q.topic,
            COUNT(*) as attempts,
            SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct,
            ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy
     FROM attempts a
     JOIN questions q ON a.question_id = q.id
     WHERE a.user_id = $1 AND q.subject = $2 AND q.topic IS NOT NULL
     GROUP BY q.topic HAVING COUNT(*) >= 3
     ORDER BY accuracy ASC LIMIT 3`,
    [userId, subject]
  );
  return rows;
}

export async function checkDailyLimit(user: User): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  if (user.plan === 'premium') return { allowed: true, remaining: 999, limit: 999 };

  // Reset count if it's a new day
  const today = new Date().toISOString().split('T')[0];
  if (user.daily_reset_at !== today) {
    await pool.query(
      `UPDATE users SET daily_count = 0, daily_reset_at = $1 WHERE telegram_id = $2`,
      [today, user.telegram_id]
    );
    user.daily_count = 0;
  }

  const limit = parseInt(process.env.FREE_DAILY_LIMIT || '5', 10);
  const remaining = limit - user.daily_count;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining), limit };
}

export async function incrementDailyCount(telegramId: number | string): Promise<void> {
  await pool.query(
    `UPDATE users SET daily_count = daily_count + 1 WHERE telegram_id = $1`,
    [telegramId]
  );
}

export async function updateStreak(telegramId: number | string): Promise<number | undefined> {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const user = await getUser(telegramId);
  if (!user) return;
  if (user.last_active_date === today) return user.streak; // already counted today
  const newStreak = user.last_active_date === yesterday ? user.streak + 1 : 1;
  await pool.query(
    `UPDATE users SET streak = $1, last_active_date = $2 WHERE telegram_id = $3`,
    [newStreak, today, telegramId]
  );
  return newStreak;
}

export async function getSubjects(): Promise<any[]> {
  const { rows } = await pool.query('SELECT * FROM subjects ORDER BY name');
  return rows;
}
