// src/bot/handlers/stats.ts
import * as db from '../../db';
import * as fmt from '../formatter';
import { SUBJECT_MAP, SUBJECT_EMOJI, getRank } from '../formatter';
import * as payments from '../../services/payments';
import * as redis from '../../services/redis';
import { renderProgressCard } from '../../services/shareCard';

const BOT_USERNAME = process.env.BOT_USERNAME || 'ExamBuddieBot';

function isActivePremium(user: any): boolean {
  return user.plan === 'premium' && !!user.plan_expires_at && new Date(user.plan_expires_at) > new Date();
}

const ALREADY_PREMIUM_MSG =
  '✅ You already have an active Premium plan! Use /stats to track your progress.\n\nTo switch plans, first cancel your current one with /billing, then /subscribe again.';

export async function handleStats(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    '📊 <b>Which exam would you like to see stats for?</b>',
    { parse_mode: 'HTML', reply_markup: fmt.statsFilterKeyboard() }
  );
}

export async function handleStatsFilter(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const examType = ctx.callbackQuery.data.split(':')[2]; // 'WAEC' | 'NECO' | 'JAMB' | 'all'

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  const subjects = user.subjects && user.subjects.length > 0 ? user.subjects : [];
  const [stats, subjectStats, mistakePattern, ...perSubjectWeakTopics] = await Promise.all([
    db.getUserStats(user.id, examType),
    db.getSubjectStats(user.id, examType),
    db.getMistakePattern(user.id),
    ...subjects.map(s => db.getWeakTopics(user.id, s, examType)),
  ]);
  const weakTopics = (perSubjectWeakTopics as any[][])
    .flat()
    .sort((a: any, b: any) => a.accuracy - b.accuracy)
    .slice(0, 3);

  await ctx.reply(fmt.statsMessage(user, stats, weakTopics, examType, subjectStats, mistakePattern as string | null), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '📤 Share Progress', callback_data: 'stats:share' }]],
    },
  });
}

// Called from bot.start() when user arrives via landing page deep link
export async function handleSubscribeDeepLink(ctx: any, plan: string): Promise<void> {
  const user = await db.upsertUser(ctx);
  if (isActivePremium(user)) {
    await ctx.reply(ALREADY_PREMIUM_MSG, { parse_mode: 'HTML' });
    return;
  }
  if (!payments.getPlans()[plan]) {
    await handleSubscribe(ctx);
    return;
  }
  try {
    const { link, txRef } = await payments.createPaymentLink(user, plan);
    const planInfo = payments.getPlans()[plan];
    await ctx.reply(
      fmt.paymentLinkMessage(link, planInfo.label, txRef),
      { parse_mode: 'HTML', disable_web_page_preview: false }
    );
  } catch (err: any) {
    console.error('Payment link error:', err.response?.data?.message || err.message);
    await ctx.reply('Sorry, we could not generate a payment link right now. Please try again in a moment.');
  }
}

export async function handleSubscribe(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (user && isActivePremium(user)) {
    await ctx.reply(ALREADY_PREMIUM_MSG, { parse_mode: 'HTML' });
    return;
  }
  await ctx.reply(fmt.upgradeMessage(), {
    parse_mode: 'HTML',
    reply_markup: fmt.subscribeKeyboard(),
    disable_web_page_preview: true,
  });
}

export async function handleSubscribePlan(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const plan = ctx.callbackQuery.data.split(':')[1]; // 'monthly' | 'yearly'
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  if (isActivePremium(user)) {
    await ctx.reply(ALREADY_PREMIUM_MSG, { parse_mode: 'HTML' });
    return;
  }

  try {
    const { link, txRef } = await payments.createPaymentLink(user, plan);
    const planInfo = payments.getPlans()[plan];

    await ctx.reply(
      fmt.paymentLinkMessage(link, planInfo.label, txRef),
      { parse_mode: 'HTML', disable_web_page_preview: false }
    );
  } catch (err: any) {
    console.error('Payment link error:', err.response?.data?.message || err.message);
    await ctx.reply('Sorry, we could not generate a payment link right now. Please try again in a moment.');
  }
}

export async function handleBilling(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  const history = await db.getSubscriptionHistory(user.id);
  await ctx.reply(fmt.billingHistoryMessage(history), { parse_mode: 'HTML' });

  const sub = await payments.getActiveRecurringSubscription(user.id);
  if (!sub) {
    await ctx.reply(
      user.plan === 'premium'
        ? "You're on Premium, but not on auto-renewing billing — nothing to manage here. It'll expire on its own; use /subscribe to renew."
        : "You don't have an active subscription to manage. Use /subscribe to go Premium.",
      { parse_mode: 'HTML' }
    );
    return;
  }

  try {
    const link = await payments.getManageLink(sub.subscriptionCode);
    await ctx.reply(
      `💳 <b>Manage your ${sub.plan} subscription</b>\n\nUpdate your card or cancel auto-renewal here:\n${link}`,
      { parse_mode: 'HTML', disable_web_page_preview: true }
    );
  } catch (err: any) {
    console.error('Manage link error:', err.message);
    await ctx.reply('Sorry, could not generate your billing management link right now. Please try again shortly.');
  }
}

