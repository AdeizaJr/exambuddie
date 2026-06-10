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
   WHERE explanation ILIKE '%explanation video available below%'`
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
