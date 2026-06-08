// scripts/generateExplanationsToJson.ts
// Generates AI explanations for questions with missing explanations and
// saves results to explanations/<subject>.json instead of updating DB directly.
//
// Usage:
//   npm run generate-explanations-to-json
//
// After this runs, use `npm run import-explanations` to push JSON → DB.

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Resolve credentials: prefer ANTHROPIC_API_KEY in .env,
// fall back to Claude Code OAuth token stored in ~/.claude/.credentials.json
function resolveAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && !apiKey.startsWith('your_')) {
    return new Anthropic({ apiKey });
  }

  // Try Claude Code stored OAuth token
  const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
  if (fs.existsSync(credPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
      let oauth = raw.claudeAiOauth ?? {};
      if (typeof oauth === 'string') oauth = JSON.parse(oauth);
      const token = oauth.accessToken as string | undefined;
      if (token) {
        console.log('  🔑 Using Claude Code OAuth token (no API key needed)');
        return new Anthropic({ authToken: token });
      }
    } catch {
      // fall through
    }
  }

  throw new Error(
    'No valid API key found. Set ANTHROPIC_API_KEY in .env or ensure Claude Code is logged in.',
  );
}

const anthropic = resolveAnthropicClient();

const EXPLANATIONS_DIR = path.join(__dirname, '../explanations');
const MAX_PER_BATCH = 5_000;
const POLL_INTERVAL_MS = 30_000;
const MAX_WAIT_MS = 4 * 60 * 60 * 1000;

// Only generate for these subjects
const TARGET_SUBJECTS = ['geography', 'accounts'];

// Questions referencing visuals can't be explained without the image — skip
const IMAGE_KEYWORDS =
  /\b(diagram|figure|fig\s*\d|table below|table above|graph above|graph below|chart above|chart below|image above|picture above|refer to the)\b/i;

const SYSTEM_PROMPT = `You are an expert Nigerian secondary school teacher with 20 years of experience preparing students for WAEC, NECO, and JAMB examinations.

When given a multiple-choice question, explain:
1. Why the correct answer is right (clearly, with the key fact or reasoning)
2. Briefly why each wrong option is incorrect (one line each)

Rules:
- Write for a 16–18 year old Nigerian student
- Be concise: 4–7 sentences total
- Use step-by-step reasoning for maths/sciences
- Never start with "The correct answer is" — that is already shown; jump straight into the explanation
- Plain text only, no markdown`;

function buildOptions(q: any): string {
  const lines = [`A. ${q.option_a}`, `B. ${q.option_b}`, `C. ${q.option_c}`, `D. ${q.option_d}`];
  if (q.option_e) lines.push(`E. ${q.option_e}`);
  return lines.join('\n');
}

function buildUserMessage(q: any): string {
  return (
    `Subject: ${q.exam_type} ${q.subject}${q.year ? ` ${q.year}` : ''}\n\n` +
    `Question: ${q.question_text}\n\n` +
    `Options:\n${buildOptions(q)}\n\n` +
    `Correct answer: ${q.correct_option}\n\n` +
    `Explain why ${q.correct_option} is correct and why the others are wrong.`
  );
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollBatchUntilComplete(batchId: string): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  let dots = 0;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const batch = await anthropic.messages.batches.retrieve(batchId);
    dots++;
    process.stdout.write(
      `\r  ⏳ [${batchId}] status=${batch.processing_status} ` +
        `(${batch.request_counts.succeeded} done, ${batch.request_counts.errored} errored)` +
        '.'.repeat(dots % 4),
    );
    if (batch.processing_status === 'ended') {
      console.log();
      return;
    }
  }
  throw new Error(`Batch ${batchId} did not complete within ${MAX_WAIT_MS / 60000} minutes`);
}

