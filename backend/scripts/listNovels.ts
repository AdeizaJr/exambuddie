// scripts/listNovels.ts
// Two modes:
//   analyse (default) — print novel counts, no DB writes
//   update            — write novel title into questions.topic (run with: npx ts-node scripts/listNovels.ts update)
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MODE = process.argv[2] === 'update' ? 'update' : 'analyse';

const PATTERNS = [
  /questions?\s+(?:is|are)\s+based\s+on\s+.+?'s\s+(.+?)(?:\.|$)/i,          // based on Author's Title
  /questions?\s+(?:is|are)\s+based\s+on\s+(.+?)\s+by\s+.+?(?:\.|$)/i,       // based on Title by Author
  /(?:this\s+)?question\s+is\s+from\s+the\s+(?:novel|book)\s+['"]?(.+?)['"]?(?:\.|$)/i, // from the novel 'Title'
  /in\s+the\s+(?:novel|book)\s+['"](.+?)['"](?:\s|,|\.|$)/i,                 // in the novel "Title"
  /(?:the\s+)?(?:novel|book)\s+['"](.+?)['"](?:\s+is|\s+was|\s+by|,|\.|$)/i, // novel "Title" is/was/by
];

const TRAILING_JUNK = /\b(is|are|was|were|a|an|of|in|on|by|the|from|with|to|and|that|which|as)\s*$/i;

const CANONICAL: Record<string, string> = {
  "romeo's and juliet":                    'Romeo and Juliet',
  'romeo and juliet':                      'Romeo and Juliet',
  'nighteen eighty-four':                  'Nineteen Eighty-Four',
  'nineteen-eighty four':                  'Nineteen Eighty-Four',
  'nineteen eighty four':                  'Nineteen Eighty-Four',
  'ninety eighty-four':                    'Nineteen Eighty-Four',
  '1984':                                  'Nineteen Eighty-Four',
  'the mayor of casterbirdge':             'The Mayor of Casterbridge',
  'the wives revolt':                      "The Wives' Revolt",
  "wives' revolt":                         "The Wives' Revolt",
  'wives revolt':                          "The Wives' Revolt",
  "the wives'' revolt":                    "The Wives' Revolt",
  "tess of the d'urbrvilles":              "Tess of the d'Urbervilles",
  'the joy of motherhood':                 'The Joys of Motherhood',
  "the beautyful ones are not yet born":   'The Beautyful Ones Are Not Yet Born',
  "'the beautyful ones are not yet born'": 'The Beautyful Ones Are Not Yet Born',
  "'the beautiful ones are not yet born'": 'The Beautiful Ones Are Not Yet Born',
  "'the beautiful ones are not yet born":  'The Beautiful Ones Are Not Yet Born',
  'facesless':                             'Faceless',
  "piggy's":                               'Lord of the Flies', // mislabelled in source data
  "arrow of god ''":                       'Arrow of God',
  "so long a letter '":                    'So Long a Letter',
  "so long a letter ''":                   'So Long a Letter',
};

function canonicalize(title: string): string {
  const cleaned = title.replace(/^['"""''(]+/, '').replace(/['"""'']+$/, '').trim();
  return CANONICAL[cleaned.toLowerCase()] ?? CANONICAL[title.toLowerCase()] ?? cleaned;
}

function isPlausibleTitle(title: string): boolean {
  if (title.split(' ').length > 7) return false;
  if (!/^[A-Z'"]/.test(title)) return false;
  if (/\?$/.test(title)) return false;
  if (/[:(]/.test(title)) return false;
  if (TRAILING_JUNK.test(title)) return false;
  return true;
}

function extractFromAttribution(text: string): string | null {
  const flat = text.replace(/\s+/g, ' ').trim();
  for (const pattern of PATTERNS) {
    const match = flat.match(pattern);
    if (match) {
      const title = match[1].trim().replace(/\.$/, '');
      if (isPlausibleTitle(title)) return canonicalize(title);
    }
  }
  return null;
}

function extractFromKnownList(text: string, knownTitles: string[]): string | null {
  const flat = text.replace(/\s+/g, ' ').toLowerCase();
  for (const title of knownTitles) {
    if (flat.includes(title.toLowerCase())) return title;
  }
  return null;
}

async function main() {
  const { rows } = await pool.query<{
    id: number;
    question_text: string;
    subject: string;
    exam_type: string;
  }>(
    `SELECT id, question_text, subject, exam_type
     FROM questions
     WHERE question_text ILIKE 'from the novel%'`,
  );

  // Pass 1: attribution pattern
  const matched   = new Map<number, string>(); // question id → novel title
  const unmatched: typeof rows = [];

  for (const row of rows) {
    const novel = extractFromAttribution(row.question_text);
    if (novel) matched.set(row.id, novel);
    else unmatched.push(row);
  }

  // Build known-titles list from pass-1 results (longest first)
  const knownTitles = [...new Set(matched.values())].sort((a, b) => b.length - a.length);

  // Pass 2: scan question text for known titles
  let stillUnmatched = 0;
  for (const row of unmatched) {
    const novel = extractFromKnownList(row.question_text, knownTitles);
    if (novel) matched.set(row.id, canonicalize(novel));
    else stillUnmatched++;
  }

  // ── Analyse mode ────────────────────────────────────────────────────────────
  if (MODE === 'analyse') {
    type Entry = { title: string; count: number };
    const counts = new Map<string, Entry>();
    for (const title of matched.values()) {
      const key = title.toLowerCase();
      if (!counts.has(key)) counts.set(key, { title, count: 0 });
      counts.get(key)!.count++;
    }
    const sorted = [...counts.values()].sort((a, b) => b.count - a.count);

    console.log(`\nNovels / works (${rows.length} questions total):\n`);
    console.log(`${'Title'.padEnd(55)} ${'Questions'.padStart(9)}`);
    console.log('─'.repeat(66));
    for (const { title, count } of sorted) {
      console.log(`${title.padEnd(55)} ${String(count).padStart(9)}`);
    }
    console.log('─'.repeat(66));
    console.log(`Unique titles: ${counts.size} | Attributed: ${matched.size} | Unattributable: ${stillUnmatched}\n`);
    console.log(`Run with "update" argument to write titles to questions.topic:\n  npx ts-node scripts/listNovels.ts update\n`);
    await pool.end();
    return;
  }

  // ── Update mode ─────────────────────────────────────────────────────────────
  console.log(`\nUpdating ${matched.size} questions with novel title in topic column...`);

  // Batch update using unnest
  const ids    = [...matched.keys()];
  const titles = ids.map((id) => matched.get(id)!);

  await pool.query(
    `UPDATE questions
     SET topic = updates.title
     FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS title) AS updates
     WHERE questions.id = updates.id`,
    [ids, titles],
  );

  console.log(`Done. ${matched.size} questions updated, ${stillUnmatched} left unattributable.\n`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
