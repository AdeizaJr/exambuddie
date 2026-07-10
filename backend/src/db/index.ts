// src/db/index.ts
import { Pool, types } from 'pg';
import { User, Question, AttemptLog, UserStats, WeakTopic, SubjectStat } from '../types';
import { getCachedUser, setCachedUser, clearCachedUser } from '../services/redis';
import { getPricing } from '../services/pricing';

// Return DATE columns as plain strings (not JS Date objects) to avoid timezone shifts
types.setTypeParser(1082, (val: string) => val);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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
  const cached = await getCachedUser(telegramId);
  if (cached) return cached as unknown as User;
  const { rows } = await pool.query<User>('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  const user = rows[0] || null;
  if (user) setCachedUser(telegramId, user).catch(() => {});
  return user;
}

export async function getUserById(id: number): Promise<User | null> {
  const { rows } = await pool.query<User>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function upsertUser(ctx: any): Promise<User> {
  const { id, username, first_name } = ctx.from;
  const code = generateReferralCode();
  const { rows } = await pool.query<User>(
    `INSERT INTO users (telegram_id, username, first_name, referral_code)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id) DO UPDATE
       SET username = $2, first_name = $3, updated_at = NOW(),
           referral_code = COALESCE(users.referral_code, EXCLUDED.referral_code)
     RETURNING *`,
    [id, username || null, first_name || 'Student', code]
  );
  const user = rows[0];
  setCachedUser(id, user).catch(() => {});
  return user;
}

const USER_UPDATABLE_COLUMNS = new Set<string>([
  'username', 'first_name', 'exam_type', 'subjects', 'target_year', 'plan',
  'plan_expires_at', 'daily_count', 'daily_reset_at', 'streak',
  'last_active_date', 'phone_number', 'notifications_enabled',
  'streak_freeze_used_at', 'trial_used', 'daily_reminder_hour', 'source',
  'consent_given_at',
]);

export async function updateUser(
  telegramId: number | string,
  fields: Partial<User>
): Promise<User> {
  const keys = Object.keys(fields);
  for (const k of keys) {
    if (!USER_UPDATABLE_COLUMNS.has(k)) throw new Error(`updateUser: column "${k}" is not updatable`);
  }
  const values = Object.values(fields);
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await pool.query<User>(
    `UPDATE users SET ${setClause}, updated_at = NOW()
     WHERE telegram_id = $1 RETURNING *`,
    [telegramId, ...values]
  );
  const user = rows[0];
  if (user) setCachedUser(telegramId, user).catch(() => {});
  return user;
}

export async function grantTrial(telegramId: number | string): Promise<void> {
  await pool.query(
    `UPDATE users SET
       plan = 'premium',
       plan_expires_at = NOW() + INTERVAL '14 days',
       trial_used = TRUE
     WHERE telegram_id = $1 AND trial_used = FALSE`,
    [telegramId]
  );
}

function isAllExams(examType: string): boolean {
  return examType === 'ALL' || examType === 'BOTH';
}

export async function getSubjectAvailability(subject: string): Promise<{ examType: string; years: number[] }[]> {
  const { rows } = await pool.query(
    `SELECT exam_type, ARRAY_AGG(DISTINCT year ORDER BY year) AS years
     FROM questions
     WHERE subject = $1 AND year IS NOT NULL AND is_active = TRUE
     GROUP BY exam_type
     ORDER BY exam_type`,
    [subject]
  );
  return rows.map((r: any) => ({ examType: r.exam_type as string, years: r.years as number[] }));
}

export async function getSubjectsWithQuestions(examType: string): Promise<string[]> {
  const all = isAllExams(examType);
  const params: any[] = all ? [] : [examType];
  const examFilter = all ? '' : 'AND exam_type = $1';
  const { rows } = await pool.query(
    `SELECT DISTINCT subject FROM questions WHERE is_active = TRUE ${examFilter}`,
    params
  );
  return rows.map((r: any) => r.subject as string);
}

export async function getTopicsForSubject(examType: string, subject: string): Promise<string[]> {
  const all = isAllExams(examType);
  const params: any[] = all ? [subject] : [examType, subject];
  const subjectIdx = all ? 1 : 2;
  const examFilter = all ? '' : 'AND exam_type = $1';
  const { rows } = await pool.query(
    `SELECT DISTINCT topic FROM questions
     WHERE subject = $${subjectIdx} ${examFilter}
       AND topic IS NOT NULL AND topic != '' AND is_active = TRUE
     ORDER BY topic`,
    params
  );
  return rows.map((r: any) => r.topic as string);
}

async function getSpacedQuestion(
  examType: string,
  subject: string,
  excludeIds: number[],
  year: number | null | undefined,
  topic: string | null | undefined,
  userId: number
): Promise<Question | null> {
  const all = isAllExams(examType);
  const params: any[] = [];
  if (!all) params.push(examType);
  params.push(subject);
  params.push(userId);
  const subjectIdx = all ? 1 : 2;
  const userIdx = all ? 2 : 3;
  const examFilter = all ? '' : 'AND q.exam_type = $1';

  let yearFilter = '';
  if (year) { yearFilter = `AND q.year = $${params.length + 1}`; params.push(year); }
  let topicFilter = '';
  if (topic) { topicFilter = `AND q.topic ILIKE $${params.length + 1}`; params.push(`%${topic}%`); }
  const excStart = params.length + 1;
  const excFilter = excludeIds.length > 0
    ? `AND q.id NOT IN (${excludeIds.map((_, i) => `$${excStart + i}`).join(',')})`
    : '';
  params.push(...excludeIds);

  const { rows } = await pool.query<Question>(
    `SELECT DISTINCT ON (q.id) q.* FROM questions q
     JOIN attempts a ON a.question_id = q.id
     WHERE q.subject = $${subjectIdx} ${examFilter} ${yearFilter} ${topicFilter} ${excFilter}
       AND q.is_active = TRUE
       AND a.user_id = $${userIdx}
       AND a.is_correct = FALSE
       AND a.attempted_at > NOW() - INTERVAL '30 days'
     ORDER BY q.id, RANDOM() LIMIT 1`,
    params
  );
  return rows[0] || null;
}

export async function getRandomQuestion(
  examType: string,
  subject: string,
  excludeIds: number[] = [],
  year?: number | null,
  topic?: string | null,
  userId?: number
): Promise<Question | null> {
  // 40% chance: serve a previously wrong question (spaced repetition)
  if (userId && Math.random() < 0.4) {
    const wrong = await getSpacedQuestion(examType, subject, excludeIds, year, topic, userId);
    if (wrong) return wrong;
  }

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
       AND is_active = TRUE
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
       AND is_active = TRUE
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
       AND is_active = TRUE
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
         AND is_active = TRUE
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
     VALUES ($1, $2, 'quiz', $3, $4, $5, to_timestamp($6 / 1000.0), to_timestamp($7 / 1000.0), 3000)
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
     GROUP BY q.topic HAVING COUNT(*) >= 2 AND ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) < 100
     ORDER BY accuracy ASC LIMIT 3`,
    params
  );
  return rows;
}

// Surfaces a behavioral mistake pattern (not just "weak in topic X") from a user's most
// recent wrong attempts — a guessing habit, adjacent-option confusion, or rushing. This is
// a different, complementary signal to per-topic accuracy: two students can have identical
// topic weaknesses for completely different underlying reasons.
export async function getMistakePattern(userId: number): Promise<string | null> {
  const { rows } = await pool.query<{
    selected_option: string | null;
    correct_option: string;
    is_correct: boolean;
    time_taken_ms: number | null;
  }>(
    `SELECT a.selected_option, q.correct_option, a.is_correct, a.time_taken_ms
     FROM attempts a
     JOIN questions q ON a.question_id = q.id
     WHERE a.user_id = $1
     ORDER BY a.attempted_at DESC
     LIMIT 80`,
    [userId]
  );

  // selected_option is a single space (not NULL) when a question timed out with no
  // answer — truthy in JS, but not a real "picked the wrong option" data point. A timeout
  // is a different signal (ran out of time) than a guessing/confusion pattern, so exclude it.
  const wrong = rows
    .filter(r => !r.is_correct && r.selected_option && /^[A-E]$/.test(r.selected_option.trim()))
    .map(r => ({ ...r, selected_option: r.selected_option!.trim() }));
  if (wrong.length < 15) return null; // not enough signal yet

  // 1. Single-letter guessing bias — one option dominates their wrong answers regardless
  // of what the correct answer actually was.
  const letterCounts: Record<string, number> = {};
  for (const r of wrong) letterCounts[r.selected_option] = (letterCounts[r.selected_option] || 0) + 1;
  const [topLetter, topCount] = Object.entries(letterCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCount / wrong.length >= 0.45) {
    const pct = Math.round((topCount / wrong.length) * 100);
    return `You tend to pick <b>${topLetter}</b> when you're unsure — ${pct}% of your wrong answers were ${topLetter}. That's a guessing habit, not a knowledge gap. Try eliminating options you're sure are wrong before picking.`;
  }

  // 2. Adjacent-option confusion — picks the option right next to the correct one more
  // often than chance would predict.
  const letterIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const adjacent = wrong.filter(r => {
    const a = letterIndex[r.selected_option];
    const b = letterIndex[r.correct_option];
    return a !== undefined && b !== undefined && Math.abs(a - b) === 1;
  });
  if (adjacent.length / wrong.length >= 0.4) {
    const pct = Math.round((adjacent.length / wrong.length) * 100);
    return `You often pick the option right next to the correct one — ${pct}% of your wrong answers were adjacent to the right one. Slow down and compare similar-looking options before choosing.`;
  }

  // 3. Rushing — answers wrong questions noticeably faster than correct ones.
  const wrongTimed = wrong.filter(r => r.time_taken_ms != null);
  const correctTimed = rows.filter(r => r.is_correct && r.time_taken_ms != null);
  if (wrongTimed.length >= 10 && correctTimed.length >= 10) {
    const avg = (arr: { time_taken_ms: number | null }[]) => arr.reduce((s, r) => s + r.time_taken_ms!, 0) / arr.length;
    const wrongAvg = avg(wrongTimed);
    const correctAvg = avg(correctTimed);
    if (wrongAvg < correctAvg * 0.6) {
      const pct = Math.round((1 - wrongAvg / correctAvg) * 100);
      return `You answer wrong questions ${pct}% faster than the ones you get right — you're rushing. Re-read the question once before picking an answer.`;
    }
  }

  return null;
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

