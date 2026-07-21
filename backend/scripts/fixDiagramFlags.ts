// scripts/fixDiagramFlags.ts
// Find questions flagged has_diagram=TRUE with no image_url (either never processed, or a
// previous run of this script gave up on them) and try to source the diagram from myschool.ng.
//
// NOTE (2026-07-21): myschool.ng migrated to a Nuxt SPA at some point after this script was
// first written. The old version scraped rendered HTML for a `#page-content-section
// .question-desc img` — that container no longer exists in the page's HTML at all (content is
// now hydrated client-side from a serialized Nuxt payload). Rewritten to hit their public JSON
// API directly instead: https://myschool.ng/api/web/v1/classroom/{subjectSlug}/{msId}
//
// The diagram can live in one of two places in that response:
//   - data.question.image — a dedicated image field, when present
//   - an inline <img src="..."> inside data.question.question (the HTML question body) — this
//     is where the actual diagram sits for e.g. biology labelled-diagram questions; the site
//     doesn't always populate the dedicated `image` field even when the question clearly has one
//
// If found: set image_url + has_diagram=TRUE.
// If not found: leave as-is (many "diagram"-flagged questions are false positives from the
// detection regex below — e.g. a question referencing a data table that's already fully
// captured as text in our own question_text — those don't need an image at all and are already
// fully answerable; has_diagram isn't read anywhere in the send path, only image_url is, so a
// false positive here doesn't actually break anything for a student).
//
// Run: ts-node scripts/fixDiagramFlags.ts

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import axios, { AxiosError } from 'axios';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const API_BASE = 'https://myschool.ng/api/web/v1/classroom';
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

async function fetchJson(url: string): Promise<any | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 404) return null;
      if (attempt === MAX_RETRIES) return null;
      await sleep(attempt * 2000);
    }
  }
  return null;
}

// Pull the diagram URL out of an API response: prefer the dedicated `image` field, fall back
// to the first <img src="..."> found inline in the question's HTML body. Only ever returns a
// real http(s) URL — a data: URI can't be naively concatenated onto a domain (that produces
// garbage, and Telegraf's replyWithPhoto needs a URL/Buffer/file, not a bare data: string) — a
// question with only an inline base64 image is left unresolved rather than mis-handled.
function extractImageUrl(payload: any): string | null {
  const q = payload?.data?.question;
  if (!q) return null;

  if (typeof q.image === 'string' && q.image.trim()) {
    const img = q.image.trim();
    if (img.startsWith('data:')) return null;
    return img.startsWith('http') ? img : `https://myschool.ng/storage/${img}`;
  }

  const html = typeof q.question === 'string' ? q.question : '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) {
    const src = match[1];
    if (src.startsWith('data:')) return null;
    return src.startsWith('http') ? src : `https://myschool.ng${src.startsWith('/') ? '' : '/'}${src}`;
  }

  return null;
}

// Facebook's CDN signs image URLs with a short-lived token — by the time these get scraped
// out of old questions they're already expired (verified: every fbcdn.net URL hit during
// development of this script came back 403, not just "might expire later"). Not worth even
// attempting; skip straight to unresolved instead of burning a request confirming the 403.
function isKnownDeadHost(url: string): boolean {
  return /\bfbcdn\.net\b/i.test(url);
}

// Telegram's own fetch is the thing that actually matters — verify the candidate URL returns
// real image bytes right now before writing it to the DB, rather than trusting extraction
// alone. Some hosts (myschool.ng's own storage, seen live) send a wrong Content-Type like
// text/plain for a real JPEG, so this sniffs the actual response body's magic bytes instead of
// trusting headers.
async function verifyIsImage(url: string): Promise<boolean> {
  try {
    const res = await http.get<ArrayBuffer>(url, { responseType: 'arraybuffer', maxContentLength: 15 * 1024 * 1024 });
    const buf = Buffer.from(res.data);
    if (buf.length < 8) return false;
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isGif = buf.slice(0, 3).toString('ascii') === 'GIF';
    const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    return isJpeg || isPng || isGif || isWebp;
  } catch {
    return false;
  }
}

async function run(): Promise<void> {
  const { rows } = await pool.query(`
    SELECT id, source_id, subject FROM questions
    WHERE (image_url IS NULL OR image_url = '')
      AND source_id IS NOT NULL
      AND (
        has_diagram = TRUE
        OR question_text ~* 'diagram (above|below|shows?)'
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

  let withImage = 0, stillMissing = 0, done = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (row: any) => {
      const msId = row.source_id.replace('ms_', '');
      const slug = CODE_TO_SLUG[row.subject] || row.subject;
      const url = `${API_BASE}/${slug}/${msId}`;

      const payload = await fetchJson(url);
      const imageUrl = extractImageUrl(payload);

      if (imageUrl && !isKnownDeadHost(imageUrl) && (await verifyIsImage(imageUrl))) {
        await pool.query(
          'UPDATE questions SET image_url = $1, has_diagram = TRUE WHERE id = $2',
          [imageUrl, row.id]
        );
        withImage++;
        console.log(`  ✅ id=${row.id} ${row.subject}: image found and verified`);
      } else {
        stillMissing++;
      }

      done++;
      if (done % 20 === 0) console.log(`  ${done}/${rows.length} processed`);
    }));

    if (i + CONCURRENCY < rows.length) await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done: ${withImage} images attached, ${stillMissing} still unresolved (no image found on myschool.ng)`);
  await pool.end();
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
