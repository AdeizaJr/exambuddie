// handlers/support.ts — /support command and contact/help flows
import * as db from '../../db';
import * as redis from '../../services/redis';
import { sendSupportEmail } from '../../services/email';
import { escHtml } from '../formatter';

const SUPPORT_CHAT_ID = process.env.SUPPORT_CHAT_ID
  ? parseInt(process.env.SUPPORT_CHAT_ID, 10)
  : null;

const MENU = {
  inline_keyboard: [
    [{ text: '🐛 Report a Bug', callback_data: 'support:bug' }],
    [{ text: '📋 Data Request', callback_data: 'support:data' }],
    [{ text: '🗑️ Delete My Account', callback_data: 'support:delete' }],
    [{ text: '💬 Other / General', callback_data: 'support:other' }],
  ],
};

export async function handleSupport(ctx: any): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  await ctx.reply(
    '🛟 <b>Support</b>\n\nHow can we help you?',
    { parse_mode: 'HTML', reply_markup: MENU }
  );
}

export async function handleSupportBug(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  await redis.setSupportStep(ctx.from.id, 'bug');
  await ctx.reply(
    '🐛 <b>Report a Bug</b>\n\nDescribe the issue in your next message — include what you were doing and what went wrong. We\'ll look into it.',
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '← Back', callback_data: 'support:menu' }]] },
    }
  );
}

export async function handleSupportData(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  await ctx.reply(
    `📋 <b>Data Request</b>\n\nYou can request access to, correction of, export of, or deletion of your personal data under the Nigeria Data Protection Act 2023.\n\nEmail us at <a href="mailto:hello@exambuddie.app">hello@exambuddie.app</a> with:\n• Your name\n• Your Telegram username or ID (<code>${ctx.from.id}</code>)\n• What you want (access / correct / export / delete)\n\nWe will respond within <b>30 days</b>.`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '← Back', callback_data: 'support:menu' }]] },
    }
  );
}

export async function handleSupportOther(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  await ctx.reply(
    '💬 <b>Get in Touch</b>\n\nFor any other questions or feedback:\n\n• DM <b>@ExamBuddiSupport</b> on Telegram\n• Email <a href="mailto:hello@exambuddie.app">hello@exambuddie.app</a>\n\nWe usually reply within 24–48 hours.',
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '← Back', callback_data: 'support:menu' }]] },
    }
  );
}

// Called from the text handler in index.ts when support_step is 'bug'
export async function handleBugReport(ctx: any, bot: any): Promise<void> {
  const text: string = ctx.message?.text?.trim() || '';
  await redis.clearSupportStep(ctx.from.id);

  const name = `${ctx.from.first_name ?? ''}${ctx.from.username ? ' (@' + ctx.from.username + ')' : ''}`;

  // Save first — the Telegram/email forwards below fail silently when unconfigured
  if (text) {
    await db.createBugReport(ctx.from.id, name, text).catch((err) =>
      console.error('Failed to save bug report:', err.message)
    );
  }

  await ctx.reply(
    '✅ <b>Thanks!</b> Your report has been received. We\'ll look into it and follow up if we need more details.',
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu:main' }]] },
    }
  );

  // Forwards run in the background, after the user has their reply: if SMTP or the
  // support chat hangs, awaiting them here blew Telegraf's 90s handler timeout — the
  // user got "Oops!" and Telegram re-delivered the message, which fell through to the menu.
  const forwards: Promise<unknown>[] = [];
  if (SUPPORT_CHAT_ID) {
    const msg =
      `🐛 <b>Bug Report</b>\n` +
      `From: ${escHtml(name)}\n` +
      `ID: <code>${ctx.from.id}</code>\n\n` +
      `<b>Message:</b>\n${escHtml(text)}`;
    forwards.push(bot.telegram.sendMessage(SUPPORT_CHAT_ID, msg, { parse_mode: 'HTML' }));
  }
  forwards.push(sendSupportEmail({
    subject: `[ExamBuddie] Bug Report from ${name}`,
    html: `<p><b>From:</b> ${escHtml(name)} (Telegram ID: ${ctx.from.id})</p><p><b>Message:</b></p><pre>${escHtml(text)}</pre>`,
  }));
  void Promise.allSettled(forwards).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') console.error('Bug report forward failed:', r.reason?.message ?? r.reason);
    }
  });
}