export interface LeaderboardEntry {
  rank: number;
  first_name: string;
  correct: number;
  total: number;
  accuracy: number;
  telegram_id: number;
}

// Monday 00:00 WAT — resets every week
const WAT_WEEK_START = `(date_trunc('week', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos')`;

export async function getLeaderboard(subject?: string): Promise<LeaderboardEntry[]> {
  const subjectFilter = subject ? `AND q.subject = $1` : '';
  const params = subject ? [subject] : [];

  const { rows } = await pool.query(
    `SELECT
       u.first_name,
       u.telegram_id,
       COUNT(*) AS total,
       SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) AS correct,
       ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) AS accuracy
     FROM attempts a
     JOIN users u ON a.user_id = u.id
     JOIN questions q ON a.question_id = q.id
     WHERE a.attempted_at >= ${WAT_WEEK_START}
     ${subjectFilter}
     GROUP BY u.id, u.first_name, u.telegram_id
     HAVING COUNT(*) >= 5
     ORDER BY accuracy DESC, total DESC
     LIMIT 10`,
    params
  );

  return rows.map((r, i) => ({
    rank: i + 1,
    first_name: r.first_name,
    telegram_id: parseInt(r.telegram_id),
    correct: parseInt(r.correct),
    total: parseInt(r.total),
    accuracy: parseFloat(r.accuracy),
  }));
}

