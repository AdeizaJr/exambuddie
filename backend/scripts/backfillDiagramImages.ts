// Backfills image_url for diagram questions that have a source_id but no image.
// Scrapes each myschool.ng question page and updates both local and prod DBs.
// Run: ts-node scripts/backfillDiagramImages.ts
// Resume-safe: skips questions already updated.

import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { Pool } from 'pg';

const BASE_URL = 'https://myschool.ng';
const DELAY_MS = 1000;

const SUBJECT_MAP: Record<string, string> = {
  math: 'mathematics',
  english: 'english-language',
  literature: 'literature-in-english',
  accounts: 'accounts-principles-of-accounts',
  crk: 'christian-religious-knowledge-crk',
  agric: 'agricultural-science',
  irk: 'islamic-religious-knowledge-irk',
  'further-math': 'further-mathematics',
  catering: 'catering-craft-practice',
  computer: 'computer-studies',
  pe: 'physical-education',
};
const MAX_RETRIES = 3;
const CONCURRENCY = 3;

const LOCAL_DB = 'postgresql://postgres:161996@localhost:5432/exambuddie';
const PROD_DB = process.env.DATABASE_URL!;

const http = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
  },
  timeout: 20000,
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await http.get<string>(url);
      return res.data;
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 404) return '';
      if (attempt === MAX_RETRIES) { console.warn(`  ✗ Failed: ${url}`); return ''; }
      await sleep(attempt * 2000);
    }
  }
  return '';
}

function extractImageUrl(html: string): string | null {
  if (!html) return null;
  const $ = cheerio.load(html);
  const section = $('#page-content-section');
  if (!section.length) return null;
  const descDiv = section.find('.question-desc').first();
  const imgEl = descDiv.find('img').first();
  if (!imgEl.length) return null;
  const src = imgEl.attr('src') || '';
  if (!src || src.includes('logo')) return null;
  return src.startsWith('http') ? src : `${BASE_URL}${src}`;
}

async function main() {
  if (!PROD_DB) { console.error('DATABASE_URL not set'); process.exit(1); }

  const prod = new Pool({ connectionString: PROD_DB });
  const local = new Pool({ connectionString: LOCAL_DB });

  const { rows } = await prod.query<{ id: number; source_id: string; subject: string }>(`
    SELECT id, source_id, subject FROM questions
    WHERE image_url IS NULL
    AND source_id IS NOT NULL
    AND (
      question_text ILIKE '%diagram%' OR question_text ILIKE '%figure%'
      OR question_text ILIKE '%shown below%' OR question_text ILIKE '%circuit%'
      OR question_text ILIKE '%marked against%' OR question_text ILIKE '%graph%'
      OR question_text ILIKE '%table below%'
    )
    ORDER BY id
  `);

  console.log(`Found ${rows.length} questions to backfill`);

  let updated = 0;
  let noImage = 0;
  let failed = 0;

  async function processOne(row: { id: number; source_id: string; subject: string }) {
    const msId = row.source_id.replace('ms_', '');
    const msSubject = SUBJECT_MAP[row.subject] ?? row.subject;
    const url = `${BASE_URL}/classroom/${msSubject}/${msId}`;
    const html = await fetchHtml(url);
    const imageUrl = extractImageUrl(html);

    if (!imageUrl) {
      noImage++;
      return;
    }

    try {
      await prod.query('UPDATE questions SET image_url = $1, has_diagram = true WHERE id = $2', [imageUrl, row.id]);
      await local.query('UPDATE questions SET image_url = $1, has_diagram = true WHERE id = $2', [imageUrl, row.id]).catch(() => {});
      updated++;
      console.log(`  ✓ ${row.id} (ms_${msId}) → ${imageUrl}`);
    } catch {
      failed++;
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processOne));
    console.log(`Progress: ${Math.min(i + CONCURRENCY, rows.length)}/${rows.length} | updated=${updated} noImage=${noImage} failed=${failed}`);
    if (i + CONCURRENCY < rows.length) await sleep(DELAY_MS);
  }

  console.log(`\nDone. Updated=${updated} NoImage=${noImage} Failed=${failed}`);
  await prod.end();
  await local.end();
}

main().catch(console.error);