export async function handleQuizHistory(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  const history = await db.getQuizHistory(user.id);

  if (history.length === 0) {
    await ctx.reply(
      '📜 <b>Quiz History</b>\n\nNo quizzes completed yet. Take your first quiz!',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Take a Quiz', callback_data: 'quiz:pick' }],
            [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
          ],
        },
      }
    );
    return;
  }

  let text = '📜 <b>Quiz History</b> (last 10)\n\n';
  for (const s of history) {
    const accuracy =
      s.total_questions > 0 ? Math.round((s.correct_count / s.total_questions) * 100) : 0;
    const date = new Date(s.started_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const durationMs = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
    const durationMins = Math.round(durationMs / 60000);
    const subject = SUBJECT_MAP[s.subject] || s.subject;
    const grade =
      accuracy >= 80 ? '🏆' : accuracy >= 65 ? '🌟' : accuracy >= 50 ? '👍' : '💪';
    text += `${grade} <b>${subject}</b>\n   ${s.correct_count}/${s.total_questions} • ${accuracy}% • ${durationMins}m • ${date}\n\n`;
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Take Another Quiz', callback_data: 'quiz:pick' }],
        [{ text: '📊 My Stats', callback_data: 'stats:show' },
         { text: '🏠 Main Menu', callback_data: 'menu:main' }],
      ],
    },
  });
}

export async function handleFlagUnderline(ctx: any): Promise<void> {
  const s = await redis.getSession(ctx.from.id);
  const quizState = await redis.getQuizState(ctx.from.id);
  const q = s?.currentQuestion ?? quizState?.questions[quizState.qIndex] ?? null;

  if (!q || !q.question_text.includes('*')) {
    await ctx.answerCbQuery('Nothing to flag right now.', { show_alert: false });
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  await ctx.answerCbQuery('🔤 Underline flagged — we\'ll fix it!', { show_alert: true });

  await db.query(
    `INSERT INTO flagged_explanations (question_id, user_id, reason)
     VALUES ($1, $2, 'wrong_underline')`,
    [q.id, user.id]
  );
  await db.query(`UPDATE questions SET flag_count = flag_count + 1 WHERE id = $1`, [q.id]);
}

export async function handleFlagQuestion(ctx: any): Promise<void> {
  const s = await redis.getSession(ctx.from.id);
  const quizState = await redis.getQuizState(ctx.from.id);

  const q = s?.currentQuestion ?? quizState?.questions[quizState.qIndex] ?? null;

  if (!q) {
    await ctx.answerCbQuery('Nothing to flag right now.', { show_alert: false });
    return;
  }

  await ctx.answerCbQuery();
  await ctx.reply('🚩 What\'s wrong with this question?', {
    reply_markup: fmt.flagReasonKeyboard(),
  });
}

export async function handleFlagReason(ctx: any, reasonCode: string): Promise<void> {
  const s = await redis.getSession(ctx.from.id);
  const quizState = await redis.getQuizState(ctx.from.id);
  const q = s?.currentQuestion ?? quizState?.questions[quizState.qIndex] ?? null;

  if (!q) {
    await ctx.answerCbQuery('Nothing to flag right now.', { show_alert: false });
    return;
  }

  const reasonLabel = fmt.FLAG_REASONS[reasonCode];
  if (!reasonLabel) {
    await ctx.answerCbQuery('Unknown reason.', { show_alert: false });
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  await ctx.answerCbQuery('🚩 Flagged — we\'ll review it. Thanks!', { show_alert: true });

  await db.query(
    `INSERT INTO flagged_explanations (question_id, user_id, reason)
     VALUES ($1, $2, $3)`,
    [q.id, user.id, reasonLabel]
  );

  await db.query(`UPDATE questions SET flag_count = flag_count + 1 WHERE id = $1`, [q.id]);

  await ctx.editMessageText('✅ Thanks — flagged for review.').catch(() => {});
}

export async function handleFlagCancel(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Cancelled.').catch(() => {});
}

export async function handleProgress(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  const [progress, referralCount] = await Promise.all([
    db.getProgressStats(user.id),
    db.getConfirmedReferralCount(user.id),
  ]);

  // Study plan: days until exam → daily target
  let studyPlanLine = '';
  if (user.exam_type && user.target_year) {
    const now = new Date();
    const examMonth = user.exam_type === 'JAMB' ? 3 : user.exam_type === 'NECO' ? 7 : 5;
    const examDate = new Date(user.target_year, examMonth - 1, 15);
    const daysLeft = Math.ceil((examDate.getTime() - now.getTime()) / 86400000);
    if (daysLeft > 0) {
      const unseen = progress.subjectCoverage
        .filter(c => user.subjects?.includes(c.subject))
        .reduce((s, c) => s + Math.max(0, c.total - c.seen), 0);
      if (unseen > 0 && daysLeft > 0) {
        const dailyTarget = Math.ceil(unseen / daysLeft);
        studyPlanLine = `\n\n📅 <b>Study Plan:</b> ~${dailyTarget} questions/day to cover all content before your ${user.exam_type} exam (${daysLeft} days left)`;
      }
    }
  }

  // Referral summary line
  const needed = Math.max(0, 2 - referralCount);
  const referralLine = user.referral_reward_granted
    ? '\n🎁 Referral reward claimed!'
    : referralCount > 0
      ? `\n🔗 ${referralCount} friend${referralCount !== 1 ? 's' : ''} referred${needed > 0 ? ` — ${needed} more for reward` : ' — reward pending!'}`
      : '\n🔗 Refer 2 friends → 3 days Premium free (/invite)';

  await ctx.reply(
    fmt.progressMessage(user, progress.totalAttempts, progress.accuracy, progress.subjectCoverage) + referralLine + studyPlanLine,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Topic Mastery', callback_data: 'stats:topic_mastery' }],
          [{ text: '📤 Share Progress', callback_data: 'stats:share' }],
          [
            { text: '📊 Full Stats', callback_data: 'stats:show' },
            { text: '📅 Timetable', callback_data: 'timetable:show' },
          ],
          [{ text: '📚 Practice', callback_data: 'practice:pick' }],
        ],
      },
    }
  );
}

