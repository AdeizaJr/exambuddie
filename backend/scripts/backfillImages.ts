// scripts/backfillImages.ts — Fetch image URLs for existing diagram questions
// Run: ts-node scripts/backfillImages.ts
// Idempotent: skips questions that already have image_url set

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE_URL = 'https://myschool.ng';
const DELAY_MS = 1000;
const MAX_RETRIES = 3;
const CONCURRENCY = 3;

// Maps DB subject code → myschool.ng URL slug
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

const http = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
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

  const descDiv = section.find('.question-desc').first();
  const imgEl = descDiv.find('img').first();
  if (!imgEl.length) return null;

  const src = imgEl.attr('src') || '';
  if (!src || src.includes('logo')) return null;
  return src.startsWith('http') ? src : `${BASE_URL}${src}`;
}

async function run(): Promise<void> {
  const { rows } = await pool.query(`
    SELECT id, source_id, subject FROM questions
    WHERE has_diagram = TRUE
      AND source_id IS NOT NULL
      AND image_url IS NULL
    ORDER BY id
  `);

  if (rows.length === 0) {
    console.log('No diagram questions missing image_url. All done.');
    await pool.end();
    return;
  }

  console.log(`\nBackfilling images for ${rows.length} diagram questions...\n`);

  let found = 0, notFound = 0, done = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (row: any) => {
      const questionId = row.id;
      const msId = row.source_id.replace('ms_', '');
      const slug = CODE_TO_SLUG[row.subject] || row.subject;
      const url = `${BASE_URL}/classroom/${slug}/${msId}`;

      const html = await fetchHtml(url);
      const imageUrl = extractImageUrl(html);

      if (imageUrl) {
        await pool.query('UPDATE questions SET image_url = $1 WHERE id = $2', [imageUrl, questionId]);
        found++;
      } else {
        notFound++;
      }

      done++;
      if (done % 50 === 0) console.log(`  ${done}/${rows.length} processed (${found} images found)`);
    }));

    if (i + CONCURRENCY < rows.length) await sleep(DELAY_MS);
  }

  // Questions with images are now answerable — clear has_diagram flag
  const { rowCount } = await pool.query(`
    UPDATE questions SET has_diagram = FALSE
    WHERE has_diagram = TRUE AND image_url IS NOT NULL
  `);

  console.log(`\n✅ Done: ${found} images found, ${notFound} still missing`);
  console.log(`   ${rowCount} questions now answerable (has_diagram → FALSE)`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
