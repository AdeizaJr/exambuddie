// scripts/markPhoneticsUnderline.ts
// Marks the underlined letters in phonetics questions (vowel/consonant sound questions).
// Uses the CMU Pronouncing Dictionary to find which phoneme is shared between
// the test word and the correct answer, then identifies the corresponding
// letter cluster in the test word.
//
// Usage:  npx ts-node scripts/markPhoneticsUnderline.ts
// Safe to re-run — skips already-marked questions.

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
// @ts-ignore
const cmuDict: Record<string, string> = require('cmu-pronouncing-dictionary').dictionary;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── ARPAbet vowel set ────────────────────────────────────────────────────────
const VOWEL_PHONEMES = new Set([
  'AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW',
]);

// Phoneme → letter spellings, longest/most-specific first
const PHONEME_GRAPHEMES: Record<string, string[]> = {
  // Vowels
  'AA': ['ar', 'a', 'o'],           // car, palm, spot (American AA)
  'AE': ['a'],
  'AH': ['ou', 'u', 'o', 'a'],
  'AO': ['oor', 'or', 'aw', 'augh', 'ough', 'au', 'al', 'oa', 'o', 'a'],
  'AW': ['ough', 'ow', 'ou'],
  'AY': ['igh', 'ie', 'ye', 'i', 'y', 'ei'],
  'EH': ['ea', 'ai', 'a', 'e'],
  'ER': ['ear', 'eer', 'er', 'ir', 'ur', 'or', 'ar'],
  'EY': ['eigh', 'aigh', 'ai', 'ay', 'ea', 'ei', 'a'],
  'IH': ['i', 'e', 'y', 'ie'],
  'IY': ['ee', 'ea', 'ie', 'ei', 'ey', 'e', 'i'],
  'OW': ['ough', 'oa', 'oe', 'ow', 'o'],
  'OY': ['oi', 'oy', 'uo'],         // coin, toy, buoy
  'UH': ['oo', 'u', 'o'],           // book, full, wolf
  'UW': ['ough', 'oo', 'ue', 'ew', 'ui', 'ou', 'u', 'o'],
  // Consonants (longest/rarest spelling first)
  'B': ['b'],
  'CH': ['tch', 'ture', 'tu', 'ch'],  // match, picture, ch (French)
  'D': ['dd', 'd'],
  'DH': ['th'],
  'F': ['ff', 'ph', 'gh', 'f'],
  'G': ['gh', 'gg', 'g'],
  'HH': ['wh', 'h'],
  'JH': ['dge', 'dg', 'ge', 'j', 'g'],
  'K': ['ck', 'que', 'qu', 'ch', 'kh', 'x', 'k', 'c'],  // x = ks (tax)
  'L': ['ll', 'l'],
  'M': ['mb', 'mm', 'm'],
  'N': ['kn', 'gn', 'nn', 'n'],
  'NG': ['ng', 'n'],
  'P': ['pp', 'p'],
  'R': ['wr', 'rr', 'r'],
  'S': ['sc', 'ss', 'ce', 'se', 'ps', 'c', 's'],
  'SH': ['ssi', 'sure', 'ti', 'ci', 'ssh', 'ch', 'sh'],  // + sure (pressure), ch (chute)
  'T': ['tt', 'ed', 't'],           // + ed (helped/risked)
  'TH': ['th'],
  'V': ['v', 'f'],                  // + f (of)
  'W': ['wh', 'w'],
  'X': ['x'],                       // tax → KS
  'Y': ['y'],
  'Z': ['zz', 'se', 'z', 's'],
  'ZH': ['sure', 'si', 'ge', 's'], // + sure (measure), si (vision)
};

