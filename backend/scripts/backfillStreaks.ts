// scripts/backfillStreaks.ts — Recompute user.streak from real attempt history
// Run: ts-node scripts/backfillStreaks.ts
// One-time fix for the updateStreak() DATE-vs-string comparison bug (streak was
// always 1, never incrementing). Computes the longest run of consecutive
// calendar days (UTC) ending at each user's most recent attempt date.

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query(`
    WITH user_dates AS (
      SELECT DISTINCT user_id, attempted_at::date AS d
      FROM attempts
    ),
    ranked AS (
      SELECT user_id, d,
             d - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d))::int AS grp
      FROM user_dates
    ),
    streaks AS (
      SELECT user_id, grp, MAX(d) AS end_d, COUNT(*) AS streak_len
      FROM ranked
      GROUP BY user_id, grp
    ),
    last_streak AS (
      SELECT s.user_id, s.streak_len
      FROM streaks s
      JOIN (
        SELECT user_id, MAX(end_d) AS max_end_d FROM streaks GROUP BY user_id
      ) m ON s.user_id = m.user_id AND s.end_d = m.max_end_d
    )
    UPDATE users u
    SET streak = ls.streak_len
    FROM last_streak ls
    WHERE u.id = ls.user_id
    RETURNING u.id, u.telegram_id, u.streak;
  `);

  console.log(`Backfilled streak for ${rows.length} users.`);
  for (const r of rows) {
    console.log(`  user ${r.telegram_id}: streak=${r.streak}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