export async function getLeaderboardRank(userId: number, subject?: string): Promise<number | null> {
  const subjectFilter = subject ? `AND q.subject = $1` : '';
  const params: any[] = subject ? [subject] : [];

  const { rows } = await pool.query(
    `SELECT rank FROM (
       SELECT
         u.id,
         RANK() OVER (ORDER BY
           ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) DESC,
           COUNT(*) DESC
         ) AS rank
       FROM attempts a
       JOIN users u ON a.user_id = u.id
       JOIN questions q ON a.question_id = q.id
       WHERE a.attempted_at >= ${WAT_WEEK_START}
       ${subjectFilter}
       GROUP BY u.id
       HAVING COUNT(*) >= 5
     ) ranked
     JOIN users u ON ranked.id = u.id
     WHERE u.telegram_id = $${params.length + 1}`,
    [...params, userId]
  );

  return rows[0] ? parseInt(rows[0].rank) : null;
}

export async function snapshotLeaderboard(): Promise<number> {
  const weekStartExpr = `date_trunc('week', now() at time zone 'Africa/Lagos')::date`;
  const { rows: existing } = await pool.query(
    `SELECT 1 FROM leaderboard_snapshots WHERE week_start = (${weekStartExpr}) LIMIT 1`
  );
  if (existing.length > 0) return 0;

  const entries = await getLeaderboard();
  if (entries.length === 0) return 0;

  for (const e of entries) {
    await pool.query(
      `INSERT INTO leaderboard_snapshots (week_start, rank, telegram_id, first_name, correct, total, accuracy)
       VALUES ((${weekStartExpr}), $1, $2, $3, $4, $5, $6)
       ON CONFLICT (week_start, rank) DO NOTHING`,
      [e.rank, e.telegram_id, e.first_name, e.correct, e.total, e.accuracy]
    );
  }
  return entries.length;
}

