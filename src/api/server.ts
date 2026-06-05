// src/api/server.ts
import express, { Request, Response, NextFunction } from 'express';
import * as payments from '../services/payments';
import * as db from '../db';
import path from 'path';
import miniappRouter from './miniapp';

export default function createServer(bot: any) {
  const app = express();
  const adminPath = path.resolve(__dirname, '../../admin');
  const miniappPath = path.resolve(__dirname, '../../dist/miniapp');
  app.use('/admin', express.static(adminPath));
  app.use('/app', express.static(miniappPath));
  app.use(express.json());

  // Mini App API routes
  app.use('/api/miniapp', miniappRouter);

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'ExamBuddie Bot', ts: new Date().toISOString() });
  });

  // ── Flutterwave payment callback (redirect after payment) ───────────────────
  app.get('/payment/callback', async (req: Request, res: Response) => {
    const { tx_ref, status } = req.query;

    if (status !== 'successful' || !tx_ref) {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>❌ Payment not completed</h2>
        <p>Please try again or contact support.</p>
        <p>Return to <a href="https://t.me/ExamBuddiBot">ExamBuddie on Telegram</a></p>
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
          { parse_mode: 'HTML' }
        );
      } catch (e: any) { console.error('Could not notify user:', e.message); }

      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0fff8">
        <h2 style="color:#1A7A4A">🎉 Payment Successful!</h2>
        <p>Your ExamBuddie Premium is now active.</p>
        <p>Return to <a href="https://t.me/ExamBuddiBot">Telegram to start practising →</a></p>
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

  // ── Admin auth middleware ────────────────────────────────────────────────────
  const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // ── GET /api/admin/stats ────────────────────────────────────────────────────
  app.get('/api/admin/stats', adminAuth, async (req: Request, res: Response) => {
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

  // ── GET /api/admin/flags ────────────────────────────────────────────────────
  app.get('/api/admin/flags', adminAuth, async (req: Request, res: Response) => {
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

  // ── POST /api/admin/flags/:id/resolve ──────────────────────────────────────
  app.post('/api/admin/flags/:id/resolve', adminAuth, async (req: Request, res: Response) => {
    const { explanation } = req.body;
    // If explanation provided, also update the question
    if (explanation !== undefined) {
      // First get the question_id from this flag
      const { rows: flagRows } = await db.query(
        `SELECT question_id FROM flagged_explanations WHERE id = $1`,
        [req.params.id]
      );
      if (flagRows.length > 0) {
        await db.query(
          `UPDATE questions SET explanation = $1, explanation_reviewed = true WHERE id = $2`,
          [explanation, flagRows[0].question_id]
        );
      }
    }
    await db.query(
      `UPDATE flagged_explanations SET resolved = true WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  });

  // ── GET /api/admin/questions ────────────────────────────────────────────────
  app.get('/api/admin/questions', adminAuth, async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.subject) {
      params.push(req.query.subject);
      conditions.push(`subject = $${params.length}`);
    }
    if (req.query.exam_type) {
      params.push(req.query.exam_type);
      conditions.push(`exam_type = $${params.length}`);
    }
    if (req.query.year) {
      params.push(parseInt(req.query.year as string));
      conditions.push(`year = $${params.length}`);
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      conditions.push(`question_text ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    const { rows } = await db.query(
      `SELECT id, exam_type, subject, year, question_text, option_a, option_b, option_c, option_d, option_e,
              correct_option, explanation, explanation_reviewed, flag_count, source_id, created_at
       FROM questions ${where}
       ORDER BY id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) as total FROM questions ${where}`,
      countParams
    );

    res.json({
      data: rows,
      total: parseInt(countRows[0].total),
      page,
      limit,
      pages: Math.ceil(parseInt(countRows[0].total) / limit),
    });
  });

  // ── PUT /api/admin/questions/:id ────────────────────────────────────────────
  app.put('/api/admin/questions/:id', adminAuth, async (req: Request, res: Response) => {
    const { question_text, option_a, option_b, option_c, option_d, option_e, correct_option, explanation } = req.body;
    const { rows } = await db.query(
      `UPDATE questions SET
         question_text = COALESCE($1, question_text),
         option_a = COALESCE($2, option_a),
         option_b = COALESCE($3, option_b),
         option_c = COALESCE($4, option_c),
         option_d = COALESCE($5, option_d),
         option_e = $6,
         correct_option = COALESCE($7, correct_option),
         explanation = COALESCE($8, explanation),
         explanation_reviewed = CASE WHEN $8 IS NOT NULL THEN true ELSE explanation_reviewed END
       WHERE id = $9
       RETURNING *`,
      [question_text, option_a, option_b, option_c, option_d, option_e ?? null, correct_option, explanation ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  });

  // ── DELETE /api/admin/questions/:id ────────────────────────────────────────
  app.delete('/api/admin/questions/:id', adminAuth, async (req: Request, res: Response) => {
    const { rows } = await db.query(
      `DELETE FROM questions WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json({ ok: true, deleted: rows[0].id });
  });

  // ── GET /api/admin/users ────────────────────────────────────────────────────
  app.get('/api/admin/users', adminAuth, async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      const idx = params.length;
      conditions.push(`(first_name ILIKE $${idx} OR username ILIKE $${idx} OR CAST(telegram_id AS TEXT) ILIKE $${idx})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    const { rows } = await db.query(
      `SELECT telegram_id, first_name, username, exam_type, subjects,
              plan, plan_expires_at, streak, joined_at, daily_count, last_active_date
       FROM users ${where}
       ORDER BY joined_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) as total FROM users ${where}`,
      countParams
    );

    res.json({
      data: rows,
      total: parseInt(countRows[0].total),
      page,
      limit,
      pages: Math.ceil(parseInt(countRows[0].total) / limit),
    });
  });

  // ── PUT /api/admin/users/:telegramId/plan ───────────────────────────────────
  app.put('/api/admin/users/:telegramId/plan', adminAuth, async (req: Request, res: Response) => {
    const { plan, months } = req.body;
    if (!['premium', 'free'].includes(plan)) {
      return res.status(400).json({ error: 'plan must be premium or free' });
    }

    let expiresAt: string | null = null;
    if (plan === 'premium') {
      const m = parseInt(months) || 1;
      const d = new Date();
      d.setMonth(d.getMonth() + m);
      expiresAt = d.toISOString();
    }

    const { rows } = await db.query(
      `UPDATE users SET plan = $1, plan_expires_at = $2, updated_at = NOW()
       WHERE telegram_id = $3 RETURNING telegram_id, first_name, plan, plan_expires_at`,
      [plan, expiresAt, req.params.telegramId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  });

  // ── GET /api/admin/subscriptions ────────────────────────────────────────────
  app.get('/api/admin/subscriptions', adminAuth, async (req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT s.id, s.plan, s.amount_ngn, s.status,
             s.started_at, s.expires_at, s.flutterwave_tx_ref,
             u.first_name, u.username, u.telegram_id
      FROM subscriptions s
      JOIN users u ON s.user_id = u.telegram_id
      ORDER BY s.started_at DESC
      LIMIT 200
    `);
    res.json(rows);
  });

  // ── GET /api/admin/analytics ────────────────────────────────────────────────
  app.get('/api/admin/analytics', adminAuth, async (req: Request, res: Response) => {
    const [dailyResult, subjectsResult, missingExpResult, flaggedResult] = await Promise.all([
      db.query(`
        SELECT
          DATE(attempted_at) as date,
          COUNT(*) as attempts,
          SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct
        FROM attempts
        WHERE attempted_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(attempted_at)
        ORDER BY date ASC
      `),
      db.query(`
        SELECT
          q.subject,
          COUNT(a.id) as attempts,
          SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct,
          ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id), 0), 1) as accuracy
        FROM attempts a
        JOIN questions q ON a.question_id = q.id
        GROUP BY q.subject
        ORDER BY attempts DESC
      `),
      db.query(`SELECT COUNT(*) as count FROM questions WHERE explanation IS NULL OR explanation = ''`),
      db.query(`SELECT COUNT(*) as count FROM questions WHERE flag_count > 0`),
    ]);

    res.json({
      daily: dailyResult.rows,
      subjects: subjectsResult.rows,
      contentHealth: {
        missing_explanations: parseInt(missingExpResult.rows[0].count),
        flagged_questions: parseInt(flaggedResult.rows[0].count),
      },
    });
  });

  // ── POST /api/admin/broadcast ───────────────────────────────────────────────
  app.post('/api/admin/broadcast', adminAuth, async (req: Request, res: Response) => {
    const { message, target } = req.body;
    if (!message || !target) {
      return res.status(400).json({ error: 'message and target are required' });
    }

    const validTargets = ['all', 'waec', 'jamb', 'neco', 'premium', 'free'];
    if (!validTargets.includes(target)) {
      return res.status(400).json({ error: `target must be one of: ${validTargets.join(', ')}` });
    }

    let whereClause = '';
    if (target === 'waec') whereClause = `WHERE exam_type = 'WAEC'`;
    else if (target === 'jamb') whereClause = `WHERE exam_type = 'JAMB'`;
    else if (target === 'neco') whereClause = `WHERE exam_type = 'NECO'`;
    else if (target === 'premium') whereClause = `WHERE plan = 'premium'`;
    else if (target === 'free') whereClause = `WHERE plan = 'free'`;

    const { rows: users } = await db.query(
      `SELECT telegram_id FROM users ${whereClause}`
    );

    let sent = 0;
    let failed = 0;
    const total = users.length;

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
        sent++;
      } catch (err: any) {
        console.error(`[Broadcast] Failed to send to ${user.telegram_id}:`, err.message);
        failed++;
      }
      // Rate limit: 50ms delay between sends
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    res.json({ sent, failed, total });
  });

  return app;
}
