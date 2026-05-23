// src/index.ts — ExamAce Bot Entry Point
import dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';
import * as db from './db';
import * as redis from './services/redis';
import * as fmt from './bot/formatter';

import * as onboarding from './bot/handlers/onboarding';
import * as practice from './bot/handlers/practice';
import * as quiz from './bot/handlers/quiz';
import * as stats from './bot/handlers/stats';

import createServer from './api/server';
import startCrons from './services/cron';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// ── Middleware: log + burst protection ─────────────────────────────────────────
bot.use(async (ctx, next) => {
  const id = ctx.from?.id;
  if (id) {
    const isBurst = await redis.checkBurst(id).catch(() => false);
    if (isBurst) return; // silently drop burst messages
  }
  return next();
});

// ── Commands ───────────────────────────────────────────────────────────────────
bot.start(onboarding.handleStart);
bot.command('help', ctx => ctx.replyWithMarkdown(fmt.helpMessage()));
bot.command('settings', onboarding.handleSettings);
bot.command('stats', stats.handleStats);
bot.command('subscribe', stats.handleSubscribe);
bot.command('practice', practice.handlePractice);
bot.command('quiz', quiz.handleQuiz);
bot.command('drill', (ctx) => practice.handleDrill(ctx));
bot.command('stop', async (ctx) => {
  const session = await redis.getSession(ctx.from.id);
  if (!session) { await ctx.reply('No active session.'); return; }
  if (session.mode === 'quiz') {
    const quizState = await redis.getQuizState(ctx.from.id);
    if (quizState) await quiz.endQuiz(ctx, quizState, 'stopped');
  } else {
    await practice.handleStop(ctx);
  }
});

// ── Callback query router ──────────────────────────────────────────────────────
bot.on('callback_query', async (ctx: any) => {
  const data = ctx.callbackQuery.data;
  if (!data) return;

  // Onboarding
  if (data.startsWith('onboard:exam:'))       return onboarding.handleExamType(ctx);
  if (data.startsWith('onboard:subject:'))    return onboarding.handleSubjectToggle(ctx);
  if (data === 'onboard:subjects:done')       return onboarding.handleSubjectsDone(ctx);

  // Settings
  if (data === 'settings:exam')               return onboarding.handleSettingsExam(ctx);
  if (data === 'settings:subjects')           return onboarding.handleSettingsSubjects(ctx);
  if (data === 'settings:notifications')      return onboarding.handleSettingsNotifications(ctx);

  // Practice
  if (data === 'practice:pick')               return practice.handlePractice(ctx);
  if (data.startsWith('practice:year:'))      return practice.handleYearPick(ctx);
  if (data.startsWith('practice:start:')) {
    const parts = data.split(':');
    const subject = parts[2];
    const yearStr = parts[3];
    const year = yearStr && yearStr !== 'any' ? parseInt(yearStr, 10) : null;
    const user = await db.getUser(ctx.from.id);
    await ctx.answerCbQuery();
    return practice.startPractice(ctx, user, subject, year);
  }
  if (data === 'practice:next')               return practice.handleNext(ctx);
  if (data === 'practice:stop')               return practice.handleStop(ctx);
  if (data === 'practice:change_subject')     return practice.handleChangeSubject(ctx);
  if (data === 'practice:add_subject')        return onboarding.handleSettingsSubjects(ctx);
  if (data === 'practice:change_exam')        return onboarding.handleSettingsExam(ctx);

  // Answer (shared by practice + quiz)
  if (data.startsWith('answer:')) {
    const session = await redis.getSession(ctx.from.id);
    if (session?.mode === 'quiz') return quiz.handleQuizAnswer(ctx);
    return practice.handleAnswer(ctx);
  }

  // Quiz
  if (data === 'quiz:pick')                   return quiz.handleQuiz(ctx);
  if (data.startsWith('quiz:start:')) {
    const subject = data.split(':')[2];
    const user = await db.getUser(ctx.from.id);
    await ctx.answerCbQuery();
    return quiz.startQuiz(ctx, user, subject);
  }
  if (data === 'quiz:next')                   return quiz.handleQuizNext(ctx);

  // Drill
  if (data.startsWith('drill:auto:'))         return practice.handleAutoDrill(ctx);
  if (data.startsWith('drill:topic:'))        return practice.handleDrillTopic(ctx);

  // Stats
  if (data === 'stats:show')                  return stats.handleStats(ctx);

  // Subscribe
  if (data === 'menu:subscribe')              return stats.handleSubscribe(ctx);
  if (data.startsWith('subscribe:'))          return stats.handleSubscribePlan(ctx);

  // Flag
  if (data === 'flag:question')               return stats.handleFlagQuestion(ctx);

  // Main menu
  if (data === 'menu:main') {
    await ctx.answerCbQuery();
    const user = await db.getUser(ctx.from.id);
    if (!user) return;
    await ctx.replyWithMarkdown(
      `🏠 *Main Menu*\n\nWhat would you like to do, ${user.first_name}?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📚 Practice', callback_data: 'practice:pick' },
             { text: '📋 Quiz', callback_data: 'quiz:pick' }],
            [{ text: '📊 Stats', callback_data: 'stats:show' },
             { text: '💎 Subscribe', callback_data: 'menu:subscribe' }],
          ],
        },
      }
    );
    return;
  }

  // Fallback
  await ctx.answerCbQuery('Something went wrong. Please try again.', { show_alert: false });
});

// ── Error handler ──────────────────────────────────────────────────────────────
bot.catch((err: any, ctx: any) => {
  console.error(`[Bot Error] Update ${ctx.update.update_id}:`, err.message);
  ctx.reply('Something went wrong on our end. Please try again in a moment.').catch(() => {});
});

// ── Launch ─────────────────────────────────────────────────────────────────────
async function launchBot(attempt = 1): Promise<void> {
  const APP_URL = process.env.APP_URL;
  try {
    if (APP_URL && process.env.NODE_ENV === 'production') {
      const PORT = process.env.PORT || 3000;
      await bot.launch({
        webhook: { domain: APP_URL, port: Number(PORT), path: '/bot' },
      });
      console.log(`🤖 ExamAce Bot launched via webhook at ${APP_URL}/bot`);
    } else {
      await bot.launch();
      console.log('🤖 ExamAce Bot launched via long polling (dev mode)');
    }
    console.log(`
  ╔═══════════════════════════════════════╗
  ║         ExamAce Bot is live! 🎓       ║
  ║   WAEC & JAMB Prep — Nigeria          ║
  ╚═══════════════════════════════════════╝
    `);
  } catch (err: any) {
    const delay = Math.min(attempt * 15, 120); // 15s, 30s, 45s … cap at 120s
    console.error(`Failed to connect to Telegram (attempt ${attempt}): ${err.message}`);
    console.error(`Retrying in ${delay}s… (API server remains running)`);
    setTimeout(() => launchBot(attempt + 1), delay * 1000);
  }
}

async function launch() {
  const PORT = process.env.PORT || 3000;

  // Start Express API — runs independently of bot connectivity
  const app = createServer(bot);
  app.listen(PORT, () => console.log(`🌐 API server listening on port ${PORT}`));

  // Start cron jobs
  startCrons(bot);

  // Launch bot (retries automatically on network failure)
  launchBot();
}

// Graceful shutdown
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

launch().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