// ── British → American spelling fallbacks ───────────────────────────────────
// British English phoneme overrides (word → phoneme string in ARPAbet)
const BRIT_OVERRIDES: Record<string, string> = {
  'marry':  'M AE1 R IY0',        // British /mæri/, CMU gives EH
  'ranch':  'R AA1 N CH',         // British /rɑːntʃ/, CMU gives AE
  'pass':   'P AA1 S',            // British /pɑːs/, CMU gives AE
  'path':   'P AA1 TH',
  'bath':   'B AA1 TH',
  'grass':  'G R AA1 S',
  'aunt':   'AA1 N T',            // British /ɑːnt/, CMU gives AE
  'wound':  'W UW1 N D',          // wound (injury) British /wuːnd/
  'buoy':   'B OY1',              // British /bɔɪ/, CMU gives UW IY
  'war':    'W AO1 R',
  'clerk':  'K L AA1 K',          // British /klɑːk/, CMU gives ER
  'mayor':  'M EH1 R',            // British /mɛː/, CMU gives EY+ER
  'chair':  'CH EH1 R',           // British /tʃɛə/
  'cure':   'K Y UH1 R',          // keep CMU but ure→UH
  'sure':   'SH UH1 R',
  'pure':   'P Y UH1 R',
  'our':    'AW1 ER0',            // /aʊə/ British centering
  'here':   'HH IH1 R',
  'there':  'DH EH1 R',
};

const BRIT_TO_US: Record<string, string> = {
  'odour':'odor','colour':'color','honour':'honor','labour':'labor','flavour':'flavor',
  'humour':'humor','neighbour':'neighbor','behaviour':'behavior','glamour':'glamor',
  'armour':'armor','harbour':'harbor','savour':'savor','vigour':'vigor',
  'centre':'center','theatre':'theater','metre':'meter','fibre':'fiber','litre':'liter',
  'defence':'defense','offence':'offense','licence':'license','practise':'practice',
  'organised':'organized','recognised':'recognized','realise':'realize','analyse':'analyze',
  'travelling':'traveling','cancelled':'canceled','labelled':'labeled',
  'aeroplane':'airplane','aluminium':'aluminum','moustache':'mustache',
  'catalogue':'catalog','dialogue':'dialog','programme':'program',
  'tyre':'tire','pyjamas':'pajamas','kerb':'curb','plough':'plow',
};

