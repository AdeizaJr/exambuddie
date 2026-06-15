// Scraper for myschool.ng — WAEC, NECO, JAMB past questions (2010–2025)
// Run: ts-node scripts/scrape.ts
// Output: data/<subject>/<examType>/<year>.json
// Resume-safe: skips already-scraped files

import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ─── Config ────────────────────────────────────────────────────────────────

const BASE_URL = 'https://myschool.ng';
const DATA_DIR = path.join(__dirname, '../data');
const DELAY_MS = 1200;          // between individual question fetches
const LIST_DELAY_MS = 800;      // between list-page fetches
const MAX_RETRIES = 3;
const CONCURRENCY = 3;          // parallel question fetches
const YEARS = Array.from({ length: 16 }, (_, i) => 2010 + i); // 2010–2025
const EXAM_TYPES = ['waec', 'neco', 'jamb'] as const;

const SUBJECTS = [
  'mathematics',
  'english-language',
  'chemistry',
  'physics',
  'biology',
  'geography',
  'literature-in-english',
  'economics',
  'commerce',
  'accounts-principles-of-accounts',
  'government',
  'christian-religious-knowledge-crk',
  'agricultural-science',
  'islamic-religious-knowledge-irk',
  'history',
  'fine-arts',
  'music',
  'french',
  'animal-husbandry',
  'insurance',
  'civic-education',
  'further-mathematics',
  'yoruba',
  'igbo',
  'arabic',
  'home-economics',
  'hausa',
  'book-keeping',
  'data-processing',
  'catering-craft-practice',
  'computer-studies',
  'marketing',
  'physical-education',
  'office-practice',
  'technical-drawing',
  'food-and-nutrition',
  'home-management',
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  subject: string;
  examType: string;
  year: number;
  questionText: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string;
  imageUrl: string | null;
}

// ─── HTTP helpers ───────────────────────────────────────────────────────────

const http = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  timeout: 20000,
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url: string, retries = MAX_RETRIES): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await http.get<string>(url);
      return res.data;
    } catch (err) {
      const axErr = err as AxiosError;
      const status = axErr.response?.status;
      if (status === 404) return '';
      if (attempt === retries) {
        console.warn(`  ✗ Failed after ${retries} attempts: ${url}`);
        return '';
      }
      const backoff = attempt * 2000;
      console.warn(`  ↻ Retry ${attempt}/${retries} (status=${status ?? 'timeout'}) — waiting ${backoff}ms`);
      await sleep(backoff);
    }
  }
  return '';
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseListPage(html: string, subject: string): string[] {
  const $ = cheerio.load(html);
  const ids: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/\/classroom\/[^/]+\/(\d+)/);
    if (match) ids.push(match[1]);
  });
  return [...new Set(ids)];
}

function parseMaxPage(html: string): number {
  const $ = cheerio.load(html);
  let max = 1;
  $('ul.pagination a.page-link').each((_, el) => {
    const n = parseInt($(el).text().trim(), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max;
}

function parseQuestionPage(html: string, id: string, subject: string, examType: string, year: number): Question | null {
  if (!html) return null;
  const $ = cheerio.load(html);
  const section = $('#page-content-section');
  if (!section.length) return null;

  // Question text: strip the badge links, grab remaining text
  const descDiv = section.find('.question-desc').first();
  descDiv.find('a').remove(); // remove subject/year badge links
  let questionText = descDiv.text().trim();
  if (!questionText) return null;

  // For "From the novel;" questions, the passage/context lives in a sibling
  // element that .question-desc doesn't contain. Capture it and prepend.
  if (questionText.startsWith('From the novel;')) {
    const passageEl = section.find('.question-passage, .passage, blockquote').first();
    const passageText = passageEl.text().trim();
    if (passageText) {
      questionText = `From the novel;\n\n${passageText}\n\n${questionText.replace(/^From the novel;\s*/i, '')}`;
    }
    // Collapse excessive blank lines from source whitespace
    questionText = questionText.replace(/\n{3,}/g, '\n\n').trim();
  }

  // Capture first diagram image inside .question-desc
  const imgEl = descDiv.find('img').first();
  let imageUrl: string | null = null;
  if (imgEl.length) {
    const src = imgEl.attr('src') || '';
    if (src && !src.includes('logo')) {
      imageUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
    }
  }

  // Options from ul.list-unstyled > li
  const options: Record<string, string> = {};
  section.find('ul.list-unstyled li').each((_, el) => {
    const letter = $(el).find('strong').text().trim().replace('.', '');
    const optText = $(el).clone().children('strong').remove().end().text().trim();
    if (letter && optText) options[letter] = optText;
  });

  // Correct answer: "Correct Answer: Option E" → "E"
  const answerHeader = section.find('h5.text-success').first().text().trim();
  const answerMatch = answerHeader.match(/Option\s+([A-E])/i);
  const correctAnswer = answerMatch ? answerMatch[1].toUpperCase() : '';

  // Explanation lives in div.mb-4 alongside the answer header.
  // Clone it, strip the h5 headings and any ad containers, then grab remaining text.
  const answerContainer = section.find('h5.text-success').closest('div.mb-4');
  const expClone = answerContainer.clone();
  expClone.find('h5').remove();
  expClone.find('.t_container').remove();
  const explanation = expClone.text().replace(/\s{2,}/g, ' ').trim();

  return {
    id,
    subject,
    examType: examType.toUpperCase(),
    year,
    questionText,
    options,
    correctAnswer,
    explanation,
    imageUrl,
  };
}

// ─── Concurrency helpers ─────────────────────────────────────────────────────

async function runInBatches<T>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map(fn));
    if (i + concurrency < items.length) await sleep(delayMs);
  }
}

