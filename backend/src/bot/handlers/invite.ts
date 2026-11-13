import * as db from '../../db';
import { escHtml } from '../formatter';

const BOT_USERNAME = process.env.BOT_USERNAME || 'ExamBuddieBot';

export async function handleInvite(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please tap /start first.'); return; }

  const code = user.referral_code;
  if (!code) {
    await ctx.reply('⚠️ Could not generate your invite link. Please try again.');
    return;
  }

  const link = `https://t.me/${BOT_USERNAME}?start=ref_${code}`;
  const confirmed = await db.getConfirmedReferralCount(user.id);
  const daysEarned = user.referral_days_granted ?? 0;

  await ctx.reply(
    `🔗 <b>Invite Friends to ExamBuddie</b>\n\n` +
    `Share your link:\n<code>${link}</code>\n\n` +
    `🎁 For every friend who joins with your link and answers at least 1 question, you get <b>1 free day of Premium</b>. ` +
    `No limit: 10 friends = 10 days!\n\n` +
    `👥 Friends practising: <b>${confirmed}</b>\n` +
    `💎 Premium days earned: <b>${daysEarned}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📤 Telegram', url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Practice WAEC, JAMB & NECO questions on ExamBuddie! 🎓')}` },
            { text: '💚 WhatsApp', url: `https://wa.me/?text=${encodeURIComponent(`Practice WAEC, JAMB & NECO questions on ExamBuddie! 🎓\n${link}`)}` },
          ],
          [{ text: '📋 Copy Link', callback_data: `invite:copy:${link}` }],
          [{ text: '🏆 Referral Leaderboard', callback_data: 'invite:leaderboard' }],
        ],
      },
    }
  );
}

export async function handleReferralLeaderboard(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const topReferrers = await db.getTopReferrers(10);

  if (topReferrers.length === 0) {
    await ctx.reply(
      '🏆 <b>Referral Leaderboard</b>\n\nNo confirmed referrals yet — be the first!',
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔗 My Invite Link', callback_data: 'invite:link' }]] },
      }
    );
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  let text = '🏆 <b>Top Referrers</b>\n\n';
  for (let i = 0; i < topReferrers.length; i++) {
    const r = topReferrers[i];
    const medal = medals[i] || `${i + 1}.`;
    text += `${medal} ${escHtml(r.first_name)} — ${r.referrals} friend${r.referrals !== 1 ? 's' : ''}\n`;
  }
  text += '\n<i>Every friend who practises = 1 free Premium day! /invite</i>';

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '🔗 My Invite Link', callback_data: 'invite:link' }]] },
  });
}
