// src/index.ts — ExamBuddie Bot Entry Point
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
import * as leaderboard from './bot/handlers/leaderboard';
import * as challenge from './bot/handlers/challenge';
import * as invite from './bot/handlers/invite';
import * as support from './bot/handlers/support';

import createServer from './api/server';
import startCrons from './services/cron';
import { hashPassword } from './services/auth';

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
bot.start(async (ctx: any) => {
  const payload = ctx.startPayload as string | undefined;
  if (payload?.startsWith('room_')) {
    const code = payload.slice(5);
    return challenge.handleChallengeJoin(ctx, code);
  }
  if (payload?.startsWith('ref_')) {
    const refCode = payload.slice(4);
    const referrer = await db.getUserByReferralCode(refCode);
    const newUser = await db.upsertUser(ctx);
    if (referrer && referrer.id !== newUser.id) {
      await db.setReferredBy(newUser.id, referrer.id);
    }
    return onboarding.handleStart(ctx);
  }
  if (payload?.startsWith('subscribe_')) {
    const plan = payload.slice('subscribe_'.length); // 'monthly' | 'term' | 'yearly'
    return stats.handleSubscribeDeepLink(ctx, plan);
  }
  if (payload === 'from_landing') {
    const user = await db.upsertUser(ctx);
    if (!user.source) await db.updateUser(ctx.from.id, { source: 'landing' } as any);
    return onboarding.handleStart(ctx);
  }
  return onboarding.handleStart(ctx);
});
bot.command('help', (ctx) => ctx.reply(fmt.helpMessage(), { parse_mode: 'HTML' }));
bot.command('settings', onboarding.handleSettings);
bot.command('stats', stats.handleStats);
bot.command('subscribe', stats.handleSubscribe);
bot.command('practice', practice.handlePractice);
bot.command('quiz', quiz.handleQuiz);
bot.command('drill', (ctx) => practice.handleDrill(ctx));
bot.command('leaderboard', leaderboard.handleLeaderboard);
bot.command('challenge', challenge.handleChallenge);
bot.command('invite', invite.handleInvite);
bot.command('support', support.handleSupport);
bot.command('progress', stats.handleProgress);
bot.command('app', async (ctx) => {
  const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  await ctx.reply('Open the ExamBuddie app 🎓', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📱 Open ExamBuddie App',
            web_app: { url: `${APP_URL}/app` },
          },
        ],
      ],
    },
  });
});
bot.command('stop', async (ctx) => {
  const session = await redis.getSession(ctx.from.id);
  if (!session) {
    await ctx.reply('No active session.');
    return;
  }
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
  if (data === 'onboard:consent:agree') return onboarding.handleOnboardConsent(ctx);
  if (data.startsWith('onboard:year:')) return onboarding.handleOnboardYear(ctx);
  if (data.startsWith('onboard:exam:')) return onboarding.handleExamType(ctx);
  if (data.startsWith('onboard:subject:')) return onboarding.handleSubjectToggle(ctx);
  if (data === 'onboard:subjects:done') return onboarding.handleSubjectsDone(ctx);

  // Settings
  if (data === 'settings:exam') return onboarding.handleSettingsExam(ctx);
  if (data === 'settings:subjects') return onboarding.handleSettingsSubjects(ctx);
  if (data === 'settings:year') return onboarding.handleSettingsYear(ctx);
  if (data.startsWith('settings:year:')) return onboarding.handleSettingsYearPick(ctx);
  if (data === 'settings:phone') return onboarding.handleSettingsPhone(ctx);
  if (data === 'settings:notifications') return onboarding.handleSettingsNotifications(ctx);
  if (data === 'settings:delete') return onboarding.handleSettingsDelete(ctx);
  if (data === 'settings:delete:confirm') return onboarding.handleSettingsDeleteConfirm(ctx);
  if (data === 'settings:back') return onboarding.handleSettingsBack(ctx);
  if (data === 'settings:weekly_report') return stats.handleWeeklyReport(ctx);
  if (data === 'settings:freeze_streak') return onboarding.handleStreakFreeze(ctx);
  if (data === 'settings:reminder') return onboarding.handleSettingsReminder(ctx);
  if (data.startsWith('settings:reminder:')) return onboarding.handleReminderSet(ctx);

  // Challenge
  if (data === 'challenge:pick') return challenge.handleChallenge(ctx);
  if (data === 'challenge:create') return challenge.handleChallengeCreate(ctx);
  if (data === 'challenge:search') return challenge.handleChallengeSearch(ctx);
  if (data.startsWith('challenge:subject:')) return challenge.handleChallengeSubject(ctx);
  if (data.startsWith('challenge:examtype:')) return challenge.handleChallengeExamType(ctx);
  if (data.startsWith('challenge:year:')) return challenge.handleChallengeYear(ctx);
  if (data.startsWith('challenge:count:')) return challenge.handleChallengeCount(ctx);
  if (data.startsWith('challenge:timer:')) return challenge.handleChallengeTimer(ctx);
  if (data.startsWith('challenge:expected:')) return challenge.handleChallengeExpected(ctx);
  if (data.startsWith('challenge:copylink:')) return challenge.handleChallengeCopyLink(ctx);
  if (data.startsWith('challenge:start_now:')) return challenge.handleChallengeStartNow(ctx);
  if (data.startsWith('challenge:ready:')) return challenge.handleChallengeReady(ctx);
  if (data.startsWith('challenge:leave:')) return challenge.handleChallengeLeave(ctx);
  if (data === 'challenge:next') return challenge.handleChallengeNext(ctx);
  if (data === 'challenge:finish') return challenge.handleChallengeFinish(ctx);

  // Practice
  if (data === 'practice:pick') return practice.handlePractice(ctx);
  if (data.startsWith('practice:multisubject:toggle:'))
    return practice.handleMultiSubjectToggle(ctx);
  if (data === 'practice:multisubject:start') return practice.handleMultiSubjectStart(ctx);
  if (data.startsWith('practice:subject:')) return practice.handleSubjectPick(ctx);
  if (data.startsWith('practice:flow_year:')) return practice.handlePracticeFlowYear(ctx);
  if (data.startsWith('practice:year:')) return practice.handleYearPick(ctx);
  if (data.startsWith('practice:start:')) {
    const parts = data.split(':');
    const subject = parts[2];
    const yearStr = parts[3];
    const year = yearStr && yearStr !== 'any' ? parseInt(yearStr, 10) : null;
    const user = await db.getUser(ctx.from.id);
    await ctx.answerCbQuery();
    return practice.startPractice(ctx, user, subject, year);
  }
  if (data.startsWith('practice:avail:')) return practice.handlePracticeAvail(ctx);
  if (data.startsWith('practice:examtype:')) return practice.handlePracticeExamTypePick(ctx);
  if (data.startsWith('practice:topic:')) return practice.handlePracticeTopicPick(ctx);
  if (data.startsWith('practice:timer:')) return practice.handlePracticeTimerPick(ctx);
  if (data === 'practice:next') return practice.handleNext(ctx);
  if (data === 'practice:stop') return practice.handleStop(ctx);
  if (data === 'practice:change_subject') return practice.handleChangeSubject(ctx);
  if (data === 'practice:add_subject') return onboarding.handleSettingsSubjects(ctx);
  if (data === 'practice:change_exam') return onboarding.handleSettingsExam(ctx);

  // Answer (shared by practice + quiz + challenge)
  if (data.startsWith('answer:')) {
    const session = await redis.getSession(ctx.from.id);
    if (session?.mode === 'challenge') return challenge.handleChallengeAnswer(ctx);
    if (session?.mode === 'quiz') return quiz.handleQuizAnswer(ctx);
    return practice.handleAnswer(ctx);
  }

  // Quiz
  if (data === 'quiz:pick') return quiz.handleQuiz(ctx);
  if (data.startsWith('quiz:subject:')) return quiz.handleQuizSubjectPick(ctx);
  if (data.startsWith('quiz:flow_year:')) return quiz.handleQuizFlowYear(ctx);
  if (data.startsWith('quiz:start:')) {
    const subject = data.split(':')[2];
    const user = await db.getUser(ctx.from.id);
    await ctx.answerCbQuery();
    return quiz.startQuiz(ctx, user, subject);
  }
  if (data.startsWith('quiz:avail:')) return quiz.handleQuizAvail(ctx);
  if (data.startsWith('quiz:examtype:')) return quiz.handleQuizExamTypePick(ctx);
  if (data.startsWith('quiz:timer:')) return quiz.handleQuizTimerPick(ctx);
  if (data === 'quiz:next') return quiz.handleQuizNext(ctx);
  if (data === 'quiz:history') return stats.handleQuizHistory(ctx);
  if (data === 'quiz:stop') return quiz.handleQuizStop(ctx);
  if (data === 'quiz:stop:confirm') return quiz.handleQuizStopConfirm(ctx);
  if (data === 'quiz:stop:cancel') return quiz.handleQuizStopCancel(ctx);

  // Drill
  if (data.startsWith('drill:auto:')) return practice.handleAutoDrill(ctx);
  if (data.startsWith('drill:topic:')) return practice.handleDrillTopic(ctx);

  // Stats
  if (data === 'stats:show') return stats.handleStats(ctx);
  if (data === 'stats:progress') return stats.handleProgress(ctx);
  if (data === 'stats:share') return stats.handleShareProgress(ctx);
  if (data.startsWith('stats:filter:')) return stats.handleStatsFilter(ctx);

  // Subscribe
  if (data === 'menu:subscribe') return stats.handleSubscribe(ctx);
  if (data.startsWith('subscribe:')) return stats.handleSubscribePlan(ctx);

  // Invite
  if (data === 'invite:link') return invite.handleInvite(ctx);
  if (data === 'invite:leaderboard') return invite.handleReferralLeaderboard(ctx);
  if (data.startsWith('invite:copy:')) {
    const link = data.slice('invite:copy:'.length);
    await ctx.answerCbQuery(link, { show_alert: true });
    return;
  }

  // Support
  if (data === 'support:menu') return support.handleSupport(ctx);
  if (data === 'support:bug') return support.handleSupportBug(ctx);
  if (data === 'support:data') return support.handleSupportData(ctx);
  if (data === 'support:delete') return onboarding.handleSettingsDelete(ctx);
  if (data === 'support:other') return support.handleSupportOther(ctx);

  // Flag
  if (data === 'flag:question') return stats.handleFlagQuestion(ctx);
  if (data === 'flag:underline') return stats.handleFlagUnderline(ctx);
  if (data.startsWith('flag:reason:')) return stats.handleFlagReason(ctx, data.slice('flag:reason:'.length));
  if (data === 'flag:cancel') return stats.handleFlagCancel(ctx);

  // Main menu
  if (data === 'menu:main') {
    await ctx.answerCbQuery();
    const user = await db.getUser(ctx.from.id);
    if (!user) return;
    await ctx.reply(`🏠 <b>Main Menu</b>\n\nWhat would you like to do, ${user.first_name}?`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📚 Practice', callback_data: 'practice:pick' },
            { text: '📋 Quiz', callback_data: 'quiz:pick' },
          ],
          [
            { text: '📊 Stats', callback_data: 'stats:show' },
            ...(user.plan === 'premium' ? [] : [{ text: '💎 Subscribe', callback_data: 'menu:subscribe' }]),
          ],
        ],
      },
    });
    return;
  }

  // Session resume
  if (data === 'session:resume') {
    await ctx.answerCbQuery();
    const session = await redis.getSession(ctx.from.id);
    const q = session?.currentQuestion;
    if (!q) {
      await ctx.reply('No active session found. Tap /start to begin again.');
      return;
    }
    const qNum = session.qNum || 1;
    const total = session.total || '?';
    const mode = session.mode || 'practice';
    const imageUrl = q.image_url?.startsWith('/')
      ? `${process.env.APP_URL || ''}${q.image_url}`
      : q.image_url;
    const text = fmt.formatQuestion(q, qNum, total, mode) + fmt.answerOptions(q);
    const keyboard = fmt.answerKeyboard(!!q.option_e);
    try {
      if (imageUrl) {
        await ctx.replyWithPhoto(imageUrl, { caption: text, parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return;
  }

  // Fallback
  await ctx.answerCbQuery('Something went wrong. Please try again.', { show_alert: false });
});

// ── Contact handler (phone number shared during onboarding) ───────────────────
bot.on('message', async (ctx: any, next: any) => {
  if (ctx.message?.contact) return onboarding.handleContact(ctx);
  return next();
});

// ── Free-text handler — keeps conversation alive ───────────────────────────────
bot.on('text', async (ctx: any) => {
  const text: string = ctx.message?.text?.trim() || '';
  const user = await db.getUser(ctx.from.id);

  if (!user?.exam_type) return onboarding.handleStart(ctx);

  // Stats, Settings, and Leaderboard always work, even mid-session
  if (text === '📊 My Stats') return stats.handleStats(ctx);
  if (text === '⚙️ Settings') return onboarding.handleSettings(ctx);
  if (text === '🏆 Leaderboard') return leaderboard.handleLeaderboard(ctx);
  if (text === '🎯 Challenge') return challenge.handleChallenge(ctx);

  const session = await redis.getSession(ctx.from.id);

  // Challenge room code input
  if (session?.step === 'challenge_enter_code') return challenge.handleChallengeCodeInput(ctx);

  // Support bug report awaiting user text
  const supportStep = await redis.getSupportStep(ctx.from.id);
  if (supportStep === 'bug') return support.handleBugReport(ctx, bot);

  // Phone nudge skip
  if (text === 'Skip for now →' && (await redis.getPhonePending(ctx.from.id))) {
    return onboarding.handlePhoneSkip(ctx);
  }
  const activeSession =
    session?.mode === 'practice' || session?.mode === 'quiz' || session?.mode === 'drill';

  if (activeSession && (text === '📚 Practice' || text === '📋 CBT')) {
    await ctx.reply(
      `You have an active ${session.mode} session running.\n\nEnd it first to start a new one.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏹ Stop Session', callback_data: 'practice:stop' }],
          ],
        },
      }
    );
    return;
  }

  if (activeSession) return; // mid-session free text — ignore

  if (text === '📚 Practice') return practice.handlePractice(ctx);
  if (text === '📋 CBT') return quiz.handleQuiz(ctx);

  await ctx.reply(`${fmt.timeGreeting()}, ${user.first_name}! What would you like to do?`, {
    parse_mode: 'HTML',
    reply_markup: fmt.persistentMenuKeyboard(),
  });
});

// ── Error handler ──────────────────────────────────────────────────────────────
bot.catch(async (err: any, ctx: any) => {
  const msg: string = err.message || '';
  // Stale callback queries and transient network blips are not actionable
  if (msg.includes('query is too old') || msg.includes('query ID is invalid')) return;
  if (msg.includes('request to') && msg.includes('failed, reason:')) return;
  // User blocked the bot or deleted their account — nothing to recover
  if (msg.includes('bot was blocked') || msg.includes('user is deactivated') || msg.includes('chat not found')) return;
  // Stale message edits — harmless, user deleted or already modified the message
  if (msg.includes('message to edit not found') || msg.includes('message is not modified')) return;
  // Invalid emoji in replyWithDice — guard against future invalid calls
  if (msg.includes('EMOTICON_INVALID')) return;
  // Message too long — content issue, not a crash worth alarming the user over
  if (msg.includes('message is too long')) return;
  console.error(
    `[Bot Error] update=${ctx.update.update_id} user=${ctx.from?.id ?? 'unknown'}:`,
    err.stack || msg
  );

  try {
    const session = ctx.from?.id ? await redis.getSession(ctx.from.id) : null;
    const mode = session?.mode;
    const hasQuestion = !!session?.currentQuestion;

    if (mode === 'challenge') {
      await ctx.reply(
        '⚠️ <b>We hit a snag!</b>\n\nYour challenge session had an error. Use the room code to rejoin, or tap below to go home.',
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
        }
      );
    } else if ((mode === 'practice' || mode === 'quiz' || mode === 'drill') && hasQuestion) {
      await ctx.reply(
        '⚠️ <b>We hit a snag!</b>\n\nYour session is still active. Tap below to resume where you left off.',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '▶️ Resume Session', callback_data: 'session:resume' }],
              [{ text: '⏹ End Session', callback_data: 'practice:stop' }],
            ],
          },
        }
      );
    } else {
      await ctx.reply('⚠️ Oops! We hit a snag. Tap /start to get back on track.');
    }
  } catch {
    ctx.reply('⚠️ Oops! We hit a snag. Tap /start to get back on track.').catch(() => {});
  }
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
      console.log(`🤖 ExamBuddie Bot launched via webhook at ${APP_URL}/bot`);
    } else {
      await bot.launch();
      console.log('🤖 ExamBuddie Bot launched via long polling (dev mode)');
    }
    console.log(`
  ╔═══════════════════════════════════════╗
  ║         ExamBuddie Bot is live! 🎓       ║
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

async function seedAdminUser() {
  const { rows } = await db.query('SELECT COUNT(*) as count FROM admin_users');
  if (parseInt(rows[0].count) > 0) return;

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;

  const hash = await hashPassword(password);
  await db.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', [
    username,
    hash,
  ]);
  console.log(`[Admin] Seeded admin user: ${username}`);
}

async function launch() {
  const PORT = process.env.PORT || 3000;
  const APP_URL = process.env.APP_URL;

  await seedAdminUser();
  const app = createServer(bot);

  if (APP_URL && process.env.NODE_ENV === 'production') {
    const webhookHandler = await bot.createWebhook({ domain: APP_URL, path: '/bot' });
    app.use(webhookHandler);
    console.log(`🤖 ExamBuddie Bot launched via webhook at ${APP_URL}/bot`);
    console.log(`
  ╔═══════════════════════════════════════╗
  ║         ExamBuddie Bot is live! 🎓       ║
  ║   WAEC & JAMB Prep — Nigeria          ║
  ╚═══════════════════════════════════════╝
    `);
  }

  app.listen(PORT, () => console.log(`🌐 API server listening on port ${PORT}`));

  startCrons(bot);

  if (!(APP_URL && process.env.NODE_ENV === 'production')) {
    launchBot();
  }
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

launch().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
