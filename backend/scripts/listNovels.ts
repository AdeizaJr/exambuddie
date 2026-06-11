// scripts/listNovels.ts
// Two modes:
//   analyse (default) — print novel counts, no DB writes
//   update            — write novel title into questions.topic (run with: npx ts-node scripts/listNovels.ts update)
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MODE = process.argv[2] === 'update' ? 'update' : 'analyse';

const Q = `['"‘’“”]`; // any quote char (straight or curly)

const PATTERNS: RegExp[] = [
  // ── Attribution-style (explicit) ──────────────────────────────────────────
  /questions?\s+(?:is|are|i)\s+based\s+on\s+.+?'s\s+(.+?)(?:\.|$)/i,
  /questions?\s+(?:is|are|i)\s+based\s+on\s+(.+?)\s+by\s+.+?(?:\.|$)/i,
  /questions?\s+(?:is|are|i)\s+based\s+on\s+([A-Z][A-Z\s]{2,30}?)(?:\.|,|$)/,
  /(?:this\s+)?question\s+is\s+from\s+the\s+(?:novel|book)\s+['""]?(.+?)['""]?(?:\.|$)/i,
  /in\s+the\s+(?:novel|book|play|fiction|poem)\s+['""]?([A-Z].+?)['""]?\s+(?:by|because|,|\.|$)/i,
  /(?:the\s+)?(?:novel|book)\s+["'](.+?)["'](?:\s+is|\s+was|\s+by|,|\.|$)/i,

  // ── Author's 'Title' (possessive + single-quoted title) ───────────────────
  /[A-Z][a-z'.]+(?:\s+[A-Z]\.){0,2}\s*'s\s+(?:poem\s*,?\s*)?'([^']{3,50})'/,

  // ── In 'Title' or In "Title" ─────────────────────────────────────────────
  /\bIn\s+'([A-Z][^']{3,60})'(?:\s|,|\.|$)/,
  /\bIn\s+"([A-Z][^"]{3,60})"(?:\s|,|\.|$)/,
  /\bIn\s+''([A-Z][^']{3,50})''/,

  // ── In Title, [Capital...] (unquoted title before comma + capital) ────────
  /\bIn\s+([A-Z][A-Za-z\s']{3,45}),\s+[A-Z]/,

  // ── Title, by Author ─────────────────────────────────────────────────────
  new RegExp(`^([A-Z][A-Za-z\\s']{4,40}?),\\s*by\\s+[A-Z][a-z]`, 'm'),
];

const TRAILING_JUNK = /\b(is|are|was|were|a|an|of|in|on|by|the|from|with|to|and|that|which|as|show|shows|depicts|suggest|suggests|symbolises|symbolizes|portray|portrays|constitute|constitutes|basically|generally)\s*$/i;

// Titles that are false positives — too generic or are geographic/common nouns
const BLOCKLIST = new Set(['africa', 'south africa', 'north africa', 'west africa', 'east africa']);

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
  "piggy's":                               'Lord of the Flies',
  "piggy''s":                              'Lord of the Flies',
  'wuthering height':                      'Wuthering Heights',
  'the journey of the magi':               'Journey of the Magi',
  'journey of the magi':                   'Journey of the Magi',
  "the marriage of anansewa":              'The Marriage of Anansewa',
  'marriage of anansewa':                  'The Marriage of Anansewa',
  "buchi emecheta's the joys of motherhood": 'The Joys of Motherhood',
  "morris' the proud king":                'The Proud King',
  'the narrow parth':                      'The Narrow Path',
  'olukun':                                'Olokun',
  'the panic of growing old':              'The Panic of Growing Older',
  "arrow of god ''":                       'Arrow of God',
  "so long a letter '":                    'So Long a Letter',
  "so long a letter ''":                   'So Long a Letter',
};

function canonicalize(title: string): string {
  let cleaned = title.replace(/^['"""''(]+/, '').replace(/['"""'']+$/, '').trim();
  // Strip leading "Author's " or "Author' " when followed by a capital word (The/A/An etc.)
  // e.g. "Buchi Emecheta's The Joys of Motherhood" → "The Joys of Motherhood"
  // e.g. "Morris' The Proud King" → "The Proud King"
  // But NOT "Kongi's Harvest" — Kongi is part of the title
  cleaned = cleaned.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*'s?\s+(?=(?:The|A|An)\s)/i, '');
  return CANONICAL[cleaned.toLowerCase()] ?? CANONICAL[title.toLowerCase()] ?? cleaned;
}

function isPlausibleTitle(title: string): boolean {
  if (title.split(' ').length > 7) return false;
  if (!/^[A-Z'"]/.test(title)) return false;
  if (/[?!]$/.test(title)) return false;              // ends with ? or ! — it's a question/exclamation
  if (/[:(]/.test(title)) return false;               // bibliographic chars
  if (/,\s+[a-z]/.test(title)) return false;          // comma + lowercase = sentence ran past title
  if (/['"]$/.test(title.trim())) return false;       // dangling quote at end
  if (TRAILING_JUNK.test(title)) return false;
  if (BLOCKLIST.has(title.toLowerCase())) return false;
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
