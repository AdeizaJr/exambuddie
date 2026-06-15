// src/db/index.ts
import { Pool } from 'pg';
import { User, Question, AttemptLog, UserStats, WeakTopic, SubjectStat } from '../types';

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
  const { rows } = await pool.query<User>('SELECT * FROM users WHERE telegram_id = $1', [
    telegramId,
  ]);
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

export async function updateUser(
  telegramId: number | string,
  fields: Partial<User>
): Promise<User> {
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

function isAllExams(examType: string): boolean {
  return examType === 'ALL' || examType === 'BOTH';
}

export async function getSubjectAvailability(subject: string): Promise<{ examType: string; years: number[] }[]> {
  const { rows } = await pool.query(
    `SELECT exam_type, ARRAY_AGG(DISTINCT year ORDER BY year) AS years
     FROM questions
     WHERE subject = $1 AND year IS NOT NULL
     GROUP BY exam_type
     ORDER BY exam_type`,
    [subject]
  );
  return rows.map((r: any) => ({ examType: r.exam_type as string, years: r.years as number[] }));
}

export async function getTopicsForSubject(examType: string, subject: string): Promise<string[]> {
  const all = isAllExams(examType);
  const params: any[] = all ? [subject] : [examType, subject];
  const subjectIdx = all ? 1 : 2;
  const examFilter = all ? '' : 'AND exam_type = $1';
  const { rows } = await pool.query(
    `SELECT DISTINCT topic FROM questions
     WHERE subject = $${subjectIdx} ${examFilter}
       AND topic IS NOT NULL AND topic != ''
     ORDER BY topic`,
    params
  );
  return rows.map((r: any) => r.topic as string);
}

export async function getRandomQuestion(
  examType: string,
  subject: string,
  excludeIds: number[] = [],
  year?: number | null,
  topic?: string | null
): Promise<Question | null> {
  const all = isAllExams(examType);
  const params: any[] = all ? [subject] : [examType, subject];
  const subjectIdx = all ? 1 : 2;
  const examFilter = all ? '' : 'AND exam_type = $1';

  let yearFilter = '';
  if (year) {
    yearFilter = `AND year = $${params.length + 1}`;
    params.push(year);
  }

  let topicFilter = '';
  if (topic) {
    topicFilter = `AND topic ILIKE $${params.length + 1}`;
    params.push(`%${topic}%`);
  }

  const excludeStart = params.length + 1;
  const excludeFilter =
    excludeIds.length > 0
      ? `AND id NOT IN (${excludeIds.map((_, i) => `$${excludeStart + i}`).join(',')})`
      : '';
  params.push(...excludeIds);

  const { rows } = await pool.query<Question>(
    `SELECT * FROM questions
     WHERE subject = $${subjectIdx} ${examFilter} ${yearFilter} ${topicFilter} ${excludeFilter}
     AND (has_diagram = FALSE OR image_url IS NOT NULL)
     ORDER BY RANDOM() LIMIT 1`,
    params
  );
  return rows[0] || null;
}

export async function getQuestionsByTopic(
  examType: string,
  subject: string,
  topic: string,
  limit = 10
): Promise<Question[]> {
  const all = isAllExams(examType);
  const params: any[] = all
    ? [subject, `%${topic}%`, limit]
    : [examType, subject, `%${topic}%`, limit];
  const subjectIdx = all ? 1 : 2;
  const topicIdx = subjectIdx + 1;
  const limitIdx = topicIdx + 1;
  const examFilter = all ? '' : 'AND exam_type = $1';

  const { rows } = await pool.query<Question>(
    `SELECT * FROM questions
     WHERE subject = $${subjectIdx} ${examFilter} AND topic ILIKE $${topicIdx}
     AND (has_diagram = FALSE OR image_url IS NOT NULL)
     ORDER BY RANDOM() LIMIT $${limitIdx}`,
    params
  );
  return rows;
}

export async function getQuizQuestions(
  examType: string,
  subject: string,
  limit = 40,
  year?: number | null
): Promise<Question[]> {
  const all = isAllExams(examType);
  const params: any[] = all ? [subject] : [examType, subject];
  const subjectIdx = all ? 1 : 2;
  const examFilter = all ? '' : 'AND exam_type = $1';

  let yearFilter = '';
  if (year) {
    params.push(year);
    yearFilter = `AND year = $${params.length}`;
  }

  params.push(limit);
  const limitIdx = params.length;

  const { rows } = await pool.query<Question>(
    `SELECT * FROM questions
     WHERE subject = $${subjectIdx} ${examFilter} ${yearFilter}
     AND (has_diagram = FALSE OR image_url IS NOT NULL)
     ORDER BY RANDOM() LIMIT $${limitIdx}`,
    params
  );
  return rows;
}

export async function getQuizQuestionsMulti(
  examType: string,
  subjects: string[],
  limit = 40,
  year?: number | null
): Promise<Question[]> {
  const perSubject = Math.ceil(limit / subjects.length);
  const all = isAllExams(examType);
  const combined: Question[] = [];

  for (const subject of subjects) {
    const params: any[] = all ? [subject] : [examType, subject];
    const subjectIdx = all ? 1 : 2;
    const examFilter = all ? '' : 'AND exam_type = $1';

    let yearFilter = '';
    if (year) {
      params.push(year);
      yearFilter = `AND year = $${params.length}`;
    }
    params.push(perSubject);
    const limitIdx = params.length;

    const { rows } = await pool.query<Question>(
      `SELECT * FROM questions
       WHERE subject = $${subjectIdx} ${examFilter} ${yearFilter}
       AND (has_diagram = FALSE OR image_url IS NOT NULL)
       ORDER BY RANDOM() LIMIT $${limitIdx}`,
      params
    );
    combined.push(...rows);
  }

  // Shuffle the combined pool
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.slice(0, limit);
}

export async function logAttempt({
  userId,
  questionId,
  selectedOption,
  isCorrect,
  sessionId,
  timeTakenMs,
}: AttemptLog): Promise<void> {
  await pool.query(
    `INSERT INTO attempts (user_id, question_id, selected_option, is_correct, session_id, time_taken_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, questionId, selectedOption, isCorrect, sessionId, timeTakenMs || 0]
  );
}

export async function saveQuizSession({
  sessionId,
  userId,
  subject,
  totalQuestions,
  correctCount,
  startTime,
  endTime,
}: {
  sessionId: string;
  userId: number;
  subject: string;
  totalQuestions: number;
  correctCount: number;
  startTime: number;
  endTime: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO sessions (id, user_id, mode, subject, total_questions, correct_count, started_at, ended_at, time_limit_secs)
     VALUES ($1, $2, 'quiz', $3, $4, $5, to_timestamp($6 / 1000.0), to_timestamp($7 / 1000.0), 2700)
     ON CONFLICT (id) DO NOTHING`,
    [sessionId, userId, subject, totalQuestions, correctCount, startTime, endTime]
  );
}

export async function getQuizHistory(userId: number, limit = 10): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT id, subject, total_questions, correct_count, started_at, ended_at
     FROM sessions
     WHERE user_id = $1 AND mode = 'quiz' AND ended_at IS NOT NULL
     ORDER BY started_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function getUserStats(userId: number, examType?: string): Promise<UserStats> {
  if (examType && examType !== 'all') {
    const { rows } = await pool.query<UserStats>(
      `SELECT
         COUNT(*) as total_attempts,
         SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct,
         ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
       FROM attempts a
       JOIN questions q ON a.question_id = q.id
       WHERE a.user_id = $1 AND q.exam_type = $2`,
      [userId, examType]
    );
    return rows[0];
  }
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

export async function getWeakTopics(
  userId: number,
  subject: string,
  examType?: string
): Promise<WeakTopic[]> {
  const filtered = examType && examType !== 'all';
  const params: any[] = filtered ? [userId, subject, examType] : [userId, subject];
  const { rows } = await pool.query<WeakTopic>(
    `SELECT q.topic,
            COUNT(*) as attempts,
            SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct,
            ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy
     FROM attempts a
     JOIN questions q ON a.question_id = q.id
     WHERE a.user_id = $1 AND q.subject = $2 AND q.topic IS NOT NULL
     ${filtered ? 'AND q.exam_type = $3' : ''}
     GROUP BY q.topic HAVING COUNT(*) >= 3
     ORDER BY accuracy ASC LIMIT 3`,
    params
  );
  return rows;
}

export async function getSubjectStats(userId: number, examType?: string): Promise<SubjectStat[]> {
  const filtered = examType && examType !== 'all';
  const params: any[] = filtered ? [userId, examType] : [userId];
  const { rows } = await pool.query<SubjectStat>(
    `SELECT q.subject,
            COUNT(*) as attempts,
            SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct,
            ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
     FROM attempts a
     JOIN questions q ON a.question_id = q.id
     WHERE a.user_id = $1 ${filtered ? 'AND q.exam_type = $2' : ''}
     GROUP BY q.subject HAVING COUNT(*) >= 3
     ORDER BY accuracy DESC`,
    params
  );
  return rows;
}

export async function checkDailyLimit(
  user: User
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
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
  await pool.query(`UPDATE users SET daily_count = daily_count + 1 WHERE telegram_id = $1`, [
    telegramId,
  ]);
}

export async function updateStreak(telegramId: number | string): Promise<number | undefined> {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const user = await getUser(telegramId);
  if (!user) return;
  if (user.last_active_date === today) return user.streak; // already counted today
  const newStreak = user.last_active_date === yesterday ? user.streak + 1 : 1;
  await pool.query(`UPDATE users SET streak = $1, last_active_date = $2 WHERE telegram_id = $3`, [
    newStreak,
    today,
    telegramId,
  ]);
  return newStreak;
}

export async function getSubjects(): Promise<any[]> {
  const { rows } = await pool.query('SELECT * FROM subjects ORDER BY name');
  return rows;
}

export interface WeeklyReport {
  thisWeek: { attempts: number; accuracy: number };
  lastWeek: { attempts: number; accuracy: number };
  subjectBreakdown: { subject: string; attempts: number; accuracy: number }[];
  weakTopics: { subject: string; topic: string; accuracy: number; attempts: number }[];
}

export async function getWeeklyReport(userId: number): Promise<WeeklyReport> {
  const [thisWeekRes, lastWeekRes, subjectRes, weakRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as attempts,
              ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
       FROM attempts WHERE user_id = $1 AND attempted_at > NOW() - INTERVAL '7 days'`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*) as attempts,
              ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
       FROM attempts WHERE user_id = $1
         AND attempted_at > NOW() - INTERVAL '14 days'
         AND attempted_at <= NOW() - INTERVAL '7 days'`,
      [userId]
    ),
    pool.query(
      `SELECT q.subject,
              COUNT(*) as attempts,
              ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
       FROM attempts a
       JOIN questions q ON a.question_id = q.id
       WHERE a.user_id = $1 AND a.attempted_at > NOW() - INTERVAL '7 days'
       GROUP BY q.subject ORDER BY attempts DESC`,
      [userId]
    ),
    pool.query(
      `SELECT q.subject, q.topic,
              COUNT(*) as attempts,
              ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
       FROM attempts a
       JOIN questions q ON a.question_id = q.id
       WHERE a.user_id = $1 AND a.attempted_at > NOW() - INTERVAL '7 days'
         AND q.topic IS NOT NULL
       GROUP BY q.subject, q.topic HAVING COUNT(*) >= 3
       ORDER BY accuracy ASC LIMIT 5`,
      [userId]
    ),
  ]);

  return {
    thisWeek: {
      attempts: parseInt(thisWeekRes.rows[0]?.attempts || '0'),
      accuracy: parseFloat(thisWeekRes.rows[0]?.accuracy || '0'),
    },
    lastWeek: {
      attempts: parseInt(lastWeekRes.rows[0]?.attempts || '0'),
      accuracy: parseFloat(lastWeekRes.rows[0]?.accuracy || '0'),
    },
    subjectBreakdown: subjectRes.rows.map((r: any) => ({
      subject: r.subject,
      attempts: parseInt(r.attempts),
      accuracy: parseFloat(r.accuracy),
    })),
    weakTopics: weakRes.rows.map((r: any) => ({
      subject: r.subject,
      topic: r.topic,
      attempts: parseInt(r.attempts),
      accuracy: parseFloat(r.accuracy),
    })),
  };
}

export async function deleteUser(telegramId: number | string): Promise<void> {
  const { rows } = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId]);
  if (!rows[0]) return;
  const userId = rows[0].id;
  await pool.query('DELETE FROM flagged_explanations WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM attempts WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}
