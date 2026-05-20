// scripts/generateExplanations.ts
// Batch-generates explanations for questions that don't have one yet.
// Run once before launch; safe to re-run (skips reviewed questions).
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 10;
const DELAY_MS = 1000; // be kind to rate limits

async function generateExplanation(q: any): Promise<string> {
  const prompt = `You are an expert Nigerian secondary school teacher helping students prepare for ${q.exam_type} exams.

Explain why the answer to this ${q.subject} question is correct, and why the other options are wrong.
Be clear, educational, and concise (3–5 sentences max). Use step-by-step reasoning where needed.
Write as if explaining to a 17-year-old Nigerian student.

Question: ${q.question_text}

Options:
A. ${q.option_a}
B. ${q.option_b}
C. ${q.option_c}
D. ${q.option_d}

Correct answer: ${q.correct_option}

Provide a clear explanation:`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });
  return (response.content[0] as any).text.trim();
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, exam_type, subject, question_text,
              option_a, option_b, option_c, option_d, correct_option
       FROM questions
       WHERE explanation IS NULL OR explanation = ''
       ORDER BY id`
    );

    if (rows.length === 0) {
      console.log('✅ All questions already have explanations.');
      return;
    }

    console.log(`📝 Generating explanations for ${rows.length} questions...\n`);
    let done = 0, failed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (q) => {
          try {
            const explanation = await generateExplanation(q);
            await client.query(
              `UPDATE questions SET explanation = $1 WHERE id = $2`,
              [explanation, q.id]
            );
            done++;
            process.stdout.write(`\r  ✓ ${done}/${rows.length} done, ${failed} failed`);
          } catch (err: any) {
            failed++;
            console.error(`\n  ✗ Q#${q.id} failed: ${err.message}`);
          }
        })
      );
      if (i + BATCH_SIZE < rows.length) await sleep(DELAY_MS);
    }

    console.log(`\n\n✅ Done: ${done} explanations generated, ${failed} failed.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