// Normalise ARPAbet phoneme codes (H=HH, AX=AH, etc.)
function normPhoneme(p: string): string {
  const base = p.replace(/[012]$/, '');
  if (base === 'H') return 'HH';
  if (base === 'AX') return 'AH';
  return base;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function lookupWord(word: string): string | null {
  const lc = word.toLowerCase();
  // British English overrides first
  if (BRIT_OVERRIDES[lc]) return BRIT_OVERRIDES[lc];
  if (cmuDict[lc]) return cmuDict[lc];
  // Try British → American spelling fallback
  if (BRIT_TO_US[lc] && cmuDict[BRIT_TO_US[lc]]) return cmuDict[BRIT_TO_US[lc]];
  return null;
}

function getPhonemes(word: string): string[] | null {
  // Handle multi-word test phrases — use last meaningful word
  const words = word.trim().split(/\s+/);
  for (let i = words.length - 1; i >= 0; i--) {
    const ph = lookupWord(words[i]);
    if (ph) return ph.split(' ').map(normPhoneme);
  }
  return null;
}

// Silent-letter graphemes: words where specific letter combos produce no phoneme
// Maps word pattern → the silent letters to underline
const SILENT_PATTERNS: Array<{ test: RegExp; letters: string; desc: string }> = [
  { test: /gh$/i,      letters: 'gh',   desc: 'silent gh at end (high, sigh)' },
  { test: /^kn/i,      letters: 'kn',   desc: 'silent k in kn (knot, knife)' },
  { test: /^gn/i,      letters: 'gn',   desc: 'silent g in gn (gnash, gnaw)' },
  { test: /^wr/i,      letters: 'wr',   desc: 'silent w in wr (write, wrist)' },
  { test: /mb$/i,      letters: 'mb',   desc: 'silent b in mb (lamb, comb)' },
  { test: /mn$/i,      letters: 'mn',   desc: 'silent n in mn (damn, hymn)' },
  { test: /^ps/i,      letters: 'ps',   desc: 'silent p in ps (pseudo, psalm)' },
  { test: /^pn/i,      letters: 'pn',   desc: 'silent p in pn (pneumonia)' },
  { test: /ld$/i,      letters: 'ld',   desc: 'silent l in ld (could, would)' },
];

function isVowelPhoneme(p: string): boolean {
  return VOWEL_PHONEMES.has(p);
}

// Find the letters in `word` that correspond to `phoneme`, searching left-to-right
function findGrapheme(word: string, phoneme: string): string | null {
  const graphemes = PHONEME_GRAPHEMES[phoneme];
  if (!graphemes) return null;
  const lower = word.toLowerCase();
  for (const g of graphemes) {
    if (lower.includes(g)) return g;
  }
  return null;
}

// For a word and a target phoneme (or literal grapheme string), return letter span
function locateLetters(word: string, phoneme: string): { start: number; end: number } | null {
  const lower = word.toLowerCase();
  // If called with a literal grapheme string (silent patterns), search directly
  if (!PHONEME_GRAPHEMES[phoneme]) {
    const idx = lower.indexOf(phoneme.toLowerCase());
    if (idx !== -1) return { start: idx, end: idx + phoneme.length };
    return null;
  }
  const graphemes = PHONEME_GRAPHEMES[phoneme];
  for (const g of graphemes) {
    const idx = lower.indexOf(g);
    if (idx !== -1) return { start: idx, end: idx + g.length };
  }
  return null;
}

function injectInlineMarkup(word: string, start: number, end: number): string {
  return word.slice(0, start) + '*' + word.slice(start, end) + '*' + word.slice(end);
}

// ── Core logic ────────────────────────────────────────────────────────────────

// Phoneme equivalences for finding shared sounds across dialect/spelling variations
const EQUIV: Record<string, string[]> = {
  'TH': ['DH'], 'DH': ['TH'],         // th voiced/voiceless (then/method)
  'ZH': ['JH', 'SH'], 'JH': ['ZH'],   // fricative sibilants (prestige/badge, fissure/vision)
  'SH': ['ZH'],
  'AA': ['AE', 'AO', 'AH'], 'AE': ['AA', 'AH'],  // British/American + schwa
  'AO': ['AA', 'OW', 'AH'], 'OW': ['AO'],
  'AH': ['IH', 'AA', 'AE'],           // unstressed AH ≈ IH (granite/sit, mitten/knowledge)
  'IH': ['AH'],
  'K': ['X'], 'X': ['K', 'S'],        // x = ks (tax)
  'S': ['X'],
  'UH': ['UW', 'OW'], 'UW': ['UH'],   // British centring diphthones (cure/our area)
};

function getEquiv(phoneme: string): string[] {
  return [phoneme, ...(EQUIV[phoneme] || [])];
}

function setsShareEquiv(s1: Set<string>, s2: Set<string>): string | null {
  for (const p of s1) {
    for (const eq of getEquiv(p)) {
      if (s2.has(eq)) return p; // return the test-word phoneme
    }
  }
  return null;
}

function markPhonetics(testWord: string, correctWord: string, isVowel: boolean): string | null {
  // Strip spaces from test word (handles "j oy", "rou g e" data issues)
  const cleanTestWord = testWord.replace(/\s+/g, '');
  const testPh = getPhonemes(cleanTestWord);
  const corrPh = getPhonemes(correctWord);

  // ── Handle silent letter questions (consonant only) ─────────────────────
  if (!isVowel && testPh && corrPh) {
    // Check if test word has a silent-letter pattern and the correct answer
    // shares the "same" sound (often a word with the same phoneme from different spelling)
    for (const sp of SILENT_PATTERNS) {
      // Extract the actual word to test (last word of multi-word phrases)
      const lastWord = testWord.trim().split(/\s+/).pop() || testWord;
      if (sp.test.test(lastWord)) {
        // The underlined letters are the silent pattern letters
        const loc = locateLetters(lastWord, sp.letters as any);
        if (loc) {
          // Verify correct answer has the same PHONEME as the non-silent part of the word
          return injectInlineMarkup(lastWord, loc.start, loc.end);
        }
        // Fall through to normal handling
      }
    }
  }

  if (!testPh || !corrPh) return null;

  const relevant = isVowel ? isVowelPhoneme : (p: string) => !isVowelPhoneme(p);
  const testSet = new Set(testPh.filter(relevant));
  const corrSet = new Set(corrPh.filter(relevant));

  // Try exact match first, then equivalence-extended match
  let target: string | null = null;
  const common = new Set(['T','N','S','D','L','R','M','B','P','K','F','W','Y']);
  const shared: string[] = [];
  for (const p of testSet) if (corrSet.has(p)) shared.push(p);

  if (shared.length > 0) {
    target = shared.find(p => !common.has(p)) || shared[0];
  } else {
    // Try equivalences
    target = setsShareEquiv(testSet, corrSet);
  }

  if (!target) return null;

  const loc = locateLetters(cleanTestWord, target);
  if (!loc) return null;

  return injectInlineMarkup(cleanTestWord, loc.start, loc.end);
}

// Instruction-line patterns — only applies to lines longer than ~20 chars
const INSTRUCTION_RE = /^(choose|select|from the|in each|for the|which|identify)/i;

// Extract the test word from question text (last non-empty line)
function extractTestWord(questionText: string): string {
  const lines = questionText.split('\n').map(l => l.trim()).filter(Boolean);

  // Pass 1: find a short line — if it's ≤15 chars, it's the test word regardless
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (l.length === 0) continue;
    const cleaned = l.replace(/[^a-zA-Z\s]/g, '').trim();
    if (cleaned.length === 0) continue;
    // Very short lines are always test words
    if (cleaned.length <= 15 && !l.match(/^[A-E]\./i)) return cleaned;
    // Longer lines only if they're not instructions
    if (cleaned.length < 30 && !INSTRUCTION_RE.test(l) && !l.match(/^[A-E]\./i)) return cleaned;
  }

  // Pass 2: test word is on same line as instruction (e.g. "...the letter underlined. Vision.")
  // Extract the last word(s) after the final full-stop or question mark in the text
  const fullText = questionText.replace(/\n/g, ' ').trim();
  const lastSentenceMatch = fullText.match(/[.?!]\s+([A-Za-z][A-Za-z\s-]{0,25})[.?!]?\s*$/);
  if (lastSentenceMatch) {
    const candidate = lastSentenceMatch[1].trim().replace(/[^a-zA-Z\s]/g, '').trim();
    if (candidate.length > 0 && candidate.length < 25 && !INSTRUCTION_RE.test(candidate)) {
      return candidate;
    }
  }

  return '';
}