export async function getLastWeekSnapshot(): Promise<LeaderboardEntry[]> {
  return getLeaderboardSnapshot(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
}

export async function getLeaderboardSnapshot(weekStart: string): Promise<LeaderboardEntry[]> {
  const { rows } = await pool.query(
    `SELECT rank, telegram_id, first_name, correct, total, accuracy
     FROM leaderboard_snapshots
     WHERE week_start = $1
     ORDER BY rank ASC`,
    [weekStart]
  );
  return rows.map(r => ({
    rank: parseInt(r.rank),
    telegram_id: parseInt(r.telegram_id),
    first_name: r.first_name,
    correct: parseInt(r.correct),
    total: parseInt(r.total),
    accuracy: parseFloat(r.accuracy),
  }));
}

export async function getSnapshotWeeks(): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT week_start::text
     FROM leaderboard_snapshots
     ORDER BY week_start DESC`
  );
  return rows.map(r => r.week_start);
}

export interface SubscriptionHistoryEntry {
  plan: string;
  amount_ngn: number;
  status: string;
  started_at: string | null;
  is_recurring: boolean;
  cancelled_at: string | null;
}

export async function getSubscriptionHistory(userId: number, limit = 10): Promise<SubscriptionHistoryEntry[]> {
  const { rows } = await pool.query(
    `SELECT plan, amount_ngn, status, started_at, is_recurring, cancelled_at
     FROM subscriptions
     WHERE user_id = $1 AND status != 'pending'
     ORDER BY started_at DESC NULLS LAST, created_at DESC
     LIMIT $2`,
    [userId, limit]
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

  const limit = getPricing().free_daily_limit;
  const remaining = limit - user.daily_count;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining), limit };
}

export async function incrementDailyCount(telegramId: number | string): Promise<void> {
  await pool.query(`UPDATE users SET daily_count = daily_count + 1 WHERE telegram_id = $1`, [
    telegramId,
  ]);
  await clearCachedUser(telegramId).catch(() => {});
}

// WAT = UTC+1. All date logic uses WAT so Nigerian users practicing near midnight
// don't get credited to the wrong day.
function watDateString(offsetDays = 0): string {
  return new Date(Date.now() + 60 * 60 * 1000 + offsetDays * 86400000)
    .toISOString()
    .split('T')[0];
}

export async function updateStreak(telegramId: number | string): Promise<{ streak: number; isFirstToday: boolean } | undefined> {
  const today = watDateString();
  const yesterday = watDateString(-1);
  const user = await getUser(telegramId);
  if (!user) return;
  const lastActive = user.last_active_date
    ? new Date(new Date(user.last_active_date).getTime() + 60 * 60 * 1000).toISOString().split('T')[0]
    : null;
  if (lastActive === today) return { streak: user.streak, isFirstToday: false };
  const newStreak = lastActive === yesterday ? user.streak + 1 : 1;
  await pool.query(`UPDATE users SET streak = $1, last_active_date = $2 WHERE telegram_id = $3`, [
    newStreak,
    today,
    telegramId,
  ]);
  return { streak: newStreak, isFirstToday: true };
}

export async function getWeeklyActivity(userId: number): Promise<boolean[]> {
  // Returns [Mon, Tue, Wed, Thu, Fri, Sat, Sun] using WAT (UTC+1) dates
  const nowWAT = new Date(Date.now() + 60 * 60 * 1000);
  const dayOfWeek = nowWAT.getUTCDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayWAT = new Date(nowWAT);
  mondayWAT.setUTCDate(nowWAT.getUTCDate() + mondayOffset);
  mondayWAT.setUTCHours(0, 0, 0, 0);
  // convert back to UTC for the DB query: WAT midnight = UTC 23:00 previous day
  const mondayUTC = new Date(mondayWAT.getTime() - 60 * 60 * 1000);

  const { rows } = await pool.query(
    `SELECT DISTINCT DATE(attempted_at AT TIME ZONE 'Africa/Lagos') as day FROM attempts
     WHERE user_id = $1 AND attempted_at >= $2
     ORDER BY day`,
    [userId, mondayUTC.toISOString()]
  );

  const activeDays = new Set(rows.map((r: any) => {
    const d = new Date(r.day);
    return new Date(d.getTime() + 60 * 60 * 1000).toISOString().split('T')[0];
  }));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayWAT);
    d.setUTCDate(mondayWAT.getUTCDate() + i);
    return activeDays.has(d.toISOString().split('T')[0]);
  });
}

export async function getTotalAttempts(userId: number): Promise<number> {
  const { rows } = await pool.query('SELECT COUNT(*) as cnt FROM attempts WHERE user_id = $1', [userId]);
  return parseInt(rows[0].cnt, 10);
}

export async function getTotalWrongAttempts(userId: number): Promise<number> {
  const { rows } = await pool.query(
    'SELECT COUNT(*) as cnt FROM attempts WHERE user_id = $1 AND is_correct = false',
    [userId]
  );
  return parseInt(rows[0].cnt, 10);
}

export async function getSubjectQuestionCounts(subjects: string[]): Promise<Record<string, number>> {
  if (!subjects.length) return {};
  const { rows } = await pool.query(
    `SELECT subject, COUNT(*) as count FROM questions
     WHERE subject = ANY($1) AND is_active = TRUE
     GROUP BY subject`,
    [subjects]
  );
  const map: Record<string, number> = {};
  for (const row of rows) map[row.subject] = parseInt(row.count, 10);
  return map;
}


export interface WeeklyReport {
  thisWeek: { attempts: number; accuracy: number };
  lastWeek: { attempts: number; accuracy: number };
  subjectBreakdown: { subject: string; attempts: number; accuracy: number }[];
  weakTopics: { subject: string; topic: string; accuracy: number; attempts: number }[];
  bestSubject: { subject: string; accuracy: number } | null;
  coverageStats: { subject: string; seen: number; total: number }[];
  percentileRank: number | null;
}

export async function getWeeklyReport(userId: number): Promise<WeeklyReport> {
  const [thisWeekRes, lastWeekRes, subjectRes, weakRes, coverageRes, percentileRes] = await Promise.all([
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
       GROUP BY q.subject, q.topic HAVING COUNT(*) >= 2
       ORDER BY accuracy ASC LIMIT 5`,
      [userId]
    ),
    pool.query(
      `SELECT q.subject,
              COUNT(DISTINCT a.question_id) as seen,
              totals.total
       FROM attempts a
       JOIN questions q ON a.question_id = q.id
       JOIN (
         SELECT subject, COUNT(*) as total
         FROM questions
         WHERE is_active = TRUE
         GROUP BY subject
       ) totals ON q.subject = totals.subject
       WHERE a.user_id = $1
       GROUP BY q.subject, totals.total`,
      [userId]
    ),
    pool.query(
      `SELECT ROUND(
         100.0 * COUNT(CASE WHEN all_accs.acc < user_acc.user_accuracy THEN 1 END)
         / NULLIF(COUNT(*), 0)
       ) as percentile
       FROM (
         SELECT user_id,
                ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as acc
         FROM attempts
         WHERE attempted_at > NOW() - INTERVAL '7 days'
         GROUP BY user_id HAVING COUNT(*) >= 5
       ) all_accs
       CROSS JOIN (
         SELECT ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as user_accuracy
         FROM attempts WHERE user_id = $1 AND attempted_at > NOW() - INTERVAL '7 days'
       ) user_acc`,
      [userId]
    ),
  ]);

  const subjectBreakdown = subjectRes.rows.map((r: any) => ({
    subject: r.subject,
    attempts: parseInt(r.attempts),
    accuracy: parseFloat(r.accuracy),
  }));

  const bestSubject = subjectBreakdown.length > 0
    ? [...subjectBreakdown].sort((a, b) => b.accuracy - a.accuracy)[0]
    : null;

  return {
    thisWeek: {
      attempts: parseInt(thisWeekRes.rows[0]?.attempts || '0'),
      accuracy: parseFloat(thisWeekRes.rows[0]?.accuracy || '0'),
    },
    lastWeek: {
      attempts: parseInt(lastWeekRes.rows[0]?.attempts || '0'),
      accuracy: parseFloat(lastWeekRes.rows[0]?.accuracy || '0'),
    },
    subjectBreakdown,
    weakTopics: weakRes.rows.map((r: any) => ({
      subject: r.subject,
      topic: r.topic,
      attempts: parseInt(r.attempts),
      accuracy: parseFloat(r.accuracy),
    })),
    bestSubject: bestSubject ? { subject: bestSubject.subject, accuracy: bestSubject.accuracy } : null,
    coverageStats: coverageRes.rows.map((r: any) => ({
      subject: r.subject,
      seen: parseInt(r.seen),
      total: parseInt(r.total),
    })),
    percentileRank: percentileRes.rows[0]?.percentile != null
      ? parseInt(percentileRes.rows[0].percentile)
      : null,
  };
}

export async function getWeakTopicsAllSubjects(
  userId: number,
  subjects: string[]
): Promise<{ subject: string; topic: string; attempts: number; accuracy: number }[]> {
  if (!subjects.length) return [];
  const { rows } = await pool.query(
    `SELECT q.subject, q.topic,
            COUNT(*) as attempts,
            ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
     FROM attempts a
     JOIN questions q ON a.question_id = q.id
     WHERE a.user_id = $1 AND q.subject = ANY($2) AND q.topic IS NOT NULL
       AND a.attempted_at > NOW() - INTERVAL '7 days'
     GROUP BY q.subject, q.topic HAVING COUNT(*) >= 2 AND ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) < 100
     ORDER BY accuracy ASC LIMIT 3`,
    [userId, subjects]
  );
  return rows.map((r: any) => ({
    subject: r.subject,
    topic: r.topic,
    attempts: parseInt(r.attempts),
    accuracy: parseFloat(r.accuracy),
  }));
}

export async function markWeeklyReportSent(userIds: number[]): Promise<void> {
  if (!userIds.length) return;
  await pool.query(`UPDATE users SET last_report_sent_at = NOW() WHERE id = ANY($1)`, [userIds]);
}

