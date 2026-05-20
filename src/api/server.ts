// src/api/server.ts
import express, { Request, Response, NextFunction } from 'express';
import * as payments from '../services/payments';
import * as db from '../db';

export default function createServer(bot: any) {
  const app = express();
  app.use(express.json());

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'ExamAce Bot', ts: new Date().toISOString() });
  });

  // ── Flutterwave payment callback (redirect after payment) ───────────────────
  app.get('/payment/callback', async (req: Request, res: Response) => {
    const { tx_ref, status } = req.query;

    if (status !== 'successful' || !tx_ref) {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>❌ Payment not completed</h2>
        <p>Please try again or contact support.</p>
        <p>Return to <a href="https://t.me/ExamAceBot">ExamAce on Telegram</a></p>
        </body></html>
      `);
    }

    try {
      const { user, expiresAt, planType } = await payments.activateSubscription(tx_ref as string);

      // Notify user on Telegram
      try {
        const expiry = new Date(expiresAt).toLocaleDateString('en-NG');
        await bot.telegram.sendMessage(
          user.telegram_id,
          `🎉 *Payment confirmed! Welcome to Premium, ${user.first_name}!*\n\n` +
          `✅ Plan: ${planType === 'yearly' ? 'Annual' : 'Monthly'}\n` +
          `📅 Expires: ${expiry}\n\n` +
          `You now have *unlimited questions*, quiz mode, topic drills, and progress tracking.\n\n` +
          `Start now: /practice`,
          { parse_mode: 'Markdown' }
        );
      } catch (e: any) { console.error('Could not notify user:', e.message); }

      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0fff8">
        <h2 style="color:#1A7A4A">🎉 Payment Successful!</h2>
        <p>Your ExamAce Premium is now active.</p>
        <p>Return to <a href="https://t.me/ExamAceBot">Telegram to start practising →</a></p>
        </body></html>
      `);
    } catch (err: any) {
      console.error('Payment activation error:', err.message);
      res.status(400).send('Payment verification failed. Contact support with your reference.');
    }
  });

  // ── Flutterwave webhook (server-to-server) ──────────────────────────────────
  app.post('/webhooks/flutterwave', async (req: Request, res: Response) => {
    const signature = req.headers['verif-hash'];

    if (!payments.verifyWebhook(signature, req.body)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data } = req.body;

    if (event === 'charge.completed' && data?.status === 'successful') {
      try {
        await payments.activateSubscription(data.tx_ref);
        console.log(`[Webhook] Activated subscription for tx: ${data.tx_ref}`);
      } catch (err: any) {
        console.error('[Webhook] Error activating subscription:', err.message);
      }
    }

    res.json({ status: 'ok' });
  });

  // ── Admin endpoints ─────────────────────────────────────────────────────────
  const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  app.get('/admin/stats', adminAuth, async (req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE plan = 'premium') as premium_users,
        (SELECT COUNT(*) FROM users WHERE joined_at > NOW() - INTERVAL '24 hours') as new_today,
        (SELECT COUNT(*) FROM attempts WHERE attempted_at > NOW() - INTERVAL '24 hours') as attempts_today,
        (SELECT COUNT(*) FROM attempts) as total_attempts,
        (SELECT COUNT(*) FROM questions) as total_questions,
        (SELECT COUNT(*) FROM flagged_explanations WHERE resolved = false) as pending_flags,
        (SELECT COALESCE(SUM(amount_ngn), 0) FROM subscriptions WHERE status = 'active') as total_revenue_ngn
    `);
    res.json(rows[0]);
  });

  app.get('/admin/flags', adminAuth, async (req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT f.id, f.flagged_at, f.reason, f.resolved,
             q.id as question_id, q.subject, q.question_text,
             q.correct_option, q.explanation, q.flag_count
      FROM flagged_explanations f
      JOIN questions q ON f.question_id = q.id
      WHERE f.resolved = false
      ORDER BY f.flagged_at DESC LIMIT 50
    `);
    res.json(rows);
  });

  app.post('/admin/flags/:id/resolve', adminAuth, async (req: Request, res: Response) => {
    await db.query(
      `UPDATE flagged_explanations SET resolved = true WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  });

  app.put('/admin/questions/:id/explanation', adminAuth, async (req: Request, res: Response) => {
    const { explanation } = req.body;
    await db.query(
      `UPDATE questions SET explanation = $1, explanation_reviewed = true WHERE id = $2`,
      [explanation, req.params.id]
    );
    res.json({ ok: true });
  });

  app.get('/admin/users', adminAuth, async (req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT telegram_id, first_name, username, exam_type, subjects,
             plan, plan_expires_at, streak, joined_at, daily_count
      FROM users ORDER BY joined_at DESC LIMIT 100
    `);
    res.json(rows);
  });

  return app;
}