export async function handleTopicMastery(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  const subjects = user.subjects || [];
  if (subjects.length === 0) {
    await ctx.reply('No subjects selected. Go to /settings to pick your subjects.');
    return;
  }

  if (subjects.length === 1) {
    return showTopicMasteryForSubject(ctx, user, subjects[0]);
  }

  // Multiple subjects — show picker
  await ctx.reply(
    '📊 <b>Topic Mastery</b>\n\nWhich subject would you like to drill into?',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...subjects.map(s => [{ text: `${SUBJECT_EMOJI[s] || '📖'} ${SUBJECT_MAP[s] || s}`, callback_data: `stats:topic_mastery:${s}` }]),
          [{ text: '🏠 Main Menu', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

export async function handleTopicMasterySubject(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const subject = ctx.callbackQuery.data.split(':')[3];
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  await showTopicMasteryForSubject(ctx, user, subject);
}

async function showTopicMasteryForSubject(ctx: any, user: any, subject: string): Promise<void> {
  const topics = await db.getTopicMastery(user.id, subject, user.exam_type || '');
  const subjectName = SUBJECT_MAP[subject] || subject;
  const emoji = SUBJECT_EMOJI[subject] || '📖';

  if (topics.length === 0) {
    await ctx.reply(
      `${emoji} <b>${subjectName} — Topic Mastery</b>\n\nNo data yet. Answer some ${subjectName} questions first!`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: `📚 Practice ${subjectName}`, callback_data: `practice:subject:${subject}` }]] } }
    );
    return;
  }

  const lines = topics.map(t => {
    const bar = t.accuracy >= 80 ? '🟢' : t.accuracy >= 50 ? '🟡' : '🔴';
    return `${bar} <b>${fmt.escHtml(t.topic)}</b>: ${t.accuracy}% (${t.correct}/${t.attempts})`;
  });

  await ctx.reply(
    `${emoji} <b>${subjectName} — Topic Mastery</b>\n\n${lines.join('\n')}\n\n🟢 Strong  🟡 Needs work  🔴 Weak`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `📚 Practice ${subjectName}`, callback_data: `practice:subject:${subject}` }],
          [{ text: '⬅️ Back', callback_data: 'stats:topic_mastery' }],
        ],
      },
    }
  );
}