export async function deleteUser(telegramId: number | string): Promise<void> {
  const { rows } = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId]);
  if (!rows[0]) return;
  const userId = rows[0].id;
  // room_participants uses telegram_id directly (no FK), must delete manually
  await pool.query('DELETE FROM room_participants WHERE telegram_id = $1', [telegramId]);
  await pool.query('DELETE FROM flagged_explanations WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM attempts WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  // Anonymise payment records instead of deleting — 7-year retention required by FIRS
  await pool.query(
    `UPDATE subscriptions SET user_id = NULL, tx_ref = CONCAT('deleted_', tx_ref) WHERE user_id = $1`,
    [userId]
  );
  // bookmarks and sr_cards cascade from users ON DELETE CASCADE
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

// ── Challenge rooms ───────────────────────────────────────────────────────────

export interface PracticeRoom {
  id: number;
  code: string;
  creator_telegram_id: number;
  subject: string;
  exam_type: string;
  year: number | null;
  question_ids: number[];
  num_questions: number;
  time_limit_secs: number;
  status: 'waiting' | 'active' | 'ended';
  max_players: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface RoomParticipant {
  id: number;
  room_id: number;
  telegram_id: number;
  first_name: string;
  current_q_idx: number;
  correct: number;
  total_answered: number;
  ready: boolean;
  finished: boolean;
  finished_at: string | null;
  joined_at: string;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function getQuestionById(id: number): Promise<Question | null> {
  const { rows } = await pool.query<Question>('SELECT * FROM questions WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createRoom(data: {
  creatorTelegramId: number;
  subject: string;
  examType: string;
  year: number | null;
  numQuestions: number;
  timeLimitSecs: number;
  expectedPlayers?: number;
}): Promise<PracticeRoom> {
  const yearClause = data.year ? `AND year = ${data.year}` : '';
  const qRes = await pool.query(
    `SELECT id FROM questions
     WHERE subject = $1 AND exam_type = $2
       AND is_active = TRUE
     ${yearClause}
     ORDER BY RANDOM() LIMIT $3`,
    [data.subject, data.examType, data.numQuestions]
  );
  const questionIds = qRes.rows.map((r: any) => r.id);
  if (questionIds.length < data.numQuestions) {
    throw new Error(`Only ${questionIds.length} questions available`);
  }

  let code = '';
  for (let i = 0; i < 10; i++) {
    const candidate = generateRoomCode();
    const { rows } = await pool.query('SELECT id FROM practice_rooms WHERE code = $1', [candidate]);
    if (rows.length === 0) { code = candidate; break; }
  }
  if (!code) throw new Error('Could not generate unique room code');

  const { rows } = await pool.query(
    `INSERT INTO practice_rooms (code, creator_telegram_id, subject, exam_type, year, question_ids, num_questions, time_limit_secs, max_players)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [code, data.creatorTelegramId, data.subject, data.examType, data.year, questionIds, data.numQuestions, data.timeLimitSecs, data.expectedPlayers ?? 2]
  );
  return rows[0];
}

export async function getRoom(code: string): Promise<PracticeRoom | null> {
  const { rows } = await pool.query('SELECT * FROM practice_rooms WHERE code = $1', [code]);
  return rows[0] || null;
}

export async function getRoomById(id: number): Promise<PracticeRoom | null> {
  const { rows } = await pool.query('SELECT * FROM practice_rooms WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getRoomParticipants(roomId: number): Promise<RoomParticipant[]> {
  const { rows } = await pool.query(
    'SELECT * FROM room_participants WHERE room_id = $1 ORDER BY joined_at',
    [roomId]
  );
  return rows;
}

export async function joinRoom(roomId: number, telegramId: number, firstName: string): Promise<RoomParticipant> {
  const { rows } = await pool.query(
    `INSERT INTO room_participants (room_id, telegram_id, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (room_id, telegram_id) DO UPDATE SET first_name = EXCLUDED.first_name
     RETURNING *`,
    [roomId, telegramId, firstName]
  );
  return rows[0];
}

export async function setParticipantReady(roomId: number, telegramId: number): Promise<void> {
  await pool.query(
    'UPDATE room_participants SET ready = true WHERE room_id = $1 AND telegram_id = $2',
    [roomId, telegramId]
  );
}

export async function startRoom(roomId: number): Promise<void> {
  await pool.query(
    `UPDATE practice_rooms SET status = 'active', started_at = NOW() WHERE id = $1`,
    [roomId]
  );
}

export async function recordChallengeAnswer(
  roomId: number, telegramId: number, isCorrect: boolean
): Promise<RoomParticipant> {
  const { rows } = await pool.query(
    `UPDATE room_participants
     SET current_q_idx = current_q_idx + 1,
         total_answered = total_answered + 1,
         correct = correct + $3
     WHERE room_id = $1 AND telegram_id = $2 RETURNING *`,
    [roomId, telegramId, isCorrect ? 1 : 0]
  );
  return rows[0];
}

export async function finishParticipant(roomId: number, telegramId: number): Promise<void> {
  await pool.query(
    `UPDATE room_participants SET finished = true, finished_at = NOW()
     WHERE room_id = $1 AND telegram_id = $2`,
    [roomId, telegramId]
  );
}

export async function endRoom(roomId: number): Promise<void> {
  await pool.query(
    `UPDATE practice_rooms SET status = 'ended', ended_at = NOW() WHERE id = $1`,
    [roomId]
  );
  await pool.query(
    `UPDATE room_participants SET finished = true, finished_at = NOW()
     WHERE room_id = $1 AND finished = false`,
    [roomId]
  );
}

export async function getExpiredActiveRooms(): Promise<PracticeRoom[]> {
  const { rows } = await pool.query(
    `SELECT * FROM practice_rooms
     WHERE status = 'active'
     AND started_at + (time_limit_secs || ' seconds')::INTERVAL < NOW()`
  );
  return rows;
}

export async function getExpiredLobbyRooms(): Promise<PracticeRoom[]> {
  const { rows } = await pool.query(
    `SELECT * FROM practice_rooms
     WHERE status = 'waiting'
     AND created_at + INTERVAL '60 seconds' < NOW()`
  );
  return rows;
}

// ── Referral system ───────────────────────────────────────────────────────────

export async function getUserByReferralCode(code: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    'SELECT * FROM users WHERE referral_code = $1',
    [code.toUpperCase()]
  );
  return rows[0] || null;
}

export async function setReferredBy(userId: number, referrerId: number): Promise<void> {
  await pool.query(
    'UPDATE users SET referred_by = $2 WHERE id = $1 AND referred_by IS NULL',
    [userId, referrerId]
  );
}

export async function getConfirmedReferralCount(referrerId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as c FROM users u
     WHERE u.referred_by = $1
       AND EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = u.id)`,
    [referrerId]
  );
  return parseInt(rows[0].c);
}

export async function checkAndGrantReferralReward(
  newUserId: number
): Promise<{ granted: boolean; referrer: User | null }> {
  // Only fires on first-ever attempt
  const { rows: cntRows } = await pool.query(
    'SELECT COUNT(*) as c FROM attempts WHERE user_id = $1',
    [newUserId]
  );
  if (parseInt(cntRows[0].c) !== 1) return { granted: false, referrer: null };

  const { rows: newUserRows } = await pool.query(
    'SELECT referred_by FROM users WHERE id = $1',
    [newUserId]
  );
  const referrerId = newUserRows[0]?.referred_by;
  if (!referrerId) return { granted: false, referrer: null };

  const confirmed = await getConfirmedReferralCount(referrerId);
  if (confirmed < 2) return { granted: false, referrer: null };

  const { rows: referrerRows } = await pool.query<User>(
    'SELECT * FROM users WHERE id = $1',
    [referrerId]
  );
  const referrer = referrerRows[0];
  if (!referrer || referrer.referral_reward_granted) return { granted: false, referrer: null };

  // Extend or start a 3-day Premium window
  await pool.query(
    `UPDATE users SET
       plan = 'premium',
       plan_expires_at = CASE
         WHEN plan_expires_at IS NOT NULL AND plan_expires_at > NOW()
           THEN plan_expires_at + INTERVAL '3 days'
         ELSE NOW() + INTERVAL '3 days'
       END,
       referral_reward_granted = TRUE
     WHERE id = $1`,
    [referrerId]
  );

  const { rows: updatedRows } = await pool.query<User>(
    'SELECT * FROM users WHERE id = $1',
    [referrerId]
  );
  return { granted: true, referrer: updatedRows[0] };
}

// ── Did You Know ──────────────────────────────────────────────────────────────

export interface DidYouKnowFact {
  id: number;
  external_id: string;
  subject: string;
  subject_code: string;
  topic: string | null;
  fact_text: string;
  difficulty: string | null;
}

// Least-recently-used fact per (subject_code, difficulty) pair, not just per subject —
// lets each user get a fact matched to their own level in that subject (see
// getUserSubjectAccuracy) while still sharing one fact per subject+tier across all users
// that day, same as before, rather than a distinct pick per user.
export async function getDailyFactsForSubjects(
  subjectCodes: string[]
): Promise<Record<string, Record<string, DidYouKnowFact>>> {
  if (!subjectCodes.length) return {};

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (subject_code, difficulty)
       id, external_id, subject, subject_code, topic, fact_text, difficulty
     FROM did_you_know
     WHERE subject_code = ANY($1)
     ORDER BY subject_code, difficulty, last_used_at NULLS FIRST, sent_count ASC, RANDOM()`,
    [subjectCodes]
  );

  const map: Record<string, Record<string, DidYouKnowFact>> = {};
  for (const row of rows) {
    const tier = row.difficulty || 'medium';
    if (!map[row.subject_code]) map[row.subject_code] = {};
    map[row.subject_code][tier] = row;
  }
  return map;
}

// A user's accuracy in one subject, across all attempts — used to pick a Did You Know
// fact difficulty that matches where they actually are, instead of a level-blind pick.
// Null means they haven't attempted anything in this subject yet.
export async function getUserSubjectAccuracy(userId: number, subject: string): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy
     FROM attempts a
     JOIN questions q ON a.question_id = q.id
     WHERE a.user_id = $1 AND q.subject = $2`,
    [userId, subject]
  );
  const accuracy = rows[0]?.accuracy;
  return accuracy === null || accuracy === undefined ? null : Number(accuracy);
}

export async function getRandomFact(): Promise<DidYouKnowFact | null> {
  const { rows } = await pool.query(
    `SELECT id, external_id, subject, subject_code, topic, fact_text, difficulty
     FROM did_you_know
     ORDER BY last_used_at NULLS FIRST, sent_count ASC, RANDOM()
     LIMIT 1`
  );
  return rows[0] || null;
}

export async function markFactsSent(factIds: number[]): Promise<void> {
  if (!factIds.length) return;
  await pool.query(
    `UPDATE did_you_know
     SET sent_count = sent_count + 1, last_used_at = NOW()
     WHERE id = ANY($1)`,
    [factIds]
  );
}

// ── Referral leaderboard ──────────────────────────────────────────────────────

export async function getTopReferrers(limit = 10): Promise<{ first_name: string; referrals: number }[]> {
  const { rows } = await pool.query(
    `SELECT u.first_name, COUNT(r.id) as referrals
     FROM users u
     JOIN users r ON r.referred_by = u.id
     WHERE EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = r.id)
     GROUP BY u.id, u.first_name
     ORDER BY referrals DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r: any) => ({ first_name: r.first_name, referrals: parseInt(r.referrals) }));
}

// ── Revision: questions where last attempt was wrong ─────────────────────────

export async function getRevisionQuestions(
  userId: number,
  subjects: string[],
  examType: string | null,
  limit = 15
): Promise<Question[]> {
  const params: any[] = [userId, limit];
  const subjectFilter = subjects.length > 0
    ? `AND q.subject = ANY($${params.length + 1}::text[])`
    : '';
  if (subjects.length > 0) params.push(subjects);

  const examFilter = examType && !isAllExams(examType)
    ? `AND q.exam_type = $${params.length + 1}`
    : '';
  if (examType && !isAllExams(examType)) params.push(examType);

  const { rows } = await pool.query<Question>(
    `SELECT q.* FROM (
       SELECT DISTINCT ON (a.question_id) a.question_id, a.is_correct, a.attempted_at
       FROM attempts a
       WHERE a.user_id = $1
       ORDER BY a.question_id, a.attempted_at DESC
     ) latest
     JOIN questions q ON q.id = latest.question_id
     WHERE latest.is_correct = FALSE
       AND q.is_active = TRUE
       AND (q.has_diagram = FALSE OR q.image_url IS NOT NULL)
       ${subjectFilter}
       ${examFilter}
     ORDER BY latest.attempted_at DESC
     LIMIT $2`,
    params
  );
  return rows;
}

// ── Bookmarks ────────────────────────────────────────────────────────────────

export async function addBookmark(userId: number, questionId: number): Promise<void> {
  await pool.query(
    `INSERT INTO bookmarks (user_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, questionId]
  );
}

export async function removeBookmark(userId: number, questionId: number): Promise<void> {
  await pool.query(`DELETE FROM bookmarks WHERE user_id = $1 AND question_id = $2`, [userId, questionId]);
}

export async function isBookmarked(userId: number, questionId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM bookmarks WHERE user_id = $1 AND question_id = $2`,
    [userId, questionId]
  );
  return rows.length > 0;
}

export async function getBookmarkCount(userId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as cnt FROM bookmarks WHERE user_id = $1`,
    [userId]
  );
  return parseInt(rows[0]?.cnt || '0', 10);
}

export async function getUserBookmarks(userId: number, limit = 50): Promise<Question[]> {
  const { rows } = await pool.query<Question>(
    `SELECT q.* FROM bookmarks b
     JOIN questions q ON q.id = b.question_id
     WHERE b.user_id = $1
       AND q.is_active = TRUE
       AND (q.has_diagram = FALSE OR q.image_url IS NOT NULL)
     ORDER BY b.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function clearBookmarks(userId: number): Promise<void> {
  await pool.query(`DELETE FROM bookmarks WHERE user_id = $1`, [userId]);
}

// ── Progress stats for /progress command ─────────────────────────────────────

export async function getProgressStats(userId: number): Promise<{
  totalAttempts: number;
  accuracy: number;
  subjectCoverage: { subject: string; seen: number; total: number }[];
}> {
  const [attRes, covRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as total,
              ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
       FROM attempts WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT q.subject, COUNT(DISTINCT a.question_id) as seen, totals.total
       FROM attempts a
       JOIN questions q ON a.question_id = q.id
       JOIN (
         SELECT subject, COUNT(*) as total FROM questions
         WHERE is_active = TRUE
         GROUP BY subject
       ) totals ON q.subject = totals.subject
       WHERE a.user_id = $1
       GROUP BY q.subject, totals.total`,
      [userId]
    ),
  ]);
  return {
    totalAttempts: parseInt(attRes.rows[0]?.total || '0'),
    accuracy: parseFloat(attRes.rows[0]?.accuracy || '0'),
    subjectCoverage: covRes.rows.map((r: any) => ({
      subject: r.subject,
      seen: parseInt(r.seen),
      total: parseInt(r.total),
    })),
  };
}

