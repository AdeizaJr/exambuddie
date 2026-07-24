// scripts/clearStaleDiagramFlags.ts — one-time cleanup
//
// Clears has_diagram on questions where fixDiagramFlags.ts already confirmed (source_id set,
// so it was attempted) there's no image to find on myschool.ng. These are false positives from
// the old has_diagram regex heuristic that used to live in migrate.ts (removed 2026-07-24, see
// import.ts) — questions that mention "diagram"/"table"/"figure" in passing but already have
// all the data they reference reproduced as text in question_text, so they're fully answerable
// without an image. has_diagram isn't read anywhere in the send path (only image_url is), so
// this only fixes admin-UI accuracy, not anything student-facing.
//
// Run: ts-node scripts/clearStaleDiagramFlags.ts

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run(): Promise<void> {
  const { rowCount } = await pool.query(`
    UPDATE questions
    SET has_diagram = FALSE
    WHERE has_diagram = TRUE
      AND (image_url IS NULL OR image_url = '')
      AND source_id IS NOT NULL
  `);

  console.log(`✅ Cleared has_diagram on ${rowCount} questions (confirmed no image exists on source).`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