export async function handleShareProgress(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }
  const progress = await db.getProgressStats(user.id);
  const card = fmt.shareableProgressCard(user, progress.totalAttempts, progress.accuracy, BOT_USERNAME, progress.subjectCoverage);
  const caption = `🎉 <b>Flex your progress!</b>\n\nSave the image above and post it on Instagram/TikTok, or forward it straight to a friend.`;

  try {
    const best = (progress.subjectCoverage || [])
      .filter(c => user.subjects?.includes(c.subject) && c.total > 0)
      .sort((a, b) => b.seen / b.total - a.seen / a.total)[0];

    const image = await renderProgressCard({
      firstName: user.first_name,
      streak: user.streak || 0,
      totalAttempts: progress.totalAttempts,
      accuracy: progress.accuracy,
      rankLabel: getRank(progress.totalAttempts).label,
      examType: user.exam_type,
      targetYear: user.target_year,
      bestSubject: best ? { name: SUBJECT_MAP[best.subject] || best.subject, pct: Math.round((best.seen / best.total) * 100) } : null,
      joinHandle: `@${BOT_USERNAME}`,
    });

    await ctx.replyWithPhoto({ source: image }, { caption, parse_mode: 'HTML' });
  } catch (err) {
    // Render failure (e.g. bad host font setup) — fall back to the text card so sharing still works
    console.error('[stats] progress card render failed:', (err as Error).message);
    await ctx.reply(
      `${card}\n\n<i>Copy the text above and share it on WhatsApp or anywhere you like!</i>`,
      { parse_mode: 'HTML' }
    );
  }
}

export async function handleWeeklyReport(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  if (user.plan !== 'premium') {
    await ctx.reply(
      '💎 Weekly reports are a Premium feature.\n\nUpgrade to see your full breakdown, week-over-week accuracy, weak topics, and peer ranking.',
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '💎 Upgrade to Premium', callback_data: 'menu:subscribe' }]] },
      }
    );
    return;
  }

  const report = await db.getWeeklyReport(user.id);
  const { thisWeek, lastWeek, subjectBreakdown, weakTopics, bestSubject, coverageStats, percentileRank } = report;

  if (thisWeek.attempts === 0) {
    await ctx.reply("📊 No questions answered this week yet.\n\nStart practising to see your report! /practice");
    return;
  }

  const delta = lastWeek.attempts > 0 ? thisWeek.accuracy - lastWeek.accuracy : null;
  const deltaStr = delta !== null
    ? (delta >= 0 ? ` ↑ +${delta.toFixed(1)}%` : ` ↓ ${delta.toFixed(1)}%`)
    : '';

  const subjectLines = subjectBreakdown.map((s) => {
    const name = SUBJECT_MAP[s.subject] || s.subject;
    const emoji = SUBJECT_EMOJI[s.subject] || '📖';
    const warn = s.accuracy < 50 ? ' ⚠️' : '';
    return `  ${emoji} ${name}: ${s.accuracy}% (${s.attempts} questions)${warn}`;
  }).join('\n');

  const weakLines = weakTopics.map((t) => {
    const subjectName = SUBJECT_MAP[t.subject] || t.subject;
    return `  • ${fmt.escHtml(t.topic)} <i>(${subjectName})</i> — ${t.accuracy}% → /drill ${fmt.escHtml(t.topic)}`;
  }).join('\n');

  const bestLine = bestSubject
    ? `\n🌟 Best subject: ${SUBJECT_MAP[bestSubject.subject] || bestSubject.subject} at ${bestSubject.accuracy}%`
    : '';

  const percentileLine = percentileRank !== null
    ? `\n🏅 You're in the top ${100 - percentileRank}% of students this week`
    : '';

  const coverageLines = coverageStats
    .filter(c => subjectBreakdown.some(s => s.subject === c.subject))
    .slice(0, 2)
    .map(c => {
      const pct = Math.round((c.seen / c.total) * 100);
      const name = SUBJECT_MAP[c.subject] || c.subject;
      return `  📊 ${name}: ${pct}% of question bank explored (${c.seen}/${c.total})`;
    }).join('\n');

  const countdown = fmt.examCountdown(user.exam_type || null, user.target_year || null);
  const msg = `💎 <b>Your Weekly Report</b>${countdown ? `\n${countdown}` : ''}

📅 <b>This Week:</b>
📝 Questions answered: ${thisWeek.attempts}
🎯 Accuracy: ${thisWeek.accuracy}%${deltaStr}
🔥 Streak: ${user.streak || 0} days${bestLine}${percentileLine}${subjectBreakdown.length > 0 ? `

📚 <b>Subject Breakdown:</b>
${subjectLines}` : ''}${coverageLines ? `

📈 <b>Progress:</b>
${coverageLines}` : ''}${weakTopics.length > 0 ? `

⚠️ <b>Focus Areas:</b>
${weakLines}` : '\n\n✅ No weak topics this week — great work!'}`;

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '← Back to Settings', callback_data: 'settings:back' }]] },
  });
}
