// scripts/backfillTargetImages.ts
// Scrapes images for specific question IDs from myschool.ng

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE_URL = 'https://myschool.ng';
const DELAY_MS = 1500;
const MAX_RETRIES = 3;

const CODE_TO_SLUG: Record<string, string> = {
  math:               'mathematics',
  english:            'english-language',
  chemistry:          'chemistry',
  physics:            'physics',
  biology:            'biology',
  geography:          'geography',
  literature:         'literature-in-english',
  economics:          'economics',
  commerce:           'commerce',
  accounts:           'accounts-principles-of-accounts',
  government:         'government',
  crk:                'christian-religious-knowledge-crk',
  agric:              'agricultural-science',
  irk:                'islamic-religious-knowledge-irk',
  history:            'history',
  'fine-arts':        'fine-arts',
  music:              'music',
  french:             'french',
  'animal-husbandry': 'animal-husbandry',
  insurance:          'insurance',
  'civic-education':  'civic-education',
  'further-math':     'further-mathematics',
  yoruba:             'yoruba',
  igbo:               'igbo',
  arabic:             'arabic',
  'home-economics':   'home-economics',
  hausa:              'hausa',
  'book-keeping':     'book-keeping',
  'data-processing':  'data-processing',
  catering:           'catering-craft-practice',
  computer:           'computer-studies',
  marketing:          'marketing',
  pe:                 'physical-education',
  'office-practice':  'office-practice',
};

const TARGET_IDS = [
  10622, 10627, 10643, 10644, 10668, 10669, 10679, 10695,
  11099,
  14817, 14818, 15164, 21190, 21311, 21551, 21565, 21578,
  44403,
  69510,
  117858,
  125076, 125761,
];

const http = axios.create({
  headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
  timeout: 15000,
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
      if (attempt === MAX_RETRIES) return '';
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
  const imgEl = section.find('.question-desc').first().find('img').first();
  if (!imgEl.length) return null;
  const src = imgEl.attr('src') || '';
  if (!src || src.includes('logo')) return null;
  return src.startsWith('http') ? src : `${BASE_URL}${src}`;
}

async function main() {
  const { rows } = await pool.query(
    'SELECT id, source_id, subject FROM questions WHERE id = ANY($1) ORDER BY id',
    [TARGET_IDS]
  );

  console.log(`\nScraping images for ${rows.length} questions...\n`);
  let found = 0, notFound = 0;

  for (const row of rows) {
    const msId = row.source_id.replace('ms_', '');
    const slug = CODE_TO_SLUG[row.subject] || row.subject;
    const url = `${BASE_URL}/classroom/${slug}/${msId}`;

    process.stdout.write(`  [${row.id}] ${slug}/${msId} → `);
    const html = await fetchHtml(url);
    const imageUrl = extractImageUrl(html);

    if (imageUrl) {
      await pool.query('UPDATE questions SET image_url = $1 WHERE id = $2', [imageUrl, row.id]);
      console.log(`✓ ${imageUrl}`);
      found++;
    } else {
      console.log(`✗ not found`);
      notFound++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done. Found: ${found} | Not found: ${notFound}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
