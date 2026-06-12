// scripts/listNovels.ts
// Two modes:
//   analyse (default) — print novel counts, no DB writes
//   update            — write novel title into questions.topic (run with: npx ts-node scripts/listNovels.ts update)
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MODE = process.argv[2] === 'update' ? 'update' : 'analyse';

const PATTERNS: RegExp[] = [
  // ── "question(s) based on Author's Title" ────────────────────────────────
  /questions?\s+(?:is|are|i)\s+based\s+on\s+.+?'s\s+(.+?)(?:\.|$)/i,
  /questions?\s+(?:is|are|i)\s+based\s+on\s+(.+?)\s+by\s+.+?(?:\.|$)/i,
  /questions?\s+(?:is|are|i)\s+based\s+on\s+([A-Z][A-Z\s]{2,30}?)(?:\.|,|$)/,

  // ── "Based on / base on Author's Title" (no "question" prefix) ──────────
  /\bbase[d]?\s+on\s+[A-Za-z][A-Za-z\s.]+?'s\s+([A-Z][A-Za-z\s']{3,40}?)(?=,\s|\s+[a-z]|\.)/i,

  // ── "This question is from the novel Title" ───────────────────────────────
  /(?:this\s+)?question\s+is\s+from\s+the\s+(?:novel|book)\s+['""]?(.+?)['""]?(?:\.|$)/i,

  // ── "in the novel/book/play Title by/because/," ──────────────────────────
  /in\s+the\s+(?:novel|book|play|fiction|poem)[,\s]+['""]?([A-Z][A-Za-z\s']{2,40}?)['""]?\s+(?:by|because|,|\.|$)/i,

  // ── "the novel/book 'Title' is/was/by" ───────────────────────────────────
  /(?:the\s+)?(?:novel|book)\s+["'](.+?)["'](?:\s+is|\s+was|\s+by|,|\.|$)/i,

  // ── "the novel Title by Author" (unquoted) ───────────────────────────────
  /\bthe\s+novel\s+([A-Z][A-Za-z\s']{3,40}?)\s+by\s+[A-Z][a-z]/i,

  // ── Author's 'Title' (possessive + single-quoted title) ──────────────────
  /[A-Z][a-z'.]+(?:\s+[A-Z]\.){0,2}\s*'s\s+(?:poem\s*,?\s*)?'([^']{3,50})'/,

  // ── Author's Title [verb] (no quotes around title) ───────────────────────
  /[A-Z][a-z'.]+(?:\s+[A-Z][a-z'.]*)*'s?\s+([A-Z][A-Za-z\s']{3,40}?)\s+(?:is\s+(?:about|an?\s|the\s|best|set|one|a\s)|can\s+be|are\b|was\s+(?:his|her|first)|depicts?\b|portrays?\b|shows?\b|reveals?\b|explores?\b|ends?\b|encourages?\b|addresses\b|argues?\b|writes?\b)/i,

  // ── In 'Title' or In "Title" ─────────────────────────────────────────────
  /\bIn\s+'([A-Z][^']{3,60})'(?:\s|,|\.|$)/,
  /\bIn\s+"([A-Z][^"]{3,60})"(?:\s|,|\.|$)/,
  /\bIn\s+''([A-Z][^']{3,50})''/,

  // ── In Title, [anything] (unquoted — relax capital requirement) ──────────
  /\bIn\s+([A-Z][A-Za-z\s']{3,45}),\s+[A-Za-z]/,

  // ── 'Title' followed by a verb (inline single-quoted) ───────────────────
  /'([A-Z][A-Za-z\s'\-]{3,50}?)'\s+(?:ends?\b|is\b|shows?\b|reveals?\b|was\b|can\b|depicts?\b|portrays?\b|primarily\b|suggests?\b|writes?\b|symboli[sz]es?\b)/,

  // ── "Title, by Author" anywhere in text (no line-start anchor) ───────────
  /\b([A-Z][A-Za-z\s']{4,35}?),\s*by\s+[A-Z][a-z]/,

  // ── "describe Title as" ──────────────────────────────────────────────────
  /describe\s+([A-Z][A-Za-z\s']{4,40}?)\s+as\b/i,

  // ── Title, by Author (original, anchored) ────────────────────────────────
  new RegExp(`^([A-Z][A-Za-z\\s']{4,40}?),\\s*by\\s+[A-Z][a-z]`, 'm'),
];

const TRAILING_JUNK = /\b(is|are|was|were|a|an|of|in|on|by|the|from|with|to|and|that|which|as|show|shows|depicts|suggest|suggests|symbolises|symbolizes|portray|portrays|constitute|constitutes|basically|generally)\s*$/i;

const BLOCKLIST = new Set([
  'africa', 'south africa', 'north africa', 'west africa', 'east africa',
  // Generic English words incorrectly extracted as titles
  'most', 'seat', 'more', 'less', 'many', 'some', 'other',
  // Known bad multi-word extractions from previous runs
  'seat discourages', 'more messenger', 'they washerwoman',
  'an african thunderstorm implies', 'the prodigals express', 'the pauper\' describe',
  "harvest of corruption \"trust me", 'the callof the river nun', 'panio and drums',
  'khan',
]);

const CANONICAL: Record<string, string> = {
  "romeo's and juliet":                    'Romeo and Juliet',
  'romeo and juliet':                      'Romeo and Juliet',
  'nighteen eighty-four':                  'Nineteen Eighty-Four',
  'nineteen-eighty four':                  'Nineteen Eighty-Four',
  'nineteen eighty four':                  'Nineteen Eighty-Four',
  'ninety eighty-four':                    'Nineteen Eighty-Four',
  'ninety eighty four':                    'Nineteen Eighty-Four',
  '1984':                                  'Nineteen Eighty-Four',
  'nineteen eighty-four':                  'Nineteen Eighty-Four',
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
  // JAMB 2020 titles
  'things fall apart':                     'Things Fall Apart',
  'thin gs fall apart':                    'Things Fall Apart',
  'julius ceasar':                         'Julius Caesar',
  'the trial of brother jero':             'The Trial of Brother Jero',
  'trial of brother jero':                 'The Trial of Brother Jero',
  'kossoh town boy':                       'Kossoh Town Boy',
  'mine boy':                              'Mine Boy',
  'the concubine':                         'The Concubine',
  'the middle passage':                    'The Middle Passage',
  'zambia shall be free':                  'Zambia Shall Be Free',
  'the adventure of tom sawyer':           'The Adventures of Tom Sawyer',
  'adventure of tom sawyer':               'The Adventures of Tom Sawyer',
  // Lekki Headmaster malformed/truncated extractions
  'the lekki headmaster "yes':             'The Lekki Headmaster',
  'the lekki':                             'The Lekki Headmaster',
};

// Year-group attribution: when ALL unmatched "from the novel" questions in a
// year/exam-type cohort are verifiably about one specific text.
// Evidence: character names, settings, and/or explicit title mentions in samples.
// topicHints: if set, row.topic must be in this list (supports re-runs where topic
//             was already set by a previous update — include the expected title too).
const YEAR_GROUP: Array<{
  exam_type: string;
  year: number;
  topicHints?: string[];
  title: string;
}> = [
  // JAMB 2019 Gen Eng: characters Aliya, Mr. Bello, Bobo → Sweet Sixteen
  { exam_type: 'JAMB', year: 2019, topicHints: ['General English', 'Sweet Sixteen', 'Most'], title: 'Sweet Sixteen' },
  // JAMB 2021 Gen Eng: characters Salma, Ummi, Habib, Omar → The Life Changer
  { exam_type: 'JAMB', year: 2021, topicHints: ['General English', 'The Life Changer', 'Seat'], title: 'The Life Changer' },
  // JAMB 2025: characters Bepo, Stardom Schools, Ignatius → The Lekki Headmaster
  // All topic variants (General English, Grammar, Literary Devices, etc.) confirmed
  { exam_type: 'JAMB', year: 2025, title: 'The Lekki Headmaster' },
];

// Generic topic values that mean "not yet attributed" — anything else is a
// specific title already written by a previous run and should be preserved.
const GENERIC_TOPICS = new Set([
  'Prose Fiction', 'General English', 'Grammar', 'Literary Devices',
  'Writing Skills', 'BAT', '', 'null',
]);

function canonicalize(title: string): string {
  let cleaned = title.replace(/^['"""''(]+/, '').replace(/['"""'']+$/, '').trim();
  // Strip trailing " ... continuation (e.g. 'The Lekki Headmaster "Yes...')
  cleaned = cleaned.replace(/\s*".*$/, '').trim();
  // Strip leading "Author's " when followed by a capital word (The/A/An etc.)
  cleaned = cleaned.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*'s?\s+(?=(?:The|A|An)\s)/i, '');
  return CANONICAL[cleaned.toLowerCase()] ?? CANONICAL[title.toLowerCase()] ?? cleaned;
}

function isPlausibleTitle(title: string): boolean {
  if (title.split(' ').length > 7) return false;
  if (!/^[A-Z'"]/.test(title)) return false;
  if (/[?!]$/.test(title)) return false;
  if (/[:(]/.test(title)) return false;
  if (/,\s+[a-z]/.test(title)) return false;
  if (/['"]$/.test(title.trim())) return false;
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
    year: number;
    topic: string | null;
  }>(
    `SELECT id, question_text, subject, exam_type, year, topic
     FROM questions
     WHERE question_text ILIKE 'from the novel%'`,
  );

  // Pass 1: attribution patterns
  const matched   = new Map<number, string>();
  const unmatched: typeof rows = [];

  for (const row of rows) {
    const novel = extractFromAttribution(row.question_text);
    if (novel) matched.set(row.id, novel);
    else unmatched.push(row);
  }

  // Build known-titles list from pass-1 results (longest first)
  const knownTitles = [...new Set(matched.values())].sort((a, b) => b.length - a.length);

  // Pass 2: scan question text for known titles
  const afterPass2: typeof rows = [];
  for (const row of unmatched) {
    const novel = extractFromKnownList(row.question_text, knownTitles);
    if (novel) matched.set(row.id, canonicalize(novel));
    else afterPass2.push(row);
  }

  // Pass 3: year-group attribution (only for cohorts we've verified)
  let stillUnmatched = 0;
  for (const row of afterPass2) {
    const group = YEAR_GROUP.find(g =>
      g.exam_type === row.exam_type &&
      g.year === row.year &&
      (g.topicHints === undefined || g.topicHints.includes(row.topic ?? ''))
    );
    if (group) {
      matched.set(row.id, group.title);
    } else if (row.topic && !GENERIC_TOPICS.has(row.topic) && !BLOCKLIST.has(row.topic.toLowerCase())) {
      // Already has a specific title from a previous run — preserve it so
      // update mode re-writes the same value (idempotent) and analyse counts it.
      matched.set(row.id, row.topic);
    } else {
      stillUnmatched++;
    }
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
    if (stillUnmatched > 0) {
      console.log('Sample unattributed:');
      let shown = 0;
      for (const row of afterPass2) {
        if (!matched.has(row.id) && shown < 20) {
          console.log(`  [${row.exam_type} ${row.year} ${row.topic}] ${row.question_text.replace(/\s+/g,' ').trim().substring(0,120)}`);
          shown++;
        }
      }
    }
    console.log(`\nRun with "update" argument to write titles to questions.topic:\n  npx ts-node scripts/listNovels.ts update\n`);
    await pool.end();
    return;
  }

  // ── Update mode ─────────────────────────────────────────────────────────────
  console.log(`\nUpdating ${matched.size} questions with novel title in topic column...`);

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
