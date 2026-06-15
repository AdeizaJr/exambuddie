// scripts/import.ts — Import scraped JSON data into PostgreSQL
// Run AFTER scrape.ts: ts-node scripts/import.ts
// Idempotent: uses source_id to skip already-imported questions

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DATA_DIR = path.join(__dirname, '../data');

// Maps myschool.ng subject slug → DB subject code
const SUBJECT_SLUG_TO_CODE: Record<string, string> = {
  'mathematics':                          'math',
  'english-language':                     'english',
  'chemistry':                            'chemistry',
  'physics':                              'physics',
  'biology':                              'biology',
  'geography':                            'geography',
  'literature-in-english':                'literature',
  'economics':                            'economics',
  'commerce':                             'commerce',
  'accounts-principles-of-accounts':      'accounts',
  'government':                           'government',
  'christian-religious-knowledge-crk':    'crk',
  'agricultural-science':                 'agric',
  'islamic-religious-knowledge-irk':      'irk',
  'history':                              'history',
  'fine-arts':                            'fine-arts',
  'music':                                'music',
  'french':                               'french',
  'animal-husbandry':                     'animal-husbandry',
  'insurance':                            'insurance',
  'civic-education':                      'civic-education',
  'further-mathematics':                  'further-math',
  'yoruba':                               'yoruba',
  'igbo':                                 'igbo',
  'arabic':                               'arabic',
  'home-economics':                       'home-economics',
  'hausa':                                'hausa',
  'book-keeping':                         'book-keeping',
  'data-processing':                      'data-processing',
  'catering-craft-practice':              'catering',
  'computer-studies':                     'computer',
  'marketing':                            'marketing',
  'physical-education':                   'pe',
  'office-practice':                      'office-practice',
  'technical-drawing':                    'tech-drawing',
  'food-and-nutrition':                   'food-nutrition',
  'home-management':                      'home-management',
};

interface ScrapedQuestion {
  id: string;
  subject: string;          // slug e.g. "mathematics"
  examType: string;         // e.g. "WAEC"
  year: number;
  questionText: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string;
  imageUrl?: string | null;
}

function collectJsonFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      files.push(...collectJsonFiles(full));
    } else if (entry.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

async function importFile(client: any, filePath: string): Promise<{ inserted: number; skipped: number }> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  let questions: ScrapedQuestion[];
  try {
    questions = JSON.parse(raw);
  } catch {
    console.warn(`  ✗ invalid JSON: ${filePath}`);
    return { inserted: 0, skipped: 0 };
  }

  if (!Array.isArray(questions) || questions.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0, skipped = 0;

  for (const q of questions) {
    const subjectCode = SUBJECT_SLUG_TO_CODE[q.subject] || q.subject;
    const examType = q.examType.toUpperCase();
    const sourceId = `ms_${q.id}`;

    // Skip if question text or correct answer is missing
    if (!q.questionText || !q.correctAnswer || !q.options['A']) {
      skipped++;
      continue;
    }

    const optA = q.options['A'] || '';
    const optB = q.options['B'] || '';
    const optC = q.options['C'] || '';
    const optD = q.options['D'] || '';
    const optE = q.options['E'] || null;
    const raw = q.explanation?.trim() ?? '';
    // Treat bare heading text as no explanation — Claude will generate it
    const explanation = raw && raw !== 'Explanation' && raw.length > 10 ? raw : null;

    const imageUrl = q.imageUrl || null;

    try {
      const result = await client.query(
        `INSERT INTO questions
           (exam_type, subject, year, question_text,
            option_a, option_b, option_c, option_d, option_e,
            correct_option, explanation, source_id, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (source_id) DO UPDATE SET image_url = EXCLUDED.image_url
         WHERE questions.image_url IS NULL`,
        [examType, subjectCode, q.year, q.questionText,
         optA, optB, optC, optD, optE,
         q.correctAnswer, explanation, sourceId, imageUrl]
      );
      if (result.rowCount && result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err: any) {
      console.warn(`  ✗ insert failed for ${sourceId}: ${err.message}`);
      skipped++;
    }
  }

  return { inserted, skipped };
}

async function ensureSubjectsExist(client: any): Promise<void> {
  const subjectEntries = Object.entries(SUBJECT_SLUG_TO_CODE).map(([slug, code]) => ({
    code,
    name: slug
      .replace(/-/g, ' ')
      .replace(/\b(crk|irk|pe)\b/g, s => s.toUpperCase())
      .replace(/\b\w/g, c => c.toUpperCase()),
  }));

  for (const s of subjectEntries) {
    await client.query(
      `INSERT INTO subjects (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
      [s.code, s.name]
    );
  }
}

async function run(): Promise<void> {
  const jsonFiles = collectJsonFiles(DATA_DIR);
  if (jsonFiles.length === 0) {
    console.log('No scraped data found in data/. Run ts-node scripts/scrape.ts first.');
    return;
  }

  console.log(`\nImporting ${jsonFiles.length} data files into PostgreSQL...\n`);
  const client = await pool.connect();

  try {
    await ensureSubjectsExist(client);

    let totalInserted = 0, totalSkipped = 0;

    for (let i = 0; i < jsonFiles.length; i++) {
      const file = jsonFiles[i];
      const rel = path.relative(DATA_DIR, file);
      process.stdout.write(`[${i + 1}/${jsonFiles.length}] ${rel} ... `);

      const { inserted, skipped } = await importFile(client, file);
      totalInserted += inserted;
      totalSkipped += skipped;
      console.log(`+${inserted} inserted, ${skipped} skipped`);
    }

    console.log(`\n✅ Import complete: ${totalInserted} questions added, ${totalSkipped} skipped.\n`);
    console.log('Next step: ts-node scripts/generateExplanations.ts');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
