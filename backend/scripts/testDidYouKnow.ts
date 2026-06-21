// scripts/testDidYouKnow.ts
// Sends a Did You Know fact immediately to a Telegram user for testing.
//
// Usage:
//   npx ts-node scripts/testDidYouKnow.ts --telegram-id YOUR_TELEGRAM_ID
//   npx ts-node scripts/testDidYouKnow.ts --telegram-id 123456 --subject biology

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { Telegraf } from 'telegraf';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

async function main() {
  const args = process.argv.slice(2);
  const telegramId = args.find((_, i) => args[i - 1] === '--telegram-id');
  const subjectArg = args.find((_, i) => args[i - 1] === '--subject');

  if (!telegramId) {
    console.error('Usage: npx ts-node scripts/testDidYouKnow.ts --telegram-id YOUR_ID');
    process.exit(1);
  }

  // Get user's subjects from DB, or use --subject arg
  let subjects: string[] = [];
  if (subjectArg) {
    subjects = [subjectArg];
  } else {
    const { rows } = await pool.query(
      'SELECT subjects FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    subjects = rows[0]?.subjects || [];
  }

  console.log(`\n👤 Telegram ID: ${telegramId}`);
  console.log(`📚 Subjects: ${subjects.join(', ') || 'none — will use fallback'}\n`);

  // Pick a fact
  let fact: any = null;
  if (subjects.length > 0) {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (subject_code)
         id, external_id, subject, subject_code, topic, fact_text, difficulty
       FROM did_you_know
       WHERE subject_code = ANY($1)
       ORDER BY subject_code, last_used_at NULLS FIRST, sent_count ASC, RANDOM()`,
      [subjects]
    );
    // Pick one from user's subjects (today's rotation)
    const dayIndex = Math.floor(Date.now() / 86400000);
    const todaySubject = subjects[dayIndex % subjects.length];
    fact = rows.find((r: any) => r.subject_code === todaySubject) || rows[0];
  }

  if (!fact) {
    const { rows } = await pool.query(
      `SELECT id, external_id, subject, subject_code, topic, fact_text, difficulty
       FROM did_you_know ORDER BY last_used_at NULLS FIRST, RANDOM() LIMIT 1`
    );
    fact = rows[0];
  }

  if (!fact) {
    console.error('No facts in DB. Run importDidYouKnow.ts first.');
    await pool.end();
    process.exit(1);
  }

  const topicLabel = fact.topic ? ` · ${fact.topic}` : '';
  const msg = `💡 <b>Did You Know?</b>\n\n${fact.fact_text}\n\n<i>📚 ${fact.subject}${topicLabel}</i>`;

  console.log('📨 Message preview:');
  console.log('─'.repeat(50));
  console.log(msg.replace(/<[^>]+>/g, ''));
  console.log('─'.repeat(50));

  try {
    await bot.telegram.sendMessage(telegramId, msg, { parse_mode: 'HTML' });
    console.log(`\n✅ Sent to Telegram ID ${telegramId}`);
  } catch (e: any) {
    console.error(`\n❌ Failed to send: ${e.message}`);
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