// ── Spaced Repetition ─────────────────────────────────────────────────────────

export async function addSRCard(userId: number, questionId: number): Promise<void> {
  await pool.query(
    `INSERT INTO sr_cards (user_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, questionId]
  );
}

export async function getSRCards(userId: number, limit = 20): Promise<Question[]> {
  const { rows } = await pool.query<Question>(
    `SELECT q.* FROM sr_cards sr
     JOIN questions q ON q.id = sr.question_id
     WHERE sr.user_id = $1
       AND sr.next_review_at <= NOW()
       AND q.is_active = TRUE
     ORDER BY sr.next_review_at ASC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function updateSRCard(userId: number, questionId: number, wasCorrect: boolean): Promise<void> {
  const { rows } = await pool.query(
    `SELECT interval_days, ease, reps FROM sr_cards WHERE user_id = $1 AND question_id = $2`,
    [userId, questionId]
  );
  if (!rows.length) return;
  const { interval_days, ease, reps } = rows[0];

  let newInterval: number;
  let newEase: number;
  let newReps: number;

  if (wasCorrect) {
    newReps = reps + 1;
    newInterval = Math.min(Math.round(interval_days * ease), 30);
    newEase = ease; // keep ease constant (simple SM-2 variant)
  } else {
    newReps = 0;
    newInterval = 1;
    newEase = Math.max(1.3, ease - 0.2);
  }

  await pool.query(
    `UPDATE sr_cards
     SET interval_days = $1, ease = $2, reps = $3,
         next_review_at = NOW() + $1::integer * INTERVAL '1 day'
     WHERE user_id = $4 AND question_id = $5`,
    [newInterval, newEase, newReps, userId, questionId]
  );
}

export async function getSRDueCount(userId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as cnt FROM sr_cards WHERE user_id = $1 AND next_review_at <= NOW()`,
    [userId]
  );
  return parseInt(rows[0]?.cnt || '0', 10);
}

export async function getSRTotalCount(userId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as cnt FROM sr_cards WHERE user_id = $1`,
    [userId]
  );
  return parseInt(rows[0]?.cnt || '0', 10);
}

// ── Achievements ──────────────────────────────────────────────────────────────

export async function grantBadge(userId: number, code: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO achievements (user_id, badge_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, code]
  );
  return (rowCount ?? 0) > 0;
}

