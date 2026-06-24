// scripts/auditImageUrls.ts
// Tests every stored image_url and NULLs out broken ones.
// Safe to re-run — only touches rows where image_url IS NOT NULL.
//
// Usage:
//   npx ts-node scripts/auditImageUrls.ts
//   npx ts-node scripts/auditImageUrls.ts --dry-run

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import axios from 'axios';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 5;
const TIMEOUT_MS = 8000;

// data: URIs are inline images — always valid, no HTTP check needed
function isDataUri(url: string): boolean {
  return url.startsWith('data:');
}

// Returns true only if the final URL responds with HTTP 200
async function checkUrl(url: string): Promise<boolean> {
  if (isDataUri(url)) return true;
  try {
    const res = await axios.head(url, {
      timeout: TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: (s) => s === 200,
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function runBatch(rows: { id: number; image_url: string }[]): Promise<{ nulled: number; ok: number }> {
  let nulled = 0, ok = 0;
  await Promise.all(rows.map(async (row) => {
    const alive = await checkUrl(row.image_url);
    if (alive) {
      ok++;
      process.stdout.write('.');
    } else {
      nulled++;
      process.stdout.write('✗');
      if (!DRY_RUN) {
        await pool.query('UPDATE questions SET image_url = NULL WHERE id = $1', [row.id]);
      }
    }
  }));
  return { nulled, ok };
}

async function main() {
  const { rows } = await pool.query<{ id: number; image_url: string }>(
    'SELECT id, image_url FROM questions WHERE image_url IS NOT NULL ORDER BY id'
  );

  console.log(`\n🔍 Auditing ${rows.length} image URLs${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  let totalNulled = 0, totalOk = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const { nulled, ok } = await runBatch(batch);
    totalNulled += nulled;
    totalOk += ok;
  }

  console.log(`\n\n✅ Done.`);
  console.log(`   Valid:   ${totalOk}`);
  console.log(`   Broken (${DRY_RUN ? 'would null' : 'nulled'}): ${totalNulled}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
