// scripts/generateExplanationsCLI.ts
// Generates explanations using the local `claude` CLI (no API key needed).
// Saves results to explanations/<subject>.json for later import.
//
// Usage:
//   npm run generate-explanations-cli
//   npm run generate-explanations-cli -- --subjects geography,accounts

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const EXPLANATIONS_DIR = path.join(__dirname, '../explanations');
const BATCH_SIZE = 30;

// Override via --subjects geography,accounts
const args = process.argv.slice(2);
const subjectArg = args.find((a) => a.startsWith('--subjects'));
const TARGET_SUBJECTS: string[] = subjectArg
  ? subjectArg.split('=')[1]?.split(',') ?? subjectArg.split(' ')[1]?.split(',') ?? []
  : ['geography', 'accounts'];

const IMAGE_KEYWORDS =
  /\b(diagram|figure|fig\s*\d|table below|table above|graph above|graph below|chart above|chart below|image above|picture above|refer to the|marked [a-z]|the feature marked|direction of .+ from|the area shown|the map above|the map below)\b/i;

function buildPrompt(questions: any[]): string {
  const items = questions
    .map((q) => {
      const opts = [`A. ${q.option_a}`, `B. ${q.option_b}`, `C. ${q.option_c}`, `D. ${q.option_d}`];
      if (q.option_e) opts.push(`E. ${q.option_e}`);
      return (
        `ID:${q.id}\n` +
        `Subject: ${q.exam_type} ${q.subject}${q.year ? ` ${q.year}` : ''}\n` +
        `Question: ${q.question_text}\n` +
        `Options:\n${opts.join('\n')}\n` +
        `Correct: ${q.correct_option}`
      );
    })
    .join('\n\n---\n\n');

  return (
    `You are an expert Nigerian secondary school teacher explaining WAEC/JAMB questions to 16-18 year old students.\n` +
    `For each question below, write a concise explanation (3-5 sentences, plain text, no markdown).\n` +
    `- Explain why the correct answer is right\n` +
    `- Briefly note why key wrong options are incorrect\n` +
    `- Never start with "The correct answer is"\n\n` +
    `Return ONLY a JSON array in this exact format, no preamble:\n` +
    `[{"id": <number>, "explanation": "<text>"}, ...]\n\n` +
    `Questions:\n\n${items}`
  );
}

function callClaude(prompt: string): { id: number; explanation: string }[] {
  // Write prompt to temp file to avoid shell escaping issues
  const tmpFile = `/tmp/claude_prompt_${Date.now()}.txt`;
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  try {
    // Strip ANTHROPIC_API_KEY so claude uses its stored OAuth credentials, not the .env placeholder
    const childEnv = { ...process.env };
    delete (childEnv as any).ANTHROPIC_API_KEY;

    let output: string;
    try {
      output = execSync(`cat "${tmpFile}" | claude --print`, {
        timeout: 300_000,  // 5 minutes per batch
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf-8',
        shell: '/bin/bash',
        env: childEnv,
      });
    } catch (err: any) {
      const detail = (err.stdout || '') + (err.stderr || '');
      throw new Error(`claude failed: ${err.message} | output: ${detail.slice(0, 300)}`);
    }

    // Extract JSON array from output (handle any preamble/postamble)
    const match = output.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`No JSON array in output: ${output.slice(0, 300)}`);

    return JSON.parse(match[0]);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

function loadExisting(subject: string): Map<number, string> {
  const file = path.join(EXPLANATIONS_DIR, `${subject}.json`);
  if (!fs.existsSync(file)) return new Map();
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return new Map(data.map((r: any) => [r.id, r.explanation]));
  } catch {
    return new Map();
  }
}

function saveRecords(subject: string, records: Map<number, string>): void {
  const file = path.join(EXPLANATIONS_DIR, `${subject}.json`);
  const arr = [...records.entries()].map(([id, explanation]) => ({ id, explanation }));
  fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf-8');
}

async function processSubject(subject: string, client: any): Promise<void> {
  const { rows } = await client.query(
    `SELECT id, exam_type, subject, year, question_text,
            option_a, option_b, option_c, option_d, option_e, correct_option
     FROM questions
     WHERE subject = $1
       AND (explanation IS NULL OR explanation = '')
     ORDER BY id`,
    [subject],
  );

  const eligible = rows.filter((q: any) => !IMAGE_KEYWORDS.test(q.question_text));
  const skipped = rows.length - eligible.length;

  console.log(`\n📚 ${subject}: ${rows.length} missing, ${skipped} image-skipped, ${eligible.length} to generate`);

  if (eligible.length === 0) {
    console.log('  ✅ Nothing to do.');
    return;
  }

  // Load existing JSON to avoid regenerating
  const existing = loadExisting(subject);
  const todo = eligible.filter((q: any) => !existing.has(q.id));
  console.log(`  📂 ${existing.size} already in JSON, ${todo.length} remaining`);

  if (todo.length === 0) {
    console.log('  ✅ All already generated. Run import-explanations to push to DB.');
    return;
  }

  const totalBatches = Math.ceil(todo.length / BATCH_SIZE);
  let done = 0;
  let failed = 0;

  for (let b = 0; b < totalBatches; b++) {
    const chunk = todo.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    process.stdout.write(`  [${b + 1}/${totalBatches}] ${chunk.length} questions ... `);

    let results: { id: number; explanation: string }[] = [];
    let attempts = 0;

    while (attempts < 3) {
      try {
        results = callClaude(buildPrompt(chunk));
        break;
      } catch (err: any) {
        attempts++;
        if (attempts >= 3) {
          console.log(`✗ failed after 3 attempts: ${err.message}`);
          failed += chunk.length;
          break;
        }
        process.stdout.write(`retry(${attempts})... `);
      }
    }

    if (results.length > 0) {
      for (const r of results) {
        if (r.id && r.explanation) existing.set(r.id, r.explanation);
      }
      saveRecords(subject, existing);
      done += results.length;
      console.log(`✓ ${results.length} saved (total: ${done}/${todo.length})`);
    }
  }

  console.log(`\n  ✅ ${subject} done: ${done} generated, ${failed} failed`);
  console.log(`  📄 Saved → explanations/${subject}.json`);
}

async function run(): Promise<void> {
  console.log(`\n🎯 Target subjects: ${TARGET_SUBJECTS.join(', ')}`);

  const client = await pool.connect();
  try {
    for (const subject of TARGET_SUBJECTS) {
      await processSubject(subject, client);
    }
    console.log('\n🎉 All done! Run: npm run import-explanations\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
