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
    '🐛 <b>Report a Bug</b>\n\nDescribe the issue in your next message — include what you were doing and what went wrong. You can also send a screenshot (add your description as the caption). We\'ll look into it.',
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

const THANKS_KEYBOARD = { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu:main' }]] };

function reporterName(ctx: any): string {
  return `${ctx.from.first_name ?? ''}${ctx.from.username ? ' (@' + ctx.from.username + ')' : ''}`;
}

// Forwards run in the background, after the user has their reply: if SMTP or the
// support chat hangs, awaiting them blew Telegraf's 90s handler timeout — the user
// got "Oops!" and Telegram re-delivered the message, which fell through to the menu.
function forwardInBackground(forwards: Promise<unknown>[]): void {
  void Promise.allSettled(forwards).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') console.error('Bug report forward failed:', r.reason?.message ?? r.reason);
    }
  });
}

// Called from the text handler in index.ts when support_step is 'bug'
export async function handleBugReport(ctx: any, bot: any): Promise<void> {
  const text: string = ctx.message?.text?.trim() || '';
  await redis.clearSupportStep(ctx.from.id);

  const name = reporterName(ctx);

  // Save first — the Telegram/email forwards below fail silently when unconfigured
  let reportId: number | null = null;
  if (text) {
    reportId = await db.createBugReport(ctx.from.id, name, text).catch((err) => {
      console.error('Failed to save bug report:', err.message);
      return null;
    });
  }
  // Screenshots sent next get attached to this report (see handleBugPhoto)
  if (reportId) await redis.setSupportStep(ctx.from.id, `bug_photo:${reportId}`);

  await ctx.reply(
    '✅ <b>Thanks!</b> Your report has been received. We\'ll look into it and follow up if we need more details.' +
      (reportId ? '\n\n📸 Got a screenshot? Send it now and we\'ll attach it to this report.' : ''),
    { parse_mode: 'HTML', reply_markup: THANKS_KEYBOARD }
  );

  const forwards: Promise<unknown>[] = [];
  if (SUPPORT_CHAT_ID) {
    const msg =
      `🐛 <b>Bug Report${reportId ? ` #${reportId}` : ''}</b>\n` +
      `From: ${escHtml(name)}\n` +
      `ID: <code>${ctx.from.id}</code>\n\n` +
      `<b>Message:</b>\n${escHtml(text)}`;
    forwards.push(bot.telegram.sendMessage(SUPPORT_CHAT_ID, msg, { parse_mode: 'HTML' }));
  }
  forwards.push(sendSupportEmail({
    subject: `[ExamBuddie] Bug Report from ${name}`,
    html: `<p><b>From:</b> ${escHtml(name)} (Telegram ID: ${ctx.from.id})</p><p><b>Message:</b></p><pre>${escHtml(text)}</pre>`,
  }));
  forwardInBackground(forwards);
}

// The screenshot in a message: largest size of a photo, or an image sent as a file.
export function bugScreenshot(message: any): { fileId: string; asDocument: boolean } | null {
  if (message?.photo?.length) return { fileId: message.photo[message.photo.length - 1].file_id, asDocument: false };
  if (message?.document?.mime_type?.startsWith('image/')) return { fileId: message.document.file_id, asDocument: true };
  return null;
}

// Called from the message handler in index.ts for a screenshot while support_step is
// 'bug' (screenshot IS the report) or 'bug_photo:<id>' (attach to the report just sent).
// Album photos arrive as separate, concurrent updates sharing one media_group_id.
export async function handleBugPhoto(ctx: any, bot: any, step: string): Promise<void> {
  const shot = bugScreenshot(ctx.message);
  if (!shot) return;
  const caption: string = ctx.message.caption?.trim() || '';
  const albumId: string | null = ctx.message.media_group_id ?? null;
  const name = reporterName(ctx);
  // One reply per album, not one per photo
  const shouldReply = albumId ? await redis.claimOnce(`bug_album_ack:${albumId}`, 600) : true;

  let reportId: number;
  if (step === 'bug') {
    reportId = await db.createBugReport(ctx.from.id, name, caption, [shot.fileId], albumId);
    await redis.setSupportStep(ctx.from.id, `bug_photo:${reportId}`);
    if (shouldReply) {
      await ctx.reply(
        '✅ <b>Thanks!</b> Your report has been received. We\'ll look into it and follow up if we need more details.\n\n📸 You can send more screenshots and we\'ll add them to this report.',
        { parse_mode: 'HTML', reply_markup: THANKS_KEYBOARD }
      );
    }
  } else {
    reportId = Number(step.slice('bug_photo:'.length));
    const added = await db.addBugReportPhoto(reportId, ctx.from.id, shot.fileId);
    if (shouldReply) {
      await ctx.reply(
        added
          ? '📸 Screenshot added to your report. Thanks!'
          : `That report already has the maximum of ${db.MAX_BUG_REPORT_PHOTOS} screenshots.`,
        { reply_markup: THANKS_KEYBOARD }
      );
    }
    if (!added) return;
  }

  if (SUPPORT_CHAT_ID) {
    const forwardCaption = `🐛 Bug Report #${reportId}, screenshot from ${name} (ID ${ctx.from.id})` + (caption ? `\n\n${caption}` : '');
    const opts = { caption: forwardCaption.slice(0, 1024) };
    forwardInBackground([
      shot.asDocument
        ? bot.telegram.sendDocument(SUPPORT_CHAT_ID, shot.fileId, opts)
        : bot.telegram.sendPhoto(SUPPORT_CHAT_ID, shot.fileId, opts),
    ]);
  }
}
