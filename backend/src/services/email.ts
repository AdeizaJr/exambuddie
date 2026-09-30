// services/email.ts — Zoho Mail SMTP transport
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_SMTP_USER,
    pass: process.env.ZOHO_SMTP_PASS,
  },
  // Nodemailer's defaults wait minutes on an unreachable/blocked SMTP host; fail fast instead.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

export async function sendSupportEmail(opts: {
  subject: string;
  html: string;
}): Promise<void> {
  const from = process.env.ZOHO_SMTP_USER;
  const to = process.env.ZOHO_SMTP_TO || from;
  if (!from || !to) return; // not configured — skip silently
  await transporter.sendMail({ from, to, subject: opts.subject, html: opts.html });
}
