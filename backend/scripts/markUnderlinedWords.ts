// scripts/markUnderlinedWords.ts
// Identifies and marks the "underlined word" in English questions where the
// original exam underline was lost during scraping.
//
// Usage:  npx ts-node scripts/markUnderlinedWords.ts
// Safe to re-run — skips questions already containing *word* markup.

import dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── WordNet ─────────────────────────────────────────────────────────────────

interface Synset { words: string[]; ptrs: { sym: string; offset: string; pos: string }[] }
const allSynsets = new Map<string, Synset>();
const wordSynsets = new Map<string, string[]>();

async function loadWordNet(): Promise<void> {
  const dictDir = path.join(__dirname, '../node_modules/wordnet-db/dict');
  const files = [
    { file: 'data.adj', pos: 'a' }, { file: 'data.adv', pos: 'r' },
    { file: 'data.verb', pos: 'v' }, { file: 'data.noun', pos: 'n' },
  ];
  for (const { file, pos } of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(dictDir, file)) });
    for await (const line of rl) {
      if (line.startsWith('  ')) continue;
      const parts = line.split('|')[0].trim().split(' ');
      if (parts.length < 4) continue;
      const offset = parts[0];
      const wCnt = parseInt(parts[3], 16);
      const words: string[] = [];
      for (let i = 0; i < wCnt; i++) {
        const w = parts[4 + i * 2];
        if (w) words.push(w.toLowerCase().replace(/_/g, ' '));
      }
      const ptrStart = 4 + wCnt * 2;
      const pCnt = parseInt(parts[ptrStart], 10);
      const ptrs: { sym: string; offset: string; pos: string }[] = [];
      for (let i = 0; i < pCnt; i++) {
        const b = ptrStart + 1 + i * 4;
        ptrs.push({ sym: parts[b], offset: parts[b + 1], pos: parts[b + 2] });
      }
      const key = `${pos}:${offset}`;
      allSynsets.set(key, { words, ptrs });
      for (const w of words) {
        if (!wordSynsets.has(w)) wordSynsets.set(w, []);
        wordSynsets.get(w)!.push(key);
      }
    }
  }
}

function synsetWordsOf(word: string): Set<string> {
  const out = new Set<string>();
  for (const key of wordSynsets.get(word) || []) {
    const s = allSynsets.get(key);
    if (s) for (const w of s.words) out.add(w);
  }
  return out;
}

// Antonyms: walk satellite → head → antonym chain
function antonymsOf(word: string): Set<string> {
  const out = new Set<string>();
  for (const key of wordSynsets.get(word) || []) {
    const s = allSynsets.get(key);
    if (!s) continue;
    const toCheck: Synset[] = [s];
    for (const ptr of s.ptrs) {
      if (ptr.sym === '&') {
        const head = allSynsets.get(`${ptr.pos}:${ptr.offset}`);
        if (head) toCheck.push(head);
      }
    }
    for (const synset of toCheck) {
      for (const ptr of synset.ptrs) {
        if (ptr.sym === '!') {
          const ant = allSynsets.get(`${ptr.pos}:${ptr.offset}`);
          if (ant) for (const w of ant.words) out.add(w);
        }
      }
    }
  }
  return out;
}

// Expanded synonyms: direct synset + synonyms-of-synonyms (one hop)
function expandedSynonymsOf(word: string): Set<string> {
  const out = synsetWordsOf(word);
  // One extra hop for words sharing any synset with out
  for (const s of [...out]) {
    for (const w of synsetWordsOf(s)) out.add(w);
  }
  return out;
}

// Expanded antonyms: antonyms + antonyms of synonyms
function expandedAntonymsOf(word: string): Set<string> {
  const out = antonymsOf(word);
  for (const syn of synsetWordsOf(word)) {
    for (const ant of antonymsOf(syn)) out.add(ant);
  }
  return out;
}