export async function getUserBadgeCodes(userId: number): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT badge_code FROM achievements WHERE user_id = $1 ORDER BY unlocked_at ASC`,
    [userId]
  );
  return rows.map((r: any) => r.badge_code);
}

// ── Topic mastery breakdown ───────────────────────────────────────────────────

export async function getTopicMastery(
  userId: number,
  subject: string,
  examType?: string
): Promise<{ topic: string; attempts: number; correct: number; accuracy: number }[]> {
  const filtered = examType && examType !== 'all';
  const params: any[] = filtered ? [userId, subject, examType] : [userId, subject];
  const { rows } = await pool.query(
    `SELECT q.topic,
            COUNT(*) AS attempts,
            SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) AS correct,
            ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / COUNT(*), 1) AS accuracy
     FROM attempts a
     JOIN questions q ON a.question_id = q.id
     WHERE a.user_id = $1 AND q.subject = $2 AND q.topic IS NOT NULL
     ${filtered ? 'AND q.exam_type = $3' : ''}
     GROUP BY q.topic HAVING COUNT(*) >= 1
     ORDER BY accuracy ASC, attempts DESC`,
    params
  );
  return rows.map((r: any) => ({
    topic: r.topic,
    attempts: parseInt(r.attempts),
    correct: parseInt(r.correct),
    accuracy: parseFloat(r.accuracy),
  }));
}

// ── Explanation quality feedback ──────────────────────────────────────────────

export async function saveExplanationFeedback(
  userId: number,
  questionId: number,
  rating: 1 | -1
): Promise<void> {
  await pool.query(
    `INSERT INTO explanation_feedback (user_id, question_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, question_id) DO UPDATE SET rating = EXCLUDED.rating`,
    [userId, questionId, rating]
  );
}

// ── Theory questions ──────────────────────────────────────────────────────────


// ── User lookup by Telegram username (for duel) ───────────────────────────────

export async function getUserByUsername(username: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    `SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [username.replace(/^@/, '')]
  );
  return rows[0] || null;
}

