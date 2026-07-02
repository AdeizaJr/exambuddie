// src/services/pricing.ts — admin-editable pricing/free-limit settings
// Backed by the `settings` table, cached in-memory (single-process app — see index.ts).
import * as db from '../db';

export interface PricingSettings {
  monthly_ngn: number;
  term_ngn: number;
  yearly_ngn: number;
  free_daily_limit: number;
}

export interface PricingHistoryEntry {
  key: string;
  old_value: string | null;
  new_value: string;
  updated_by: string | null;
  updated_at: string;
}

const DEFAULTS: PricingSettings = {
  monthly_ngn: 1500,
  term_ngn: 3500,
  yearly_ngn: 12000,
  free_daily_limit: 5,
};

let cache: PricingSettings = DEFAULTS;

async function loadFromDb(): Promise<PricingSettings> {
  const { rows } = await db.query('SELECT key, value FROM settings');
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    monthly_ngn: parseInt(map.monthly_ngn ?? String(DEFAULTS.monthly_ngn), 10),
    term_ngn: parseInt(map.term_ngn ?? String(DEFAULTS.term_ngn), 10),
    yearly_ngn: parseInt(map.yearly_ngn ?? String(DEFAULTS.yearly_ngn), 10),
    free_daily_limit: parseInt(map.free_daily_limit ?? String(DEFAULTS.free_daily_limit), 10),
  };
}

// Call once at boot, before the bot/API start serving traffic.
export async function initPricing(): Promise<void> {
  cache = await loadFromDb();
}

// Periodic backstop refresh (see cron.ts) — cheap, and guards against the cache
// drifting if a write ever happens outside updatePricing().
export async function refreshPricing(): Promise<void> {
  cache = await loadFromDb();
}

// Synchronous by design: everything that renders a price (bot messages, payment
// links) reads this without threading async through call sites.
export function getPricing(): PricingSettings {
  return cache;
}

export async function updatePricing(
  changes: Partial<PricingSettings>,
  updatedBy: string
): Promise<PricingSettings> {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      const { rows } = await client.query('SELECT value FROM settings WHERE key = $1', [key]);
      const oldValue: string | null = rows[0]?.value ?? null;
      const newValue = String(value);
      await client.query(
        `INSERT INTO settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
        [key, newValue, updatedBy]
      );
      await client.query(
        `INSERT INTO settings_history (key, old_value, new_value, updated_by)
         VALUES ($1, $2, $3, $4)`,
        [key, oldValue, newValue, updatedBy]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await refreshPricing();
  return cache;
}

export async function getPricingHistory(limit = 50): Promise<PricingHistoryEntry[]> {
  const { rows } = await db.query(
    `SELECT key, old_value, new_value, updated_by, updated_at
     FROM settings_history ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}