async function processBatch(
  questions: any[],
  subject: string,
): Promise<{ done: number; failed: number }> {
  type BatchRequest = Anthropic.Messages.Batches.BatchCreateParams.Request;
  const requests: BatchRequest[] = questions.map((q): BatchRequest => ({
    custom_id: String(q.id),
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: [
        {
          type: 'text' as const,
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user' as const, content: buildUserMessage(q) }],
    },
  }));

  console.log(`  📤 Submitting batch of ${requests.length} requests…`);

  let batch: Anthropic.Messages.Batches.MessageBatch | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      batch = await anthropic.messages.batches.create({ requests });
      break;
    } catch (err: any) {
      const retriable = err?.status >= 500 || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT';
      if (!retriable || attempt === 5) throw err;
      const wait = attempt * 30_000;
      console.log(`\n  ⚠️  Attempt ${attempt} failed (${err?.status ?? err?.code}), retrying in ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
  if (!batch) throw new Error('Batch creation failed after all retries');

  console.log(`  🆔 Batch ID: ${batch.id}`);
  await pollBatchUntilComplete(batch.id);

  // Collect results into array
  const results: { id: number; explanation: string }[] = [];
  let failed = 0;

  for await (const result of await anthropic.messages.batches.results(batch.id)) {
    if (result.result.type === 'succeeded') {
      const text = (result.result.message.content[0] as Anthropic.TextBlock).text.trim();
      results.push({ id: parseInt(result.custom_id, 10), explanation: text });
    } else {
      failed++;
      const errType =
        result.result.type === 'errored' ? result.result.error?.type : result.result.type;
      console.error(`\n  ✗ Q#${result.custom_id} failed: ${errType}`);
    }
  }

  // Merge with existing JSON file if it exists (safe to re-run)
  const outFile = path.join(EXPLANATIONS_DIR, `${subject}.json`);
  let existing: { id: number; explanation: string }[] = [];
  if (fs.existsSync(outFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
    } catch {
      existing = [];
    }
  }

  // Deduplicate by id — new results win
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const r of results) byId.set(r.id, r);
  fs.writeFileSync(outFile, JSON.stringify([...byId.values()], null, 2), 'utf-8');

  console.log(`  💾 Saved ${results.length} records → ${outFile}`);
  return { done: results.length, failed };
}

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, exam_type, subject, year, question_text,
              option_a, option_b, option_c, option_d, option_e, correct_option
       FROM questions
       WHERE (explanation IS NULL OR explanation = '')
         AND subject = ANY($1)
       ORDER BY subject, id`,
      [TARGET_SUBJECTS],
    );

    if (rows.length === 0) {
      console.log('✅ No missing explanations found for target subjects.');
      return;
    }

    const eligible = rows.filter((q) => !IMAGE_KEYWORDS.test(q.question_text));
    const skipped = rows.length - eligible.length;

    console.log(`\n📊 Found ${rows.length} questions missing explanations`);
    if (skipped > 0) console.log(`  ⏭  Skipping ${skipped} image-dependent questions`);
    console.log(`  ✏️  Will generate explanations for ${eligible.length} questions\n`);

    if (eligible.length === 0) {
      console.log('✅ Nothing to do.');
      return;
    }

    // Group by subject
    const bySubject = new Map<string, any[]>();
    for (const q of eligible) {
      if (!bySubject.has(q.subject)) bySubject.set(q.subject, []);
      bySubject.get(q.subject)!.push(q);
    }

    let totalDone = 0;
    let totalFailed = 0;

    for (const [subject, questions] of bySubject) {
      console.log(`\n📚 Subject: ${subject} (${questions.length} questions)`);

      const totalBatches = Math.ceil(questions.length / MAX_PER_BATCH);
      for (let b = 0; b < totalBatches; b++) {
        const chunk = questions.slice(b * MAX_PER_BATCH, (b + 1) * MAX_PER_BATCH);
        console.log(`\n🔄 Batch ${b + 1} of ${totalBatches} (${chunk.length} questions)`);

        const { done, failed } = await processBatch(chunk, subject);
        totalDone += done;
        totalFailed += failed;

        console.log(`  ✅ Batch ${b + 1} done: ${done} saved, ${failed} failed`);
      }
    }

    console.log(
      `\n🎉 All done! ${totalDone} explanations saved to explanations/, ${totalFailed} failed.\n`,
    );
    console.log('Next step: npm run import-explanations\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