// ── Text utilities ───────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a','an','the','is','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','must',
  'can','could','and','or','but','if','in','on','at','to','for','of','with',
  'by','from','that','this','these','those','it','he','she','they','we',
  'you','his','her','its','their','our','your','my','not','also','very',
  'really','just','so','such','more','most','less','least','both','all',
  'any','each','every','no','nor','only','own','same','than','too','as',
  'are','about','up','out','there','here','when','how','what','who','which',
  'into','through','during','before','after','above','below','between',
  'then','still','again','off','over','under','once','s','i','me','him',
  'them','us','am','because','though','although','while','even','without',
  'since','until','across','among','around','along','behind','beside',
  'despite','except','inside','outside','throughout','toward','upon',
  'within','yet','however','often','sometimes','always','never','rather',
  'quite','already','almost','usually','generally','therefore','thus',
  'hence','moreover','furthermore','nevertheless','nonetheless','indeed',
  'perhaps','probably','certainly','clearly','simply','merely','especially',
  'particularly','mainly','mostly','partly','nearly','barely','hardly',
  'lately','recently','finally','suddenly','truly','truly','certainly',
  'given','come','came','went','said','says','seem','seems','seemed','made',
  'make','makes','take','takes','took','keep','kept','let','lets','put',
  'puts','gets','got','give','gives','gave','know','knew','see','saw',
  'look','looks','looked','felt','feel','feel','find','found','tell','told',
  'call','called','try','tried','leave','left','turn','turned','need',
  'needed','use','used','want','wanted','show','showed','shown','ask',
  'asked','seem','bring','brought','help','helped','start','started',
  'hold','held','stand','stood','move','moved','live','lived','believe',
  'believed','happen','happened','become','became','across','upon',
]);

function norm(w: string): string {
  return w.toLowerCase().replace(/[-_]/g, ' ').trim();
}

function isProperNoun(originalWord: string, fullText: string): boolean {
  // A word is a proper noun if it appears capitalised in the middle of sentences
  const regex = new RegExp(`(?<![.!?]\\s)\\b${originalWord}\\b`);
  const capitalized = new RegExp(`\\b[A-Z][a-z]+\\b`);
  return capitalized.test(originalWord) && originalWord[0] === originalWord[0].toUpperCase()
    && originalWord[0] !== originalWord[0].toLowerCase();
}

function extractSentence(questionText: string): string {
  const lines = questionText.split('\n').map(l => l.trim()).filter(Boolean);
  // Last meaningful line (not the instruction)
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    const lc = l.toLowerCase();
    if (l.length > 10 && !lc.startsWith('choose') && !lc.startsWith('from the list')
        && !lc.startsWith('select') && !lc.startsWith('pick')) {
      return l;
    }
  }
  return questionText;
}

function extractKeyWord(phrase: string): string {
  const words = phrase.toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  return words[0] || phrase.toLowerCase().trim();
}

