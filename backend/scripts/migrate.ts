// scripts/migrate.ts — Run all DB migrations
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  // ── Users ───────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100),
    first_name VARCHAR(100),
    exam_type VARCHAR(20) DEFAULT NULL,           -- 'WAEC' | 'JAMB'
    subjects TEXT[] DEFAULT '{}',                 -- ['math','english',...]
    target_year INT DEFAULT NULL,
    plan VARCHAR(20) DEFAULT 'free',              -- 'free' | 'premium'
    plan_expires_at TIMESTAMPTZ DEFAULT NULL,
    daily_count INT DEFAULT 0,
    daily_reset_at DATE DEFAULT CURRENT_DATE,
    streak INT DEFAULT 0,
    last_active_date DATE DEFAULT NULL,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Subjects master list ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,   -- 'math', 'english', 'biology' etc.
    name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10)
  )`,

  // ── Questions ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    exam_type VARCHAR(10) NOT NULL,       -- 'WAEC' | 'JAMB'
    subject VARCHAR(30) NOT NULL,
    year INT NOT NULL,
    topic VARCHAR(100),
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL,      -- 'A' | 'B' | 'C' | 'D'
    explanation TEXT,
    explanation_reviewed BOOLEAN DEFAULT FALSE,
    flag_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_questions_exam_subject ON questions(exam_type, subject)`,
  `CREATE INDEX IF NOT EXISTS idx_questions_subject_topic ON questions(subject, topic)`,
  `CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year)`,

  // ── Scraped-data additions ───────────────────────────────────────────────────
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_e TEXT`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_id VARCHAR(30)`,
  `DROP INDEX IF EXISTS idx_questions_source_id`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_source_id ON questions(source_id)`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT`,

  // ── Flagged explanations ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS flagged_explanations (
    id SERIAL PRIMARY KEY,
    question_id INT REFERENCES questions(id),
    user_id INT REFERENCES users(id),
    reason TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    flagged_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Attempts (session logging) ───────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS attempts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    question_id INT REFERENCES questions(id),
    selected_option CHAR(1),
    is_correct BOOLEAN,
    time_taken_ms INT,
    session_id VARCHAR(50),
    attempted_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id)`,

  // ── Sessions ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(50) PRIMARY KEY,
    user_id INT REFERENCES users(id),
    mode VARCHAR(20) NOT NULL,            -- 'practice' | 'quiz' | 'drill'
    subject VARCHAR(30),
    topic VARCHAR(100),
    total_questions INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ DEFAULT NULL,
    time_limit_secs INT DEFAULT NULL      -- NULL = no timer
  )`,

  // ── Subscriptions ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    plan VARCHAR(20) NOT NULL,
    amount_ngn INT NOT NULL,
    flutterwave_tx_ref VARCHAR(100) UNIQUE,
    flutterwave_tx_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending'|'active'|'expired'|'failed'
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Admin users ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS admin_users (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Strip "explanation video available below" from explanations ────────────
  `UPDATE questions
   SET explanation = REGEXP_REPLACE(explanation, '\n?[Tt]here is an explanation video available below[^\n]*', '', 'g')
   WHERE explanation ILIKE '%explanation video available below%'`,

  // ── Flag questions that reference diagrams/images (unanswerable without visual) ──
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS has_diagram BOOLEAN DEFAULT FALSE`,
  `UPDATE questions SET has_diagram = TRUE WHERE
    question_text ILIKE '%diagram%' OR
    question_text ILIKE '%figure above%' OR
    question_text ILIKE '%figure below%' OR
    question_text ILIKE '%shown below%' OR
    question_text ILIKE '%shown above%' OR
    question_text ILIKE '%above shows%' OR
    question_text ILIKE '%chart above%' OR
    question_text ILIKE '%chart below%' OR
    question_text ILIKE '%illustration above%' OR
    question_text ILIKE '%illustration below%' OR
    question_text ILIKE '%the diagram%' OR
    question_text ILIKE '%use the%above%' OR
    question_text ~* 'Fig\\.\\s*[0-9]' OR
    question_text ~* 'Figure\\s+[0-9]' OR
    question_text ILIKE '%table above%' OR
    question_text ILIKE '%table below%' OR
    question_text ~* 'Table\\s+[0-9]' OR
    question_text ILIKE '%use the table%' OR
    question_text ILIKE '%shown in the table%' OR
    question_text ILIKE '%the figure%' OR
    question_text ILIKE '%venn diagram%' OR
    question_text ILIKE '%circuit above%' OR
    question_text ILIKE '%circuit below%' OR
    question_text ~* '\\y(part|path|curve)\\s+labeled\\s+[ivx0-9]' OR
    explanation ILIKE '%chart provided%' OR
    explanation ILIKE '%diagram provided%' OR
    explanation ILIKE '%graph provided%' OR
    explanation ILIKE '%from the chart%' OR
    explanation ILIKE '%from the diagram%' OR
    explanation ILIKE '%from the graph%' OR
    explanation ILIKE '%from the figure%' OR
    explanation ILIKE '%shown in the chart%' OR
    explanation ILIKE '%shown in the diagram%' OR
    explanation ILIKE '%shown in the figure%' OR
    explanation ILIKE '%pie chart%' OR
    explanation ILIKE '%bar chart%'`,

  // ── Streak tracking columns (added after initial prod deploy) ───────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INT DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date DATE DEFAULT NULL`,

  // ── Phone number (collected during onboarding, optional) ─────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) DEFAULT NULL`,

  // ── Normalize "From the novel;" questions: trim indentation + collapse blank lines ──
  // Pass 1: strip leading whitespace from each line (e.g. "    This question..." → "This question...")
  // Pass 2: collapse 3+ consecutive newlines to 2
  // Result: stored data is clean for bot, miniapp, and admin-ui
  `UPDATE questions
   SET question_text = TRIM(
     REGEXP_REPLACE(
       REGEXP_REPLACE(question_text, E'\\n[ \\t]+', E'\\n', 'g'),
       E'\\n{3,}', E'\\n\\n', 'g'
     )
   )
   WHERE question_text LIKE 'From the novel;%'`,

  // ── Flag chart/graph questions missed by initial has_diagram pass ────────────
  `UPDATE questions SET has_diagram = TRUE WHERE has_diagram = FALSE AND (
    question_text ILIKE '%bar chart%' OR
    question_text ILIKE '%pie chart%' OR
    question_text ILIKE '%histogram%' OR
    question_text ILIKE '%the graph%' OR
    question_text ILIKE '%from the graph%' OR
    question_text ILIKE '%graph shows%' OR
    question_text ILIKE '%graph above%' OR
    question_text ILIKE '%graph below%' OR
    question_text ILIKE '%the bar chart%' OR
    question_text ILIKE '%the pie chart%' OR
    question_text ILIKE '%frequency polygon%' OR
    question_text ILIKE '%ogive%' OR
    question_text ILIKE '%cumulative frequency%curve%' OR
    question_text ILIKE '%the histogram%'
  )`,

  // ── Referral system ──────────────────────────────────────────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INT REFERENCES users(id)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_reward_granted BOOLEAN DEFAULT FALSE`,
  `CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`,
  `CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by)`,

  // ── Challenge rooms ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS practice_rooms (
    id SERIAL PRIMARY KEY,
    code VARCHAR(8) UNIQUE NOT NULL,
    creator_telegram_id BIGINT NOT NULL,
    subject TEXT NOT NULL,
    exam_type TEXT NOT NULL,
    year INT,
    question_ids INT[] NOT NULL DEFAULT '{}',
    num_questions INT NOT NULL DEFAULT 10,
    time_limit_secs INT NOT NULL DEFAULT 600,
    status TEXT NOT NULL DEFAULT 'waiting',
    max_players INT NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS room_participants (
    id SERIAL PRIMARY KEY,
    room_id INT REFERENCES practice_rooms(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    first_name TEXT NOT NULL,
    current_q_idx INT NOT NULL DEFAULT 0,
    correct INT NOT NULL DEFAULT 0,
    total_answered INT NOT NULL DEFAULT 0,
    ready BOOLEAN NOT NULL DEFAULT FALSE,
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    finished_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, telegram_id)
  )`,

  // ── Fix log explanation: WAEC Math 2013 log question (id 115983) ──
  `UPDATE questions SET explanation = $expl$<b>Step 1: Simplify 3³⁄₈</b>
3³⁄₈ = 27/8 (mixed number to improper fraction)

<b>Step 2: Divide both sides by 2</b>
2 logₓ(27/8) = 6
logₓ(27/8) = 3

<b>Step 3: Convert to exponential form</b>
x³ = 27/8

<b>Step 4: Solve for x</b>
x = ∛(27/8) = ∛27 / ∛8 = 3/2

∴ x = ³⁄₂$expl$
WHERE id = 115983`,

  // ── Fix packed trig explanation: WAEC Math 2016 cosine question (id 116126) ──
  `UPDATE questions SET explanation = $expl$sin 60° = x + 0.5 (given)
0.8660 = x + 0.5
0.8660 - 0.5 = x
x = 0.3660

cosθ = x (given)
cosθ = 0.3660

Hence, θ = cos-1(0.3660) = 68.53° = 69° (nearest degree)$expl$
WHERE id = 116126`,

  // ── Improved step-by-step explanation: WAEC Math 2016 median age (id 116125) ──
  `UPDATE questions SET explanation = $expl$Let's find the median age.

<b>Step 1: Total frequency</b>
10 + 24 + 8 + 5 + 3 = 50

<b>Step 2: Median position</b>
N = 50 (even), so the median is the average of the 25th and 26th values.
N/2 = 50/2 = 25

<b>Step 3: Cumulative frequencies</b>
<code>Age  Freq  Cumulative
 13    10        10
 14    24        34
 15     8        42
 16     5        47
 17     3        50</code>

The 25th and 26th values both fall within the group for age 14 (cumulative frequency = 34, since 10 &lt; 25 ≤ 34).

∴ Median age = 14 years.$expl$
WHERE id = 116125`,

  // ── Backfill referral codes for users who existed before the column was added ──
  `DO $$
   DECLARE r RECORD; chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code TEXT;
   BEGIN
     FOR r IN SELECT id FROM users WHERE referral_code IS NULL LOOP
       LOOP
         code := '';
         FOR i IN 1..8 LOOP
           code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
         END LOOP;
         BEGIN
           UPDATE users SET referral_code = code WHERE id = r.id;
           EXIT;
         EXCEPTION WHEN unique_violation THEN
           -- collision: retry with a new code
         END;
       END LOOP;
     END LOOP;
   END $$`,
];

async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🗄️  Running migrations...');
    for (const sql of migrations) {
      await client.query(sql);
      const preview = sql.slice(0, 60).replace(/\n/g, ' ');
      console.log(`  ✓ ${preview}...`);
    }
    console.log('\n✅ All migrations complete.\n');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
