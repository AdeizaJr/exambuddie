#!/usr/bin/env ts-node
// scripts/genBatch.ts
// Process ONE batch of questions → append to explanations/<subject>.json
// Run directly with ts-node (foreground only — background sandbox blocks claude binary).
//
// Usage:
//   npx ts-node scripts/genBatch.ts <subject> <offset> <batch_size>
//   e.g.: npx ts-node scripts/genBatch.ts geography 0 30

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const [subject, offsetStr, sizeStr] = process.argv.slice(2);
const offset = parseInt(offsetStr || '0', 10);
const batchSize = parseInt(sizeStr || '30', 10);

if (!subject) {
  console.error('Usage: npx ts-node scripts/genBatch.ts <subject> <offset> [batch_size]');
  process.exit(1);
}

const EXPLANATIONS_DIR = path.join(__dirname, '../explanations');
const IMAGE_RE = /\b(diagram|figure|fig\s*\d|table below|table above|graph above|graph below|chart above|chart below|image above|picture above|refer to the|marked [a-z]|the feature marked|direction of .+ from|the area shown|the map above|the map below)\b/i;
const TABLE_RE = /\.{10,}|_{10,}|(?:\n.*\n.*\n.*\n.*\n)/;

const SYSTEM = `You are an expert Nigerian secondary school teacher explaining WAEC/JAMB questions to 16-18 year old students.
For each question, write a concise explanation (3-5 sentences, plain text, no markdown).
- Explain why the correct answer is right
- Briefly note why key wrong options are incorrect
- Never start with "The correct answer is"

Return ONLY a JSON array: [{"id": <number>, "explanation": "<text>"}, ...]`;

interface QuestionRow {
  id: number;
  exam_type: string;
  subject: string;
  year: number | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  correct_option: string;
}

function buildPrompt(questions: QuestionRow[]): string {
  const items = questions.map(q => {
    const opts = [`A. ${q.option_a}`, `B. ${q.option_b}`, `C. ${q.option_c}`, `D. ${q.option_d}`];
    if (q.option_e) opts.push(`E. ${q.option_e}`);
    return `ID:${q.id}\nSubject: ${q.exam_type} ${q.subject}${q.year ? ` ${q.year}` : ''}\nQuestion: ${q.question_text}\nOptions:\n${opts.join('\n')}\nCorrect: ${q.correct_option}`;
  }).join('\n\n---\n\n');

  return `${SYSTEM}\n\nQuestions:\n\n${items}`;
}

function loadExisting(subj: string): Map<number, string> {
  const file = path.join(EXPLANATIONS_DIR, `${subj}.json`);
  if (!fs.existsSync(file)) return new Map();
  try {
    const data: { id: number; explanation: string }[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return new Map(data.map(r => [r.id, r.explanation]));
  } catch { return new Map(); }
}

function saveRecords(subj: string, map: Map<number, string>): void {
  const file = path.join(EXPLANATIONS_DIR, `${subj}.json`);
  const arr = [...map.entries()].map(([id, explanation]) => ({ id, explanation }));
  fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf-8');
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const { rows } = await client.query<QuestionRow>(
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
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    delete childEnv.ANTHROPIC_API_KEY;

    let output: string;
    try {
      output = execSync(`cat "${tmpFile}" | claude --print`, {
        encoding: 'utf-8',
        shell: '/bin/bash',
        env: childEnv,
        timeout: 300_000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    const match = output.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in claude output:\n' + output.slice(0, 300));

    const results: { id: number; explanation: string }[] = JSON.parse(match[0]);
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
