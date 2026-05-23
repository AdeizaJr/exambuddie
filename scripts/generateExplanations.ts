// scripts/generateExplanations.ts
// Fills explanation gaps for questions where none was scraped from the source.
// Run after import.ts. Safe to re-run — skips questions that already have an explanation.
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 8;
const DELAY_MS = 1200;

// Cached system prompt — counts toward Anthropic's prompt-cache savings across the batch run
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
  const lines = [
    `A. ${q.option_a}`,
    `B. ${q.option_b}`,
    `C. ${q.option_c}`,
    `D. ${q.option_d}`,
  ];
  if (q.option_e) lines.push(`E. ${q.option_e}`);
  return lines.join('\n');
}

async function generateExplanation(q: any): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 350,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Subject: ${q.exam_type} ${q.subject} ${q.year}\n\nQuestion: ${q.question_text}\n\nOptions:\n${buildOptions(q)}\n\nCorrect answer: ${q.correct_option}\n\nExplain why ${q.correct_option} is correct and why the others are wrong.`,
      },
    ],
  });

  return (response.content[0] as Anthropic.TextBlock).text.trim();
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// Questions that reference a diagram/image can't be explained without the visual — skip them
const IMAGE_KEYWORDS = /\b(diagram|figure|fig\s*\d|table below|table above|graph above|graph below|chart above|chart below|image above|picture above|refer to the)\b/i;

function isImageDependent(questionText: string): boolean {
  return IMAGE_KEYWORDS.test(questionText);
}

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, exam_type, subject, year, question_text,
              option_a, option_b, option_c, option_d, option_e, correct_option
       FROM questions
       WHERE (explanation IS NULL OR explanation = '' OR explanation = 'Explanation')
       ORDER BY id`
    );

    if (rows.length === 0) {
      console.log('✅ All questions already have explanations.');
      return;
    }

    const eligible = rows.filter(q => !isImageDependent(q.question_text));
    const skipped = rows.length - eligible.length;

    if (skipped > 0) console.log(`  ⏭  Skipped ${skipped} image-dependent questions`);
    if (eligible.length === 0) {
      console.log('✅ No eligible questions to explain.');
      return;
    }

    console.log(`\n📝 Generating explanations for ${eligible.length} questions...\n`);
    const rows2 = eligible;
    let done = 0, failed = 0;

    for (let i = 0; i < rows2.length; i += BATCH_SIZE) {
      const batch = rows2.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (q) => {
          try {
            const explanation = await generateExplanation(q);
            await client.query(
              `UPDATE questions SET explanation = $1 WHERE id = $2`,
              [explanation, q.id]
            );
            done++;
            process.stdout.write(`\r  ✓ ${done}/${rows2.length} done, ${failed} failed`);
          } catch (err: any) {
            failed++;
            console.error(`\n  ✗ Q#${q.id} failed: ${err.message}`);
          }
        })
      );
      if (i + BATCH_SIZE < rows2.length) await sleep(DELAY_MS);
    }

    console.log(`\n\n✅ Done: ${done} explanations generated, ${failed} failed.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
