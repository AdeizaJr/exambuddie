import * as db from '../../db';

const BOT_USERNAME = process.env.BOT_USERNAME || 'ExamBuddieBot';

export async function handleInvite(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please tap /start first.'); return; }

  const code = user.referral_code;
  if (!code) {
    await ctx.reply('⚠️ Could not generate your invite link. Please try again.');
    return;
  }

  const link = `https://t.me/${BOT_USERNAME}?start=ref_${code}`;
  const confirmed = await db.getConfirmedReferralCount(user.id);
  const needed = Math.max(0, 2 - confirmed);

  const rewardLine = user.referral_reward_granted
    ? '✅ You\'ve already claimed your referral reward!'
    : confirmed >= 2
      ? '🎁 Your reward is on the way!'
      : `🎯 Invite <b>${needed} more friend${needed === 1 ? '' : 's'}</b> who answer at least 1 question → get <b>3 days Premium free</b>`;

  await ctx.reply(
    `🔗 <b>Invite Friends to ExamBuddie</b>\n\n` +
    `Share your link:\n<code>${link}</code>\n\n` +
    `${rewardLine}\n\n` +
    `👥 Confirmed friends so far: <b>${confirmed}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📤 Telegram', url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Practice WAEC, JAMB & NECO questions on ExamBuddie! 🎓')}` },
            { text: '💚 WhatsApp', url: `https://wa.me/?text=${encodeURIComponent(`Practice WAEC, JAMB & NECO questions on ExamBuddie! 🎓\n${link}`)}` },
          ],
          [{ text: '📋 Copy Link', callback_data: `invite:copy:${link}` }],
        ],
      },
    }
  );
}