function extractCorrectWord(q: any): string {
  const opts: Record<string, string> = {
    A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e
  };
  const text = opts[q.correct_option] || '';
  return text.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/)[0] || '';
}

// When the correct word isn't in CMU, try all options to find ANY that matches the test word
function findAnyMatchingOption(q: any, testWord: string, isVowel: boolean): string | null {
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(Boolean);
  const testPh = getPhonemes(testWord.replace(/\s+/g, ''));
  if (!testPh) return null;
  const relevant = isVowel ? isVowelPhoneme : (p: string) => !isVowelPhoneme(p);
  const testSet = new Set(testPh.filter(relevant));
  for (const opt of opts) {
    const word = opt.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/)[0];
    const ph = getPhonemes(word);
    if (!ph) continue;
    const optSet = new Set(ph.filter(relevant));
    if (setsShareEquiv(testSet, optSet)) return word;
  }
  return null;
}

// Rebuild question_text with marked test word
function injectMarkup(questionText: string, testWord: string, markedWord: string): string {
  // testWord may have had spaces stripped — match the original spaced form too
  const spacedTestWord = testWord; // already cleaned in caller
  const lines = questionText.split('\n');
  const cleanStr = (s: string) => s.replace(/[^a-zA-Z]/g, '').toLowerCase();

  // Try line-by-line match (last line first)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (cleanStr(lines[i]) === cleanStr(testWord)) {
      const escaped = testWord.replace(/[-]/g, '[-]');
      const replaced = lines[i].replace(new RegExp(escaped, 'i'), markedWord);
      if (replaced !== lines[i]) { lines[i] = replaced; return lines.join('\n'); }
    }
  }

  // Fallback: match word anywhere in full text (handles same-line instruction)
  const escaped = testWord.replace(/[-]/g, '[-]').replace(/\s+/g, '\\s*');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  if (regex.test(questionText)) {
    return questionText.replace(regex, markedWord);
  }
  return questionText;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`CMU dict loaded: ${Object.keys(cmuDict).length.toLocaleString()} words`);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, correct_option
       FROM questions
       WHERE subject ILIKE '%english%'
         AND question_text ILIKE '%underlined%'
         AND question_text NOT LIKE '%*%'
         AND (question_text ILIKE '%vowel sound%' OR question_text ILIKE '%consonant sound%'
              OR question_text ILIKE '%letter(s) underlined%'
              OR question_text ILIKE '%underlined letter%')
       ORDER BY id`,
    );

    if (rows.length === 0) { console.log('✅ Nothing to process.'); return; }
    console.log(`\n📊 ${rows.length} phonetics questions to process\n`);

    let done = 0, skipped = 0;

    for (const q of rows) {
      const isVowel = /vowel/i.test(q.question_text);
      const testWord = extractTestWord(q.question_text);
      let correctWord = extractCorrectWord(q);

      if (!testWord) { skipped++; continue; }

      // Hardcoded markings for edge cases that can't be resolved algorithmically
      const HARDCODED: Record<number, string> = {
        61582: 'O*f* course',     // "f" in "of" = /v/ same as "v" in "over"
        63422: 'C*ure*',          // British /jʊə/ "ure" diphthong
        67958: 'm*i*tten',        // "i" = IH same as in "knowledge"
        67981: 'si*ng*',          // "zonked" not in CMU; both have NG phoneme
        68610: 'die*s*el',        // "s" = /z/ same as terminal "s" in "boys"
        68752: 'a*rr*est',        // "rr" = /r/ same as in "rule"
        69113: 'p*u*re',          // "furore" not in CMU; "u" = UH
        69434: 'p*u*re',          // same question, different options order
        69452: 'u*ph*olstory',    // "ph" = /f/ same as in "upheaval"
        69454: 'si*g*n',          // silent "g" same category as silent "n" in "hymn"
      };
      if (HARDCODED[q.id]) {
        const hc = HARDCODED[q.id];
        const updated = injectMarkup(q.question_text, testWord, hc);
        if (updated !== q.question_text) {
          await client.query(`UPDATE questions SET question_text = $1 WHERE id = $2`, [updated, q.id]);
          done++;
          continue;
        }
      }

      // If correct word not in CMU, try finding any option that shares a phoneme
      if (correctWord && !getPhonemes(correctWord)) {
        correctWord = findAnyMatchingOption(q, testWord, isVowel) || correctWord;
      }

      const marked = markPhonetics(testWord, correctWord, isVowel);
      if (!marked || marked === testWord) { skipped++; continue; }

      const updated = injectMarkup(q.question_text, testWord, marked);
      if (updated === q.question_text) { skipped++; continue; }

      await client.query(`UPDATE questions SET question_text = $1 WHERE id = $2`, [updated, q.id]);
      done++;
      if (done % 50 === 0) process.stdout.write(`\r  ✓ ${done}/${rows.length}...`);
    }

    console.log(`\n🎉 Done! ${done} updated, ${skipped} skipped out of ${rows.length}.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