function getCandidates(sentence: string, questionText: string): string[] {
  // Split preserving hyphens as compound words
  const tokens = sentence
    .replace(/["""''.,!?;:()[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);

  return tokens.filter(t => {
    const clean = t.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
    if (clean.length < 3) return false;
    const lower = clean.toLowerCase();
    if (STOPWORDS.has(lower)) return false;
    // Skip verb -ing/-ed if not also an adjective in WordNet
    if ((lower.endsWith('ing') || lower.endsWith('ed')) && !wordSynsets.has(lower)) return false;
    // Skip numbers
    if (/^\d+$/.test(lower)) return false;
    // Skip blanks
    if (lower.includes('_')) return false;
    // Skip proper nouns (capitalised mid-sentence)
    if (/^[A-Z][a-z]/.test(clean) && !wordSynsets.has(lower)) return false;
    return true;
  }).map(t => t.replace(/^[^a-zA-Z-]+|[^a-zA-Z-]+$/g, ''));
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function scoreCandidate(cand: string, correctNorm: string, isAntonym: boolean, allOptions: string[]): number {
  const cn = norm(cand);
  let score = 0;

  // S1: Direct antonym/synonym match in WordNet
  if (isAntonym) {
    const ants = expandedAntonymsOf(cn);
    if (ants.has(correctNorm)) score += 100;
    // Check single words of compound candidates
    for (const part of cn.split(' ')) {
      if (expandedAntonymsOf(part).has(correctNorm)) score += 60;
    }
    // Check if correct's antonyms include candidate
    if (expandedAntonymsOf(correctNorm).has(cn)) score += 80;
  } else {
    const syns = expandedSynonymsOf(cn);
    if (syns.has(correctNorm)) score += 100;
    if (expandedSynonymsOf(correctNorm).has(cn)) score += 100;
    // Partial: correct answer is a component of candidate's synonym (e.g. cure-all → cure)
    for (const s of syns) {
      if (s.includes(correctNorm) || correctNorm.includes(s)) score += 50;
    }
    for (const part of cn.split(' ')) {
      if (expandedSynonymsOf(part).has(correctNorm)) score += 60;
      if (expandedSynonymsOf(correctNorm).has(part)) score += 60;
    }
  }

  // S2: Option overlap — all options related to underlined word
  for (const opt of allOptions) {
    const optNorm = norm(opt);
    const related = isAntonym ? expandedAntonymsOf(cn) : expandedSynonymsOf(cn);
    if (related.has(optNorm)) score += 10;
    // Also check reverse
    const relOpt = isAntonym ? expandedAntonymsOf(optNorm) : expandedSynonymsOf(optNorm);
    if (relOpt.has(cn)) score += 10;
  }

  // S3: Prefer adjectives over verbs (adj more likely to be underlined in these questions)
  const keys = wordSynsets.get(cn) || [];
  const hasAdj = keys.some(k => k.startsWith('a:'));
  const hasNoun = keys.some(k => k.startsWith('n:'));
  const hasVerb = keys.some(k => k.startsWith('v:'));
  if (hasAdj) score += 5;
  if (hasNoun) score += 3;
  if (hasVerb) score -= 2;

  // S4: Prefer content words not in WordNet at all (rare/domain-specific vocab)
  if (!wordSynsets.has(cn)) score += 8;

  // S5: Prefer longer words (more likely to be the vocabulary focus)
  score += Math.min(cn.length, 12);

  return score;
}

function findUnderlinedWord(q: any): string | null {
  const sentence = extractSentence(q.question_text);
  const candidates = getCandidates(sentence, q.question_text);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const optionArr = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(Boolean);
  const correctText = optionArr[['A','B','C','D','E'].indexOf(q.correct_option)] || '';
  const correctNorm = norm(extractKeyWord(correctText));
  const isAntonym = /opposite|antonym/i.test(q.question_text);
  const allOptions = optionArr.map(o => extractKeyWord(o));

  let best: string | null = null;
  let bestScore = -Infinity;

  for (const cand of candidates) {
    const s = scoreCandidate(cand, correctNorm, isAntonym, allOptions);
    if (s > bestScore) { bestScore = s; best = cand; }
  }

  return best;
}

function injectMarkup(questionText: string, word: string): string | null {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  const match = questionText.match(regex);
  if (!match) return null;
  return questionText.replace(regex, `*${match[0]}*`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  process.stdout.write('📖 Loading WordNet... ');
  await loadWordNet();
  console.log(`done (${allSynsets.size.toLocaleString()} synsets)`);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, correct_option
       FROM questions
       WHERE subject ILIKE '%english%'
         AND question_text ILIKE '%underlined%'
         AND question_text NOT LIKE '%*%'
         AND (question_text ILIKE '%opposite%' OR question_text ILIKE '%nearest in meaning%'
              OR question_text ILIKE '%synonym%' OR question_text ILIKE '%antonym%'
              OR question_text ILIKE '%underlined word%')
         AND question_text NOT ILIKE '%vowel sound%'
         AND question_text NOT ILIKE '%consonant sound%'
         AND question_text NOT ILIKE '%letter(s) underlined%'
         AND question_text NOT ILIKE '%underlined letter%'
       ORDER BY id`,
    );

    if (rows.length === 0) {
      console.log('✅ No questions need underlined word markup.');
      return;
    }
    console.log(`\n📊 Found ${rows.length} questions to process\n`);

    let done = 0; let skipped = 0;

    for (const q of rows) {
      const word = findUnderlinedWord(q);
      if (!word) { skipped++; console.warn(`  ⚠️  Q#${q.id}: no candidate found`); continue; }
      const updated = injectMarkup(q.question_text, word);
      if (!updated) { skipped++; console.warn(`  ⚠️  Q#${q.id}: word "${word}" not found in text`); continue; }
      await client.query(`UPDATE questions SET question_text = $1 WHERE id = $2`, [updated, q.id]);
      done++;
      if (done % 50 === 0) process.stdout.write(`\r  ✓ Updated ${done}/${rows.length}...`);
    }

    console.log(`\n\n🎉 Done! ${done} updated, ${skipped} skipped out of ${rows.length}.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
