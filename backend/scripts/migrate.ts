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

  // ── Paystack columns (migration from Flutterwave) ───────────────────────────
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_tx_ref VARCHAR(100) UNIQUE`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_tx_id VARCHAR(100)`,

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
  // NOTE: the original one-time backfill UPDATE that lived here (loose ILIKE/regex match on
  // question_text/explanation) was removed 2026-07-24. This array has no per-statement
  // "already applied" tracking - every entry reruns on every deploy via `prestart` - so a
  // data-mutating heuristic UPDATE like that one re-flipped has_diagram back to TRUE on every
  // restart, undoing any correction made by fixDiagramFlags.ts or an admin in between deploys.
  // It already did its job for the rows that existed at the time; leaving it in only kept
  // reintroducing false positives. New rows default to has_diagram=FALSE via the column default
  // (import.ts doesn't set it either).

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

  // ── (removed 2026-07-24: same re-flipping problem as the pass above, see note there) ──

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

  // ── Strip "From the novel;" prefix from question_text ───────────────────────
  `UPDATE questions
   SET question_text = TRIM(REGEXP_REPLACE(question_text, E'^From the novel;\\s*', '', 'i'))
   WHERE question_text ~* '^From the novel;'`,

  // ── Fix scraping artifact: "A - E[Capital]" missing period+space ──────────
  // e.g. "options lettered A - EAction" → "options lettered A - E. Action"
  `UPDATE questions
   SET question_text = REGEXP_REPLACE(question_text, 'A - E([A-Z])', E'A - E. \\1', 'g')
   WHERE question_text ~ 'A - E[A-Z]'`,

  // ── Weekly report send tracking ───────────────────────────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_report_sent_at TIMESTAMP`,

  // ── Did You Know fact bank ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS did_you_know (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(20) UNIQUE NOT NULL,
    subject VARCHAR(50) NOT NULL,
    subject_code VARCHAR(30) NOT NULL DEFAULT '',
    topic VARCHAR(100),
    fact_text TEXT NOT NULL,
    difficulty VARCHAR(10),
    sent_count INT DEFAULT 0,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `ALTER TABLE did_you_know ADD COLUMN IF NOT EXISTS subject_code VARCHAR(30) NOT NULL DEFAULT ''`,
  `ALTER TABLE did_you_know ADD COLUMN IF NOT EXISTS external_id VARCHAR(20)`,
  `ALTER TABLE did_you_know ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10)`,
  `ALTER TABLE did_you_know DROP COLUMN IF EXISTS wikipedia_title`,
  `DELETE FROM did_you_know WHERE external_id IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS did_you_know_external_id_key ON did_you_know(external_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dyk_subject_code ON did_you_know(subject_code)`,
  `CREATE INDEX IF NOT EXISTS idx_dyk_last_used ON did_you_know(last_used_at NULLS FIRST, sent_count ASC)`,

  // ── Streak freeze (premium: once/week) ────────────────────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freeze_used_at DATE DEFAULT NULL`,

  // ── Trial period flag (14-day free Premium on first onboarding) ──────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE`,

  // ── Daily reminder opt-in (WAT hour 0–23, NULL = off) ─────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_reminder_hour INTEGER DEFAULT NULL`,

  // ── Default daily reminder to 6pm WAT ─────────────────────────────────────
  // Was opt-in-only via a buried settings menu, so nobody had set an hour and the
  // hourly auto-challenge cron never matched anyone. Defaulting new signups to 18
  // (WAT) and backfilling existing users who never touched the setting turns it on
  // for everyone unless they explicitly change/disable it in Settings.
  `ALTER TABLE users ALTER COLUMN daily_reminder_hour SET DEFAULT 18`,
  `UPDATE users SET daily_reminder_hour = 18 WHERE daily_reminder_hour IS NULL`,

  // ── Acquisition source tracking ───────────────────────────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT NULL`,

  // ── Weekly leaderboard snapshots ──────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id SERIAL PRIMARY KEY,
    week_start DATE NOT NULL,
    rank INT NOT NULL,
    telegram_id BIGINT NOT NULL,
    first_name TEXT NOT NULL,
    correct INT NOT NULL,
    total INT NOT NULL,
    accuracy NUMERIC(5,1) NOT NULL,
    snapshotted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(week_start, rank)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lb_snapshots_week ON leaderboard_snapshots(week_start)`,

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, question_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id)`,

  // ── Soft-hide questions (e.g. mislabeled year) without deleting them ──────
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`,
  `CREATE INDEX IF NOT EXISTS idx_questions_is_active ON questions(is_active)`,

  // ── NDPA compliance: store consent timestamp ──────────────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ DEFAULT NULL`,

  // ── Spaced repetition cards — per-(user, question) review intervals ────────
  `CREATE TABLE IF NOT EXISTS sr_cards (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    interval_days INT NOT NULL DEFAULT 1,
    ease FLOAT NOT NULL DEFAULT 2.5,
    reps INT NOT NULL DEFAULT 0,
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, question_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sr_cards_user_due ON sr_cards(user_id, next_review_at)`,

  // ── Achievements / badges ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    badge_code VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_code)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id)`,

  // ── Explanation quality feedback ──────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS explanation_feedback (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, question_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_expl_feedback_question ON explanation_feedback(question_id)`,

  // ── Broadcast log ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS broadcast_log (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    target VARCHAR(20) NOT NULL,
    sent INT NOT NULL DEFAULT 0,
    failed INT NOT NULL DEFAULT 0,
    total INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_broadcast_log_sent_at ON broadcast_log(sent_at DESC)`,

  // ── Theory questions ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS theory_questions (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(30) UNIQUE NOT NULL,
    exam_type VARCHAR(10) NOT NULL,
    subject VARCHAR(50) NOT NULL,
    year INT NOT NULL,
    question_text TEXT NOT NULL,
    worked_solution TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_theory_subject_year ON theory_questions(subject, year, exam_type)`,
  `CREATE INDEX IF NOT EXISTS idx_theory_active ON theory_questions(is_active, subject)`,

  // ── Theory attempts ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS theory_attempts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    question_id INT REFERENCES theory_questions(id) ON DELETE CASCADE,
    user_answer TEXT,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_theory_attempts_user ON theory_attempts(user_id, attempted_at DESC)`,

  // ── Settings (admin-editable key-value config, e.g. pricing) ────────────────
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS settings_history (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_settings_history_key ON settings_history(key, updated_at DESC)`,
  // Seed pricing defaults (was previously hardcoded via env vars) — no-op if already set
  `INSERT INTO settings (key, value) VALUES
    ('monthly_ngn', '1500'),
    ('term_ngn', '3500'),
    ('yearly_ngn', '12000'),
    ('free_daily_limit', '5')
   ON CONFLICT (key) DO NOTHING`,

  // ── Recurring billing (Paystack subscriptions) ───────────────────────────────
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_plan_code VARCHAR(100)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_subscription_code VARCHAR(100)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_customer_code VARCHAR(100)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS email_token VARCHAR(255)`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_code ON subscriptions(paystack_customer_code)`,

  // ── System alerts (surfaced in admin UI — crons/jobs report failures here) ──
  `CREATE TABLE IF NOT EXISTS system_alerts (
    id SERIAL PRIMARY KEY,
    severity TEXT NOT NULL DEFAULT 'warning',
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved ON system_alerts(resolved, created_at DESC)`,

  // ── Activation nudge (one-time DM if a new user never answers a question) ──
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_nudge_sent_at TIMESTAMPTZ DEFAULT NULL`,

  // ── Onboarding nudge (one-time DM if a new user never finished picking exam_type) ──
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_nudge_sent_at TIMESTAMPTZ DEFAULT NULL`,

  // ── In-house landing-page analytics (no third-party pixel/SDK) ────────────
  `CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    path TEXT NOT NULL,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    visitor_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path)`,

  // ── QOTD / Did You Know send tracking (so recipients are actually queryable) ──
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_qotd_sent_at TIMESTAMPTZ DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_dyk_sent_at TIMESTAMPTZ DEFAULT NULL`,

  // ── Audit logs (admin actions) — append-only, enforced by trigger below, not
  // just app-level convention. Even a compromised admin's own DB credentials
  // can't UPDATE/DELETE a row here, only INSERT new ones. ──────────────────
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_username)`,
  `CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS TRIGGER AS $$
   BEGIN
     RAISE EXCEPTION 'audit_logs is append-only — % not permitted', TG_OP;
   END;
   $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs`,
  `CREATE TRIGGER trg_audit_logs_immutable
   BEFORE UPDATE OR DELETE ON audit_logs
   FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable()`,
  // TRUNCATE bypasses row-level triggers entirely — needs its own statement-level guard.
  `DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs`,
  `CREATE TRIGGER trg_audit_logs_no_truncate
   BEFORE TRUNCATE ON audit_logs
   FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable()`,

  // ── Trial grants (survives account deletion) ─────────────────────────────────
  // users.trial_used gets wiped when deleteUser() hard-deletes the row, letting
  // someone delete + rejoin for a second free 14-day trial. This table is never
  // touched by deleteUser(), so it's the durable record grantTrial() checks instead.
  `CREATE TABLE IF NOT EXISTS trial_grants (
    telegram_id BIGINT PRIMARY KEY,
    granted_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  // Backfill: anyone who already used a trial under the old column-only tracking
  // needs a row here too, or they'd get a second trial by deleting + rejoining
  // after this ships, even though they never actually deleted before.
  `INSERT INTO trial_grants (telegram_id)
   SELECT telegram_id FROM users WHERE trial_used = TRUE
   ON CONFLICT (telegram_id) DO NOTHING`,

  // ── Bug reports (saved so they survive a missing SUPPORT_CHAT_ID / email) ──
  `CREATE TABLE IF NOT EXISTS bug_reports (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    name TEXT,
    message TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bug_reports_resolved ON bug_reports(resolved, created_at DESC)`,
  // Screenshots: Telegram file_ids (Telegram hosts the files). media_group_id lets the
  // photos of one album land in a single report even though they arrive as separate updates.
  `ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS photo_file_ids TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS media_group_id TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_bug_reports_media_group ON bug_reports(media_group_id) WHERE media_group_id IS NOT NULL`,

  // ── "Your report was fixed" DMs: stamped when sent so a reopen + re-resolve doesn't message twice.
  // Rows resolved before this shipped are stamped too, so nobody gets a late message for them.
  `ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ`,
  `ALTER TABLE flagged_explanations ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ`,
  `UPDATE bug_reports SET notified_at = NOW() WHERE resolved AND notified_at IS NULL`,
  `UPDATE flagged_explanations SET notified_at = NOW() WHERE resolved AND notified_at IS NULL`,
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
