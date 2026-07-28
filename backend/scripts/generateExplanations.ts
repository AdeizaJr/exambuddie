// scripts/generateExplanations.ts
// Generates AI explanations for questions with placeholder text using the
// Anthropic Messages Batch API (50% cost vs. real-time calls).
//
// Usage:
//   npm run generate-explanations
//
// Safe to re-run — only touches rows that still have the placeholder text.
// Handles any number of questions by splitting into batches of 10,000.

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// The exact placeholder text to replace (substring match)
const PLACEHOLDER_FRAGMENT = 'No official explanation is available for this question at this time';

const MAX_PER_BATCH = 5_000; // Stay well under payload size limits
const POLL_INTERVAL_MS = 30_000; // 30 s polling interval
const MAX_WAIT_MS = 4 * 60 * 60 * 1000; // 4 hours max wait per batch

const SYSTEM_PROMPT = `You are an expert Nigerian secondary school teacher with 20 years of experience preparing students for WAEC, NECO, and JAMB examinations.

When given a multiple-choice question, explain:
1. Why the correct answer is right (clearly, with the key fact or reasoning)
2. Briefly why each wrong option is incorrect (one line each)

Rules:
- Write for a 16–18 year old Nigerian student
- Be concise: 4–7 sentences total
- Use step-by-step reasoning for maths/sciences
- Never start with "The correct answer is" — that is already shown; jump straight into the explanation
- Refer to wrong options by letter only (e.g. "B is wrong because...") — never restate their full text, since the options are already shown to the student
- Plain text only, no markdown`;

// Questions that reference a diagram/image can't be explained without the visual — skip them
const IMAGE_KEYWORDS =
  /\b(diagram|figure|fig\s*\d|table below|table above|graph above|graph below|chart above|chart below|image above|picture above|refer to the)\b/i;

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
      console.log(); // newline after spinner
      return;
    }
  }
  throw new Error(`Batch ${batchId} did not complete within ${MAX_WAIT_MS / 60000} minutes`);
}

async function processBatch(questions: any[], client: any): Promise<{ done: number; failed: number }> {
  // Build batch requests using the SDK's BatchCreateParams.Request type
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

  // Retry up to 5 times on transient 5xx / network errors
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

  // Collect results and update DB
  let done = 0;
  let failed = 0;

  for await (const result of await anthropic.messages.batches.results(batch.id)) {
    if (result.result.type === 'succeeded') {
      const text = (result.result.message.content[0] as Anthropic.TextBlock).text.trim();
      const qId = parseInt(result.custom_id, 10);
      await client.query(`UPDATE questions SET explanation = $1 WHERE id = $2`, [text, qId]);
      done++;
      if (done % 500 === 0) {
        process.stdout.write(`\r  ✓ Updated ${done}/${questions.length} in this batch…`);
      }
    } else {
      failed++;
      const errType =
        result.result.type === 'errored' ? result.result.error?.type : result.result.type;
      console.error(`\n  ✗ Q#${result.custom_id} failed: ${errType}`);
    }
  }

  process.stdout.write('\n');
  return { done, failed };
}

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    // Language subjects — skip; their questions are not in English
    const SKIP_SUBJECTS = ['yoruba', 'french', 'hausa', 'igbo', 'arabic'];

    // Fetch all questions missing explanations (placeholder text, NULL, or empty string)
    const { rows } = await client.query(
      `SELECT id, exam_type, subject, year, question_text,
              option_a, option_b, option_c, option_d, option_e, correct_option
       FROM questions
       WHERE (explanation ILIKE $1 OR explanation IS NULL OR explanation = '')
         AND subject != ALL($2)
       ORDER BY id`,
      [`%${PLACEHOLDER_FRAGMENT}%`, SKIP_SUBJECTS],
    );

    if (rows.length === 0) {
      console.log('✅ No questions missing explanations found.');
      return;
    }

    // Skip image-dependent questions
    const eligible = rows.filter((q) => !IMAGE_KEYWORDS.test(q.question_text));
    const skipped = rows.length - eligible.length;

    console.log(`\n📊 Found ${rows.length} questions missing explanations`);
    if (skipped > 0) console.log(`  ⏭  Skipping ${skipped} image-dependent questions`);
    console.log(`  ✏️  Will generate explanations for ${eligible.length} questions\n`);

    if (eligible.length === 0) {
      console.log('✅ Nothing to do.');
      return;
    }

    // Split into chunks of MAX_PER_BATCH
    const totalBatches = Math.ceil(eligible.length / MAX_PER_BATCH);
    let totalDone = 0;
    let totalFailed = 0;

    for (let b = 0; b < totalBatches; b++) {
      const chunk = eligible.slice(b * MAX_PER_BATCH, (b + 1) * MAX_PER_BATCH);
      console.log(`\n🔄 Batch ${b + 1} of ${totalBatches} (${chunk.length} questions)`);

      const { done, failed } = await processBatch(chunk, client);
      totalDone += done;
      totalFailed += failed;

      console.log(`  ✅ Batch ${b + 1} done: ${done} updated, ${failed} failed`);
    }

    console.log(
      `\n🎉 All done! ${totalDone} explanations generated, ${totalFailed} failed out of ${eligible.length} eligible questions.\n`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
