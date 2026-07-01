// scripts/seed_facts.ts — import facts from JSON into did_you_know table
import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SUBJECT_CODE_MAP: Record<string, string> = {
  'Agricultural Science': 'agric',
  'Astronomy':            'astronomy',
  'Biology':              'biology',
  'Chemistry':            'chemistry',
  'Civic Education':      'civic-education',
  'Computer Science':     'computer',
  'Creative Arts':        'creative-arts',
  'Earth Science':        'earth-science',
  'Economics':            'economics',
  'English Language':     'english',
  'Financial Literacy':   'financial-literacy',
  'Geography':            'geography',
  'Government':           'government',
  'Health Education':     'health-ed',
  'History':              'history',
  'Literature':           'literature',
  'Mathematics':          'math',
  'Physical Education':   'pe',
  'Physics':              'physics',
};

async function seed() {
  const filePath = path.resolve('/home/adeizajr/Downloads/exambuddie_fact_bank (4).json');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const facts: any[] = raw.facts;

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let unknown = 0;

  try {
    for (const f of facts) {
      const subject_code = SUBJECT_CODE_MAP[f.subject];
      if (!subject_code) {
        console.warn(`Unknown subject: "${f.subject}" (id: ${f.id})`);
        unknown++;
        continue;
      }

      // Check if already exists first (partial unique index can't be used in ON CONFLICT)
      const exists = await client.query(
        `SELECT 1 FROM did_you_know WHERE external_id = $1`,
        [f.id]
      );
      if (exists.rowCount && exists.rowCount > 0) { skipped++; continue; }

      await client.query(
        `INSERT INTO did_you_know (external_id, subject, subject_code, topic, fact_text, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [f.id, f.subject, subject_code, f.topic, f.fact, f.difficulty]
      );
      inserted++;
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`✅ Done — ${inserted} inserted, ${skipped} already existed, ${unknown} unknown subjects`);
}

seed().catch(err => { console.error(err); process.exit(1); });
