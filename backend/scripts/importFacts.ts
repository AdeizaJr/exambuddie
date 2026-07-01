import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import * as fs from 'fs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SUBJECT_CODE_MAP: Record<string, string> = {
  'Physics':             'physics',
  'Chemistry':           'chemistry',
  'Biology':             'biology',
  'Mathematics':         'math',
  'English Language':    'english',
  'Geography':           'geography',
  'Economics':           'economics',
  'Government':          'government',
  'History':             'history',
  'Literature':          'literature',
  'Computer Science':    'computer',
  'Agricultural Science':'agric',
  'Civic Education':     'civic-education',
  'Physical Education':  'pe',
  'Astronomy':           'astronomy',
  'Creative Arts':       'creative-arts',
  'Earth Science':       'earth-science',
  'Financial Literacy':  'financial-literacy',
  'Health Education':    'health-ed',
};

async function main() {
  const raw = fs.readFileSync('/home/adeizajr/Downloads/exambuddie_fact_bank.json', 'utf8');
  const { facts } = JSON.parse(raw);

  let inserted = 0;
  let skipped = 0;
  let unknown = 0;

  for (const fact of facts) {
    const subjectCode = SUBJECT_CODE_MAP[fact.subject];
    if (!subjectCode) {
      console.warn(`  ⚠️  Unknown subject: "${fact.subject}" (id: ${fact.id})`);
      unknown++;
      continue;
    }
    try {
      await pool.query(
        `INSERT INTO did_you_know (external_id, subject, subject_code, topic, fact_text, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [fact.id, fact.subject, subjectCode, fact.topic || null, fact.fact, fact.difficulty || 'medium']
      );
      inserted++;
    } catch (err: any) {
      if (err.code === '23505') skipped++; // unique violation = already exists
      else throw err;
    }
  }

  console.log(`\n✅ Done. Inserted: ${inserted}  Already existed: ${skipped}  Unknown subject: ${unknown}\n`);
  await pool.end();
}

main().catch(console.error);
