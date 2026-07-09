// scripts/importDidYouKnow.ts
// Imports facts from the JSON fact bank into the did_you_know table.
//
// Usage:
//   npx ts-node scripts/importDidYouKnow.ts
//   npx ts-node scripts/importDidYouKnow.ts --file /path/to/other.json
//
// Safe to re-run — skips existing facts by external_id.

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Maps fact bank subject names → app subject codes
const SUBJECT_CODE_MAP: Record<string, string> = {
  'Physics':              'physics',
  'Biology':              'biology',
  'Chemistry':            'chemistry',
  'Mathematics':          'math',
  'English Language':     'english',
  'Geography':            'geography',
  'History':              'history',
  'Government':           'government',
  'Economics':            'economics',
  'Literature':           'literature',
  'Agricultural Science': 'agric',
  'Computer Science':     'computer',
  'Civic Education':      'civic-education',
  'Physical Education':   'pe',
  'Accounting':                       'accounts',
  'Further Mathematics':              'further-math',
  'Commerce':                         'commerce',
  'Christian Religious Knowledge':    'crk',
  'Islamic Religious Knowledge':      'irk',
  // Closest-match mappings for subjects with no direct app code
  'Astronomy':            'physics',
  'Earth Science':        'geography',
  'Health Education':     'biology',
  'Financial Literacy':   'economics',
  'Creative Arts':        'fine-arts',
};

interface FactEntry {
  id: string;
  subject: string;
  topic: string;
  fact: string;
  difficulty: string;
  source: string;
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((_, i) => args[i - 1] === '--file');
  const filePath = fileArg
    ? path.resolve(fileArg)
    : path.resolve(__dirname, '../data/fact_bank.json');

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const facts: FactEntry[] = raw.facts;

  console.log(`\n📥 Importing ${facts.length} facts from ${path.basename(filePath)}\n`);

  let inserted = 0;
  let skipped = 0;
  let unmapped = 0;

  for (const fact of facts) {
    const subjectCode = SUBJECT_CODE_MAP[fact.subject];
    if (!subjectCode) {
      console.warn(`  ⚠️  No mapping for subject "${fact.subject}" (id: ${fact.id}) — skipping`);
      unmapped++;
      continue;
    }

    const { rows: existing } = await pool.query(
      'SELECT 1 FROM did_you_know WHERE external_id = $1 LIMIT 1',
      [fact.id]
    );

    if (existing.length > 0) {
      skipped++;
      console.log(`  Skip (exists): ${fact.id}`);
      continue;
    }

    await pool.query(
      `INSERT INTO did_you_know (external_id, subject, subject_code, topic, fact_text, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fact.id, fact.subject, subjectCode, fact.topic || null, fact.fact, fact.difficulty || null]
    );
    inserted++;
    console.log(`  ✓ [${subjectCode}] ${fact.id} — ${fact.topic}`);
  }

  console.log(`\n✅ Done.`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped (already exist): ${skipped}`);
  if (unmapped > 0) console.log(`   Unmapped subjects: ${unmapped}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