// ── System alerts (surfaced in admin UI — crons/jobs report failures here) ───

export interface SystemAlert {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  source: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

export async function createAlert(
  source: string,
  message: string,
  severity: 'info' | 'warning' | 'critical' = 'warning'
): Promise<void> {
  await pool.query(
    `INSERT INTO system_alerts (source, message, severity) VALUES ($1, $2, $3)`,
    [source, message, severity]
  );
}

export async function getUnresolvedAlerts(): Promise<SystemAlert[]> {
  const { rows } = await pool.query<SystemAlert>(
    `SELECT id, severity, source, message, resolved, created_at
     FROM system_alerts WHERE resolved = false
     ORDER BY created_at DESC LIMIT 100`
  );
  return rows;
}

export async function resolveAlert(id: number): Promise<void> {
  await pool.query(`UPDATE system_alerts SET resolved = true WHERE id = $1`, [id]);
}

// ── Landing-page analytics (in-house — no third-party pixel/SDK) ────────────

export interface PageViewInput {
  path: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  visitorId: string;
}

export async function logPageView(v: PageViewInput): Promise<void> {
  await pool.query(
    `INSERT INTO page_views (path, referrer, utm_source, utm_medium, utm_campaign, visitor_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [v.path, v.referrer, v.utmSource, v.utmMedium, v.utmCampaign, v.visitorId]
  );
}

export interface PageViewAnalytics {
  totalViews: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number }[];
  topSources: { source: string; views: number }[];
  daily: { date: string; views: number; uniques: number }[];
}

// Buckets a raw referrer/utm_source pair into a human-readable channel name. Done in JS
// rather than a giant SQL CASE — the traffic volume here doesn't need the DB to do this.
function bucketSource(referrer: string | null, utmSource: string | null): string {
  const s = (utmSource || '').toLowerCase();
  const r = (referrer || '').toLowerCase();
  if (s.includes('tiktok') || r.includes('tiktok')) return 'TikTok';
  if (s.includes('instagram') || r.includes('instagram') || s === 'ig') return 'Instagram';
  if (s.includes('telegram') || r.includes('t.me') || r.includes('telegram')) return 'Telegram';
  if (r.includes('google.') || s.includes('google')) return 'Google';
  if (r.includes('bing.') || r.includes('duckduckgo')) return 'Other Search';
  if (r.includes('facebook.') || s.includes('facebook') || s === 'fb') return 'Facebook';
  if (r.includes('x.com') || r.includes('twitter.com') || s.includes('twitter')) return 'X / Twitter';
  if (!referrer && !utmSource) return 'Direct';
  return 'Other';
}

export async function getPageViewAnalytics(days = 30): Promise<PageViewAnalytics> {
  const [totals, pages, sources, daily] = await Promise.all([
    pool.query<{ total: string; uniques: string }>(
      `SELECT COUNT(*) as total, COUNT(DISTINCT visitor_id) as uniques
       FROM page_views WHERE created_at > NOW() - INTERVAL '1 day' * $1`,
      [days]
    ),
    pool.query<{ path: string; views: string }>(
      `SELECT path, COUNT(*) as views FROM page_views
       WHERE created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY path ORDER BY views DESC LIMIT 10`,
      [days]
    ),
    pool.query<{ referrer: string | null; utm_source: string | null; views: string }>(
      `SELECT referrer, utm_source, COUNT(*) as views FROM page_views
       WHERE created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY referrer, utm_source`,
      [days]
    ),
    pool.query<{ day: string; views: string; uniques: string }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
              COUNT(*) as views, COUNT(DISTINCT visitor_id) as uniques
       FROM page_views
       WHERE created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY day ORDER BY day ASC`,
      [days]
    ),
  ]);

  const sourceTotals: Record<string, number> = {};
  for (const row of sources.rows) {
    const bucket = bucketSource(row.referrer, row.utm_source);
    sourceTotals[bucket] = (sourceTotals[bucket] || 0) + parseInt(row.views, 10);
  }
  const topSources = Object.entries(sourceTotals)
    .map(([source, views]) => ({ source, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    totalViews: parseInt(totals.rows[0]?.total || '0', 10),
    uniqueVisitors: parseInt(totals.rows[0]?.uniques || '0', 10),
    topPages: pages.rows.map(r => ({ path: r.path, views: parseInt(r.views, 10) })),
    topSources,
    daily: daily.rows.map(r => ({ date: r.day, views: parseInt(r.views, 10), uniques: parseInt(r.uniques, 10) })),
  };
}
