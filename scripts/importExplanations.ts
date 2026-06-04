// scripts/importExplanations.ts
// Reads all JSON files from explanations/ and updates the explanation column
// in the questions table by matching on id.
//
// Usage:
//   ts-node scripts/importExplanations.ts

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const EXPLANATIONS_DIR = path.join(__dirname, '../explanations');

interface ExplanationRecord {
  id: number;
  explanation: string;
}

async function run(): Promise<void> {
  const files = fs.readdirSync(EXPLANATIONS_DIR).filter((f) => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No JSON files found in explanations/');
    return;
  }

  console.log(`\nFound ${files.length} files in explanations/\n`);

  const client = await pool.connect();
  let totalUpdated = 0;
  let totalSkipped = 0;

  try {
    for (const file of files) {
      const filePath = path.join(EXPLANATIONS_DIR, file);
      const raw = fs.readFileSync(filePath, 'utf-8');

      let records: ExplanationRecord[];
      try {
        records = JSON.parse(raw);
      } catch {
        console.warn(`  ✗ Invalid JSON: ${file} — skipping`);
        continue;
      }

      if (!Array.isArray(records) || records.length === 0) {
        console.log(`  ⏭  ${file}: empty — skipping`);
        continue;
      }

      process.stdout.write(`  ${file} (${records.length} records) ... `);

      let fileUpdated = 0;
      for (const rec of records) {
        if (!rec.id || !rec.explanation) {
          totalSkipped++;
          continue;
        }

        const result = await client.query(
          `UPDATE questions SET explanation = $1 WHERE id = $2`,
          [rec.explanation, rec.id],
        );

        if (result.rowCount && result.rowCount > 0) {
          fileUpdated++;
        } else {
          totalSkipped++;
        }
      }

      totalUpdated += fileUpdated;
      console.log(`✓ ${fileUpdated} updated`);
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n✅ Done: ${totalUpdated} updated, ${totalSkipped} skipped.\n`);
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
