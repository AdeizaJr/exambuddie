// scripts/fixDiagramFlags.ts
// Find questions with diagram references in text but has_diagram=FALSE and no image_url.
// Try to fetch the image from myschool.ng. If found: set image_url + has_diagram=TRUE.
// If not found: set has_diagram=TRUE to hide until image is sourced.
// Run: ts-node scripts/fixDiagramFlags.ts

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE_URL = 'https://myschool.ng';
const DELAY_MS = 800;
const MAX_RETRIES = 3;
const CONCURRENCY = 3;

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

  // Try classroom storage path (newer questions)
  const classroomImg = descDiv.find('img[src*="/storage/classroom"]').first();
  if (classroomImg.length) {
    const src = classroomImg.attr('src') || '';
    if (src && !src.includes('logo')) return src.startsWith('http') ? src : `${BASE_URL}${src}`;
  }

  // Try any img inside question-desc that isn't a logo/ad
  const anyImg = descDiv.find('img').first();
  if (anyImg.length) {
    const src = anyImg.attr('src') || '';
    if (src && !src.includes('logo') && !src.includes('/serve/')) {
      return src.startsWith('http') ? src : `${BASE_URL}${src}`;
    }
  }

  return null;
}

async function run(): Promise<void> {
  const { rows } = await pool.query(`
    SELECT id, source_id, subject FROM questions
    WHERE has_diagram = FALSE
      AND image_url IS NULL
      AND source_id IS NOT NULL
      AND (
        question_text ~* 'diagram (above|below|shows?)'
        OR question_text ~* 'figure (above|below|shows?|below shows)'
        OR question_text ~* 'labelled[_ ]+(above|below|I|II|III|IV|V|the)'
        OR question_text ~* 'are labelled'
        OR question_text ~* '(use|study|refer to) the (diagram|figure|map|graph|chart|table)'
        OR question_text ~* '(the|a) (diagram|figure|map|graph|chart) (above|below|shows?)'
        OR question_text ~* 'as shown (in|above|below)'
        OR question_text ~* 'shown in the (diagram|figure)'
        OR question_text ~* 'use the (map|figure|diagram|graph|chart) (above|below)'
        OR question_text ~* 'from the (diagram|figure|graph|map) (above|below)'
      )
    ORDER BY id
  `);

  if (rows.length === 0) {
    console.log('No untagged diagram questions found.');
    await pool.end();
    return;
  }

  console.log(`\nProcessing ${rows.length} questions with diagram references...\n`);

  let withImage = 0, hiddenOnly = 0, done = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (row: any) => {
      const msId = row.source_id.replace('ms_', '');
      const slug = CODE_TO_SLUG[row.subject] || row.subject;
      const url = `${BASE_URL}/classroom/${slug}/${msId}`;

      const html = await fetchHtml(url);
      const imageUrl = extractImageUrl(html);

      if (imageUrl) {
        await pool.query(
          'UPDATE questions SET image_url = $1, has_diagram = TRUE WHERE id = $2',
          [imageUrl, row.id]
        );
        withImage++;
        console.log(`  ✅ id=${row.id} ${row.subject}: image found`);
      } else {
        await pool.query(
          'UPDATE questions SET has_diagram = TRUE WHERE id = $1',
          [row.id]
        );
        hiddenOnly++;
      }

      done++;
      if (done % 10 === 0) console.log(`  ${done}/${rows.length} processed`);
    }));

    if (i + CONCURRENCY < rows.length) await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done: ${withImage} images attached, ${hiddenOnly} hidden (no image on myschool.ng)`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