// ─── File helpers ────────────────────────────────────────────────────────────

function outputPath(subject: string, examType: string, year: number): string {
  return path.join(DATA_DIR, subject, examType, `${year}.json`);
}

function alreadyScraped(subject: string, examType: string, year: number): boolean {
  return fs.existsSync(outputPath(subject, examType, year));
}

function saveQuestions(subject: string, examType: string, year: number, questions: Question[]): void {
  const dir = path.join(DATA_DIR, subject, examType);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath(subject, examType, year), JSON.stringify(questions, null, 2));
}

// ─── Core scraping logic ──────────────────────────────────────────────────────

async function collectQuestionIds(subject: string, examType: string, year: number): Promise<string[]> {
  const page1Url = `${BASE_URL}/classroom/${subject}?exam_type=${examType}&exam_year=${year}&page=1`;
  const page1Html = await fetchHtml(page1Url);
  if (!page1Html) return [];

  const maxPage = parseMaxPage(page1Html);
  const ids = parseListPage(page1Html, subject);

  for (let page = 2; page <= maxPage; page++) {
    await sleep(LIST_DELAY_MS);
    const html = await fetchHtml(`${BASE_URL}/classroom/${subject}?exam_type=${examType}&exam_year=${year}&page=${page}`);
    const pageIds = parseListPage(html, subject);
    ids.push(...pageIds);
  }

  return [...new Set(ids)];
}

async function scrapeCombo(subject: string, examType: string, year: number): Promise<void> {
  if (alreadyScraped(subject, examType, year)) {
    process.stdout.write(`  skip ${subject}/${examType}/${year} (exists)\n`);
    return;
  }

  const ids = await collectQuestionIds(subject, examType, year);
  if (ids.length === 0) {
    process.stdout.write(`  skip ${subject}/${examType}/${year} (no questions)\n`);
    return;
  }

  console.log(`  → ${subject}/${examType}/${year}: ${ids.length} questions`);

  const questions: Question[] = [];

  await runInBatches(ids, CONCURRENCY, DELAY_MS, async (id) => {
    const url = `${BASE_URL}/classroom/${subject}/${id}`;
    const html = await fetchHtml(url);
    const q = parseQuestionPage(html, id, subject, examType, year);
    if (q) questions.push(q);
  });

  if (questions.length > 0) {
    saveQuestions(subject, examType, year, questions);
    console.log(`  ✓ saved ${questions.length} questions → data/${subject}/${examType}/${year}.json`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const total = SUBJECTS.length * EXAM_TYPES.length * YEARS.length;
  let done = 0;
  const startTime = Date.now();

  console.log(`\nStarting scrape: ${SUBJECTS.length} subjects × ${EXAM_TYPES.length} exam types × ${YEARS.length} years = ${total} combos\n`);

  for (const subject of SUBJECTS) {
    for (const examType of EXAM_TYPES) {
      for (const year of YEARS) {
        done++;
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        console.log(`[${done}/${total}] ${elapsed}min — ${subject} / ${examType} / ${year}`);
        await scrapeCombo(subject, examType, year);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDone in ${elapsed} minutes.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
