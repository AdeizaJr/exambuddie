#!/usr/bin/env node
// scripts/genBatch.js
// Process ONE batch of questions → append to explanations/<subject>.json
// Run directly with node (foreground only — background sandbox blocks claude binary).
//
// Usage:
//   node scripts/genBatch.js <subject> <offset> <batch_size>
//   e.g.: node scripts/genBatch.js geography 0 30

require('dotenv').config();

const { Pool } = require('pg');
const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const [subject, offsetStr, sizeStr] = process.argv.slice(2);
const offset = parseInt(offsetStr || '0', 10);
const batchSize = parseInt(sizeStr || '30', 10);

if (!subject) {
  console.error('Usage: node genBatch.js <subject> <offset> [batch_size]');
  process.exit(1);
}

const EXPLANATIONS_DIR = path.join(__dirname, '../explanations');
const IMAGE_RE = /\b(diagram|figure|fig\s*\d|table below|table above|graph above|graph below|chart above|chart below|image above|picture above|refer to the|marked [a-z]|the feature marked|direction of .+ from|the area shown|the map above|the map below)\b/i;
// Skip questions with financial/tabular data (long dot-leaders or multi-line tables)
const TABLE_RE = /\.{10,}|_{10,}|(?:\n.*\n.*\n.*\n.*\n)/;

const SYSTEM = `You are an expert Nigerian secondary school teacher explaining WAEC/JAMB questions to 16-18 year old students.
For each question, write a concise explanation (3-5 sentences, plain text, no markdown).
- Explain why the correct answer is right
- Briefly note why key wrong options are incorrect
- Never start with "The correct answer is"

Return ONLY a JSON array: [{"id": <number>, "explanation": "<text>"}, ...]`;

function buildPrompt(questions) {
  const items = questions.map(q => {
    const opts = [`A. ${q.option_a}`, `B. ${q.option_b}`, `C. ${q.option_c}`, `D. ${q.option_d}`];
    if (q.option_e) opts.push(`E. ${q.option_e}`);
    return `ID:${q.id}\nSubject: ${q.exam_type} ${q.subject}${q.year ? ` ${q.year}` : ''}\nQuestion: ${q.question_text}\nOptions:\n${opts.join('\n')}\nCorrect: ${q.correct_option}`;
  }).join('\n\n---\n\n');

  return `${SYSTEM}\n\nQuestions:\n\n${items}`;
}

function loadExisting(subject) {
  const file = path.join(EXPLANATIONS_DIR, `${subject}.json`);
  if (!fs.existsSync(file)) return new Map();
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return new Map(data.map(r => [r.id, r.explanation]));
  } catch { return new Map(); }
}

function saveRecords(subject, map) {
  const file = path.join(EXPLANATIONS_DIR, `${subject}.json`);
  const arr = [...map.entries()].map(([id, explanation]) => ({ id, explanation }));
  fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf-8');
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Fetch all eligible for subject (no images), then slice by offset
    const { rows } = await client.query(
      `SELECT id, exam_type, subject, year, question_text,
              option_a, option_b, option_c, option_d, option_e, correct_option
       FROM questions
       WHERE subject = $1 AND (explanation IS NULL OR explanation = '')
       ORDER BY id`,
      [subject]
    );

    const eligible = rows.filter(q => !IMAGE_RE.test(q.question_text) && !TABLE_RE.test(q.question_text));
    const total = eligible.length;

    if (offset >= total) {
      console.log(`✅ Subject ${subject}: all ${total} eligible questions processed (offset ${offset} >= total)`);
      process.exit(0);
    }

    const chunk = eligible.slice(offset, offset + batchSize);
    const existing = loadExisting(subject);

    // Skip already-generated
    const todo = chunk.filter(q => !existing.has(q.id));

    if (todo.length === 0) {
      console.log(`⏭  offset ${offset}: all ${chunk.length} already generated`);
      console.log(`NEXT_OFFSET=${offset + batchSize}`);
      console.log(`TOTAL=${total}`);
      process.exit(0);
    }

    const prompt = buildPrompt(todo);
    const tmpFile = path.join(os.tmpdir(), `genBatch_${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, prompt, 'utf-8');

    // Strip ANTHROPIC_API_KEY so claude uses its stored OAuth credentials
    const childEnv = { ...process.env };
    delete childEnv.ANTHROPIC_API_KEY;

    let output;
    try {
      output = execSync(`cat "${tmpFile}" | claude --print`, {
        encoding: 'utf-8',
        shell: '/bin/bash',
        env: childEnv,
        timeout: 300_000,   // 5 minutes
        maxBuffer: 10 * 1024 * 1024,
      });
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    const match = output.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in claude output:\n' + output.slice(0, 300));

    const results = JSON.parse(match[0]);
    let saved = 0;
    for (const r of results) {
      if (r.id && r.explanation) { existing.set(r.id, r.explanation); saved++; }
    }
    saveRecords(subject, existing);

    console.log(`✓ offset ${offset}: ${saved}/${todo.length} saved → ${subject}.json (total in file: ${existing.size})`);
    console.log(`NEXT_OFFSET=${offset + batchSize}`);
    console.log(`TOTAL=${total}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
