// src/api/server.ts
import path from 'path';
import fs from 'fs';
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import * as payments from '../services/payments';
import * as db from '../db';
import * as redis from '../services/redis';
import miniappRouter from './miniapp';
import { comparePassword, hashPassword, signToken, verifyToken } from '../services/auth';
import { getPricing, updatePricing, getPricingHistory, PricingSettings } from '../services/pricing';

const diagramsDir = path.join(__dirname, '../../public/diagrams');
if (!fs.existsSync(diagramsDir)) fs.mkdirSync(diagramsDir, { recursive: true });

// Rejects a non-numeric :id before multer ever touches the filesystem. Without this,
// req.params.id flows unsanitized into the saved filename below — Express decodes a
// URL-encoded "%2f" in a route param back into a literal "/", and multer's disk-storage
// resolves the resulting ".." segments via path.join, escaping the diagrams directory
// entirely (verified locally).
const requireNumericId = (req: Request, res: Response, next: NextFunction) => {
  if (!/^\d+$/.test(String(req.params.id))) return res.status(400).json({ error: 'Invalid question id' });
  next();
};

const ALLOWED_IMAGE_EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
};

const diagramUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, diagramsDir),
    filename: (req, file, cb) => {
      // Extension is derived from the verified mimetype, not the client-supplied
      // originalname, so a mismatched filename/Content-Type pair can't smuggle an
      // attacker-chosen extension (e.g. ".html") past the mimetype check below.
      const ext = ALLOWED_IMAGE_EXT[file.mimetype] || '.jpg';
      cb(null, `q${req.params.id}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /image\/(jpeg|png|gif|webp)/.test(file.mimetype));
  },
});

export default function createServer(bot: any) {
  const app = express();

  // CORS — allow admin-ui and miniapp origins
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '';
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Capture raw body for Paystack webhook signature verification
  app.use(
    express.json({
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as any).rawBody = buf;
      },
    })
  );

  // Rate limiting — 300 req/min per IP on API routes, 20 req/min on admin login
  app.use('/api/', rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/admin/login', rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }));

  // Mini App API routes
  app.use('/api/miniapp', miniappRouter);

  // Serve question diagrams
  app.use('/images', express.static(path.join(__dirname, '../../public')));

  // Serve miniapp static files (built to backend/dist/miniapp/)
  const miniappDir = path.join(__dirname, '../../miniapp');
  app.use('/app', express.static(miniappDir));
  app.get('/app/*', (_req: Request, res: Response) => {
    res.sendFile(path.join(miniappDir, 'index.html'));
  });

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'ExamBuddie Bot',
      ts: new Date().toISOString(),
    });
  });

  // ── Public pricing (consumed by the landing site) ────────────────────────────
  app.get('/api/pricing', (_req: Request, res: Response) => {
    res.json(getPricing());
  });

  // ── Public pageview tracking beacon (consumed by the landing site) ──────────
  // Open CORS regardless of ALLOWED_ORIGINS — this is an unauthenticated, no-cookie
  // beacon meant to receive from arbitrary public site visitors, not just the admin/miniapp
  // origins the rest of the API is locked to.
  const TRACK_BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bingpreview|headlesschrome|curl\/|wget\/|python-requests/i;

  app.options('/api/track', (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(204);
  });

  app.post('/api/track', async (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    try {
      const ua = String(req.headers['user-agent'] || '');
      if (TRACK_BOT_UA.test(ua)) return res.sendStatus(204);

      const { path: p, referrer, utmSource, utmMedium, utmCampaign, visitorId } = req.body || {};
      if (!p || !visitorId) return res.sendStatus(400);

      await db.logPageView({
        path: String(p).slice(0, 500),
        referrer: referrer ? String(referrer).slice(0, 500) : null,
        utmSource: utmSource ? String(utmSource).slice(0, 100) : null,
        utmMedium: utmMedium ? String(utmMedium).slice(0, 100) : null,
        utmCampaign: utmCampaign ? String(utmCampaign).slice(0, 100) : null,
        visitorId: String(visitorId).slice(0, 100),
      });
      res.sendStatus(204);
    } catch (err) {
      // A broken tracking beacon should never surface an error to a real site visitor.
      console.error('[track] error:', (err as Error).message);
      res.sendStatus(204);
    }
  });

  // ── Paystack payment callback (redirect after payment) ──────────────────────
  const BOT_USERNAME = process.env.BOT_USERNAME || 'ExamBuddieBot';
  const TELEGRAM_RETURN_URL = `https://t.me/${BOT_USERNAME}`;

  app.get('/payment/callback', async (req: Request, res: Response) => {
    const reference = (req.query.reference || req.query.trxref) as string | undefined;

    if (!reference) {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>❌ Payment not completed</h2>
        <p>Please try again or contact support.</p>
        <p>Return to <a href="${TELEGRAM_RETURN_URL}">ExamBuddie on Telegram</a></p>
        </body></html>
      `);
    }

    try {
      const { user, expiresAt, planType } = await payments.activateSubscription(reference);

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
      } catch (e: any) {
        console.error('Could not notify user:', e.message);
      }

      res.send(`
        <html><head>
        <meta http-equiv="refresh" content="2;url=${TELEGRAM_RETURN_URL}">
        </head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0fff8">
        <h2 style="color:#1A7A4A">🎉 Payment Successful!</h2>
        <p>Your ExamBuddie Premium is now active.</p>
        <p>Redirecting you back to Telegram…</p>
        <p>Return to <a href="${TELEGRAM_RETURN_URL}">Telegram to start practising →</a></p>
        <script>setTimeout(function(){ window.location.href = ${JSON.stringify(TELEGRAM_RETURN_URL)}; }, 1500);</script>
        </body></html>
      `);
    } catch (err: any) {
      console.error('Payment activation error:', err.message);
      res.status(400).send('Payment verification failed. Contact support with your reference.');
    }
  });

  // ── Paystack webhook (server-to-server) ──────────────────────────────────────
  app.post('/webhooks/paystack', async (req: Request, res: Response) => {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = (req as any).rawBody;

    if (!payments.verifyWebhook(signature, rawBody)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data } = req.body;

    if (event === 'charge.success' && data?.status === 'success') {
      try {
        // A tx_ref row exists only for charges we initiated (createPaymentLink) — anything
        // else is a charge Paystack triggered itself on a subscription's billing cycle.
        const { rows } = await db.query('SELECT 1 FROM subscriptions WHERE paystack_tx_ref = $1', [
          data.reference,
        ]);
        if (rows.length > 0) {
          await payments.activateSubscription(data.reference);
          console.log(`[Webhook] Activated subscription for tx: ${data.reference}`);
        } else {
          const result = await payments.handleRecurringCharge(data);
          if (result) {
            console.log(`[Webhook] Renewed subscription for tx: ${data.reference}`);
            try {
              const expiry = new Date(result.expiresAt).toLocaleDateString('en-NG');
              await bot.telegram.sendMessage(
                result.user.telegram_id,
                `🔄 <b>Premium renewed!</b>\n\nYour ${result.planType} plan renewed automatically.\n📅 Next renewal: ${expiry}\n\nUse /billing to manage or cancel anytime.`,
                { parse_mode: 'HTML' }
              );
            } catch {
              /* user may have blocked the bot */
            }
          }
        }
      } catch (err: any) {
        console.error('[Webhook] Error handling charge.success:', err.message);
      }
    } else if (event === 'subscription.create') {
      try {
        await payments.handleSubscriptionCreate(data);
      } catch (err: any) {
        console.error('[Webhook] Error handling subscription.create:', err.message);
      }
    } else if (event === 'subscription.disable' || event === 'subscription.not_renew') {
      try {
        await payments.handleSubscriptionCancelled(data);
      } catch (err: any) {
        console.error(`[Webhook] Error handling ${event}:`, err.message);
      }
    } else if (event === 'invoice.payment_failed') {
      try {
        const customerCode = data.customer?.customer_code || data.subscription?.customer?.customer_code;
        if (customerCode) {
          const { rows: userRows } = await db.query(
            `SELECT u.telegram_id FROM subscriptions s JOIN users u ON s.user_id = u.id
             WHERE s.paystack_customer_code = $1 ORDER BY s.started_at DESC LIMIT 1`,
            [customerCode]
          );
          if (userRows[0]) {
            await bot.telegram
              .sendMessage(
                userRows[0].telegram_id,
                `⚠️ <b>Renewal payment failed</b>\n\nWe couldn't charge your card for your Premium renewal. Use /billing to update your payment method before your current access ends.`,
                { parse_mode: 'HTML' }
              )
              .catch(() => {});
          }
        }
      } catch (err: any) {
        console.error('[Webhook] Error handling invoice.payment_failed:', err.message);
      }
    }

    res.json({ status: 'ok' });
  });

  // ── POST /api/admin/login ───────────────────────────────────────────────────
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const { rows } = await db.query(
      'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = rows[0];
    const valid = await comparePassword(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ id: admin.id, username: admin.username });
    res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  });

  // ── Admin auth middleware ────────────────────────────────────────────────────
  const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
      const payload = verifyToken(token);
      (req as any).admin = payload;
      next();
    } catch (err: any) {
      const expired = err.name === 'TokenExpiredError';
      return res.status(401).json({ error: expired ? 'Token expired' : 'Invalid token' });
    }
  };

  // ── PUT /api/admin/password ─────────────────────────────────────────────────
  app.put('/api/admin/password', adminAuth, async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const adminId = (req as any).admin.id;
    const { rows } = await db.query('SELECT password_hash FROM admin_users WHERE id = $1', [
      adminId,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: 'Admin not found' });

    const valid = await comparePassword(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await hashPassword(newPassword);
    await db.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [newHash, adminId]);

    res.json({ ok: true });
  });

  // ── GET /api/admin/pricing ──────────────────────────────────────────────────
  app.get('/api/admin/pricing', adminAuth, (_req: Request, res: Response) => {
    res.json(getPricing());
  });

  // ── PUT /api/admin/pricing ──────────────────────────────────────────────────
  const PRICING_KEYS: (keyof PricingSettings)[] = [
    'monthly_ngn',
    'term_ngn',
    'yearly_ngn',
    'free_daily_limit',
  ];
  app.put('/api/admin/pricing', adminAuth, async (req: Request, res: Response) => {
    const changes: Partial<PricingSettings> = {};
    for (const key of PRICING_KEYS) {
      const value = req.body[key];
      if (value === undefined) continue;
      if (!Number.isInteger(value) || value <= 0) {
        return res.status(400).json({ error: `${key} must be a positive integer` });
      }
      changes[key] = value;
    }
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'No valid pricing fields provided' });
    }

    const adminUsername = (req as any).admin.username;
    const updated = await updatePricing(changes, adminUsername);

    // Push price changes onto the live Paystack plans — applies to existing
    // recurring subscribers on their next billing cycle, not just new ones.
    const PLAN_TYPE_BY_KEY: Record<string, string> = {
      monthly_ngn: 'monthly',
      term_ngn: 'term',
      yearly_ngn: 'yearly',
    };
    for (const key of Object.keys(changes)) {
      const planType = PLAN_TYPE_BY_KEY[key];
      if (!planType) continue;
      try {
        await payments.syncPaystackPlanPrice(planType, (changes as any)[key]);
      } catch (err: any) {
        console.error(`[Pricing] Failed to sync Paystack plan for ${planType}:`, err.message);
      }
    }

    res.json(updated);
  });

  // ── GET /api/admin/pricing/history ──────────────────────────────────────────
  app.get('/api/admin/pricing/history', adminAuth, async (_req: Request, res: Response) => {
    const history = await getPricingHistory();
    res.json(history);
  });

  // ── GET /api/admin/stats ────────────────────────────────────────────────────
  app.get('/api/admin/stats', adminAuth, async (_req: Request, res: Response) => {
    const cached = await redis.getCachedAdminStats();
    if (cached) return res.json(cached);

    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE plan = 'premium') as premium_users,
        (SELECT COUNT(*) FROM users WHERE joined_at > NOW() - INTERVAL '24 hours') as new_today,
        (SELECT COUNT(*) FROM attempts WHERE attempted_at > NOW() - INTERVAL '24 hours') as attempts_today,
        (SELECT COUNT(*) FROM attempts) as total_attempts,
        (SELECT COUNT(*) FROM questions WHERE is_active = TRUE) as total_questions,
        (SELECT COUNT(*) FROM flagged_explanations WHERE resolved = false) as pending_flags,
        (SELECT COALESCE(SUM(amount_ngn), 0) FROM subscriptions WHERE status = 'active') as total_revenue_ngn
    `);
    await redis.setCachedAdminStats(rows[0]);
    res.json(rows[0]);
  });

  // ── GET /api/admin/acquisition ───────────────────────────────────────────
  app.get('/api/admin/acquisition', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT COALESCE(source, 'organic') as source, COUNT(*) as users
      FROM users GROUP BY source ORDER BY users DESC
    `);
    res.json(rows);
  });

  // ── GET /api/admin/flags/top-questions ────────────────────────────────────
  app.get('/api/admin/flags/top-questions', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT id, exam_type, subject, year, question_text, flag_count,
             (SELECT COUNT(*) FROM flagged_explanations f WHERE f.question_id = questions.id AND f.resolved = false) as open_flags
      FROM questions
      WHERE flag_count > 0
      ORDER BY flag_count DESC
      LIMIT 20
    `);
    res.json(rows);
  });

  // ── GET /api/admin/flags ────────────────────────────────────────────────────
  app.get('/api/admin/flags', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT f.id, f.flagged_at, f.reason, f.resolved,
             q.id as question_id, q.subject, q.question_text,
             q.correct_option, q.explanation, q.flag_count,
             u.first_name as user_first_name, u.telegram_id as user_telegram_id
      FROM flagged_explanations f
      JOIN questions q ON f.question_id = q.id
      LEFT JOIN users u ON f.user_id = u.id
      WHERE f.resolved = false
      ORDER BY f.flagged_at DESC LIMIT 50
    `);
    res.json(rows);
  });

  // ── POST /api/admin/flags/:id/resolve ──────────────────────────────────────
  app.post('/api/admin/flags/:id/resolve', adminAuth, async (req: Request, res: Response) => {
    const { explanation, question_text } = req.body;
    const { rows: flagRows } = await db.query(
      `SELECT question_id FROM flagged_explanations WHERE id = $1`,
      [req.params.id]
    );
    if (flagRows.length > 0) {
      const qid = flagRows[0].question_id;
      if (explanation !== undefined) {
        await db.query(
          `UPDATE questions SET explanation = $1, explanation_reviewed = true WHERE id = $2`,
          [explanation, qid]
        );
      }
      if (question_text !== undefined) {
        await db.query(`UPDATE questions SET question_text = $1 WHERE id = $2`, [question_text, qid]);
      }
    }
    await db.query(`UPDATE flagged_explanations SET resolved = true WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  });

  // ── GET /api/admin/alerts ────────────────────────────────────────────────────
  app.get('/api/admin/alerts', adminAuth, async (_req: Request, res: Response) => {
    const rows = await db.getUnresolvedAlerts();
    res.json(rows);
  });

  // ── POST /api/admin/alerts/:id/resolve ──────────────────────────────────────
  app.post('/api/admin/alerts/:id/resolve', adminAuth, async (req: Request, res: Response) => {
    await db.resolveAlert(Number(req.params.id));
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
      const search = req.query.search as string;
      const asId = parseInt(search, 10);
      if (!isNaN(asId) && String(asId) === search.trim()) {
        params.push(asId);
        conditions.push(`id = $${params.length}`);
      } else {
        params.push(`%${search}%`);
        const idx = params.length;
        conditions.push(`(question_text ILIKE $${idx} OR source_id ILIKE $${idx})`);
      }
    }
    if (req.query.has_diagram !== undefined) {
      conditions.push(`has_diagram = ${req.query.has_diagram === 'true'}`);
    }
    if (req.query.missing_explanation === 'true') {
      conditions.push(`(explanation IS NULL OR explanation = '')`);
    }
    if (req.query.has_flags === 'true') {
      conditions.push(`flag_count > 0`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    const { rows } = await db.query(
      `SELECT id, exam_type, subject, year, question_text, option_a, option_b, option_c, option_d, option_e,
              correct_option, explanation, explanation_reviewed, flag_count, source_id, has_diagram, is_active, created_at
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
    const {
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      option_e,
      correct_option,
      explanation,
    } = req.body;
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
      [
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        option_e ?? null,
        correct_option,
        explanation ?? null,
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  });

  // ── PATCH /api/admin/questions/:id/active ──────────────────────────────────
  app.patch('/api/admin/questions/:id/active', adminAuth, async (req: Request, res: Response) => {
    try {
      const { is_active } = req.body;
      if (typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active must be boolean' });
      const { rows } = await db.query(
        `UPDATE questions SET is_active = $1 WHERE id = $2 RETURNING id, is_active`,
        [is_active, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Question not found' });
      res.json(rows[0]);
    } catch (err: any) {
      console.error('[toggle-active]', err);
      res.status(500).json({ error: err.message || 'Failed to update question' });
    }
  });

  // ── POST /api/admin/questions/:id/generate-explanation ───────────────────
  app.post('/api/admin/questions/:id/generate-explanation', adminAuth, async (req: Request, res: Response) => {
    try {
      const { rows } = await db.query(`SELECT * FROM questions WHERE id = $1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Question not found' });
      const q = rows[0];

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
      }

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const opts = [`A. ${q.option_a}`, `B. ${q.option_b}`, `C. ${q.option_c}`, `D. ${q.option_d}`];
      if (q.option_e) opts.push(`E. ${q.option_e}`);

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `You are an expert Nigerian secondary school teacher preparing students for WAEC, NECO, and JAMB exams. Explain why the correct answer is right and briefly why each wrong option is incorrect. Write for a 16-18 year old student. 4-7 sentences. Step-by-step for maths/sciences. Never start with "The correct answer is". Plain text only.`,
        messages: [{
          role: 'user',
          content: `Subject: ${q.exam_type} ${q.subject}${q.year ? ` ${q.year}` : ''}\n\nQuestion: ${q.question_text}\n\nOptions:\n${opts.join('\n')}\n\nCorrect answer: ${q.correct_option}\n\nExplain why ${q.correct_option} is correct and why the others are wrong.`,
        }],
      });

      const explanation = (message.content[0] as any).text.trim();
      await db.query(
        `UPDATE questions SET explanation = $1, explanation_reviewed = true WHERE id = $2`,
        [explanation, q.id]
      );
      res.json({ explanation });
    } catch (err: any) {
      console.error('[generate-explanation]', err);
      res.status(500).json({ error: err.message || 'Failed to generate explanation' });
    }
  });

  // ── DELETE /api/admin/questions/:id ────────────────────────────────────────
  app.delete('/api/admin/questions/:id', adminAuth, async (req: Request, res: Response) => {
    const { rows } = await db.query(`DELETE FROM questions WHERE id = $1 RETURNING id`, [
      req.params.id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json({ ok: true, deleted: rows[0].id });
  });

  // ── POST /api/admin/questions/:id/image ────────────────────────────────────
  app.post('/api/admin/questions/:id/image', adminAuth, requireNumericId, diagramUpload.single('image'), async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const ext = ALLOWED_IMAGE_EXT[req.file.mimetype] || '.jpg';
    const imageUrl = `/images/diagrams/q${req.params.id}${ext}`;
    const { rows } = await db.query(
      `UPDATE questions SET image_url = $1, has_diagram = true WHERE id = $2 RETURNING *`,
      [imageUrl, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  });

  // ── DELETE /api/admin/questions/:id/image ──────────────────────────────────
  app.delete('/api/admin/questions/:id/image', adminAuth, async (req: Request, res: Response) => {
    const { rows } = await db.query(`SELECT image_url FROM questions WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    const existing = rows[0].image_url as string | null;
    if (existing) {
      const filePath = path.join(__dirname, '../../public', existing.replace('/images/', ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await db.query(`UPDATE questions SET image_url = NULL WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
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
      conditions.push(
        `(first_name ILIKE $${idx} OR username ILIKE $${idx} OR CAST(telegram_id AS TEXT) ILIKE $${idx})`
      );
    }

    if (req.query.plan === 'premium') conditions.push(`plan = 'premium'`);
    if (req.query.plan === 'free') conditions.push(`plan = 'free'`);
    if (req.query.plan === 'trial') conditions.push(`(plan = 'premium' AND trial_used = TRUE AND plan_expires_at > NOW())`);

    // Filter by who received QOTD / Did You Know on a given day (defaults to today,
    // client always sends an explicit date so "today" means the client's today).
    if ((req.query.sent === 'qotd' || req.query.sent === 'dyk') && req.query.sentDate) {
      params.push(req.query.sentDate);
      const col = req.query.sent === 'qotd' ? 'last_qotd_sent_at' : 'last_dyk_sent_at';
      conditions.push(`${col}::date = $${params.length}::date`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    // streak is only zeroed for real by the midnight-WAT cron (cron.ts) — if that tick
    // gets skipped (e.g. a deploy restarts the process at that exact minute), the raw
    // column stays stale until the user's next answer. Compute the true current value
    // here instead of trusting the column, so the dashboard is never behind that cron.
    const liveStreakExpr = `
      CASE
        WHEN plan = 'premium' AND streak_freeze_used_at = (NOW() + INTERVAL '1 hour')::date THEN streak
        WHEN last_active_date IS NULL THEN 0
        WHEN last_active_date < ((NOW() + INTERVAL '1 hour')::date - INTERVAL '1 day') THEN 0
        ELSE streak
      END`;

    const { rows } = await db.query(
      `SELECT telegram_id, first_name, username, exam_type, subjects,
              plan, plan_expires_at, ${liveStreakExpr} AS streak, joined_at, daily_count,
              last_active_date, phone_number, last_qotd_sent_at, last_dyk_sent_at
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

  // ── DELETE /api/admin/users ─────────────────────────────────────────────────
  app.delete('/api/admin/users', adminAuth, async (req: Request, res: Response) => {
    const { ids, all, search, confirmAll } = req.body;

    if (all) {
      // Wiping the entire users table needs an explicit, unmistakable confirmation
      if (!search && confirmAll !== 'DELETE_ALL_USERS') {
        return res.status(400).json({
          error: 'Deleting all users with no search filter requires { confirmAll: "DELETE_ALL_USERS" } in the request body',
        });
      }
      const conditions: string[] = [];
      const params: any[] = [];
      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(first_name ILIKE $1 OR username ILIKE $1 OR CAST(telegram_id AS TEXT) ILIKE $1)`
        );
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows: targets } = await db.query(`SELECT telegram_id FROM users ${where}`, params);
      await Promise.all(targets.map((r: any) => db.deleteUser(r.telegram_id)));
      return res.json({ ok: true, deleted: targets.length });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    await Promise.all(ids.map((id: any) => db.deleteUser(id)));
    res.json({ ok: true, deleted: ids.length });
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

  // ── GET /api/admin/users/:telegramId/activity ──────────────────────────────
  app.get('/api/admin/users/:telegramId/activity', adminAuth, async (req: Request, res: Response) => {
    const tid = parseInt(req.params.telegramId as string, 10);

    const [summaryRes, subjectsRes, recentRes, weakTopicsRes] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) as total_attempts,
          SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct,
          ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
        FROM attempts a
        JOIN users u ON a.user_id = u.id
        WHERE u.telegram_id = $1
      `, [tid]),
      db.query(`
        SELECT
          q.subject,
          COUNT(*) as attempts,
          SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct,
          ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
        FROM attempts a
        JOIN users u ON a.user_id = u.id
        JOIN questions q ON a.question_id = q.id
        WHERE u.telegram_id = $1
        GROUP BY q.subject
        ORDER BY attempts DESC
      `, [tid]),
      db.query(`
        SELECT
          a.is_correct, a.selected_option, a.attempted_at,
          q.subject, q.year, q.exam_type
        FROM attempts a
        JOIN users u ON a.user_id = u.id
        JOIN questions q ON a.question_id = q.id
        WHERE u.telegram_id = $1
        ORDER BY a.attempted_at DESC
        LIMIT 50
      `, [tid]),
      db.query(`
        SELECT
          q.subject,
          q.topic,
          COUNT(*) as attempts,
          SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct,
          ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy
        FROM attempts a
        JOIN users u ON a.user_id = u.id
        JOIN questions q ON a.question_id = q.id
        WHERE u.telegram_id = $1
          AND q.topic IS NOT NULL AND q.topic != ''
        GROUP BY q.subject, q.topic
        HAVING COUNT(*) >= 3
        ORDER BY accuracy ASC
        LIMIT 15
      `, [tid]),
    ]);

    res.json({
      summary: summaryRes.rows[0] ?? { total_attempts: 0, correct: 0, accuracy: 0 },
      subjects: subjectsRes.rows,
      recent: recentRes.rows,
      weakTopics: weakTopicsRes.rows,
    });
  });

  // ── GET /api/admin/subscriptions ────────────────────────────────────────────
  app.get('/api/admin/subscriptions', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT s.id, s.plan, s.amount_ngn, s.status,
             s.started_at, s.expires_at, s.paystack_tx_ref, s.flutterwave_tx_ref,
             s.is_recurring, s.cancelled_at,
             u.first_name, u.username, u.telegram_id
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.started_at DESC
      LIMIT 200
    `);
    res.json(rows);
  });

  // ── GET /api/admin/analytics ────────────────────────────────────────────────
  app.get('/api/admin/analytics', adminAuth, async (_req: Request, res: Response) => {
    const [dailyResult, subjectsResult, missingExpResult, flaggedResult, weakTopicsResult, dauResult] = await Promise.all([
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
      db.query(
        `SELECT COUNT(*) as count FROM questions WHERE (explanation IS NULL OR explanation = '') AND is_active = TRUE`
      ),
      db.query(`SELECT COUNT(*) as count FROM questions WHERE flag_count > 0`),
      db.query(`
        SELECT
          q.subject,
          q.topic,
          COUNT(a.id) as attempts,
          SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as correct,
          ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id), 0), 1) as accuracy
        FROM attempts a
        JOIN questions q ON a.question_id = q.id
        WHERE q.topic IS NOT NULL AND q.topic != ''
        GROUP BY q.subject, q.topic
        HAVING COUNT(a.id) >= 10
        ORDER BY accuracy ASC
        LIMIT 20
      `),
      db.query(`
        SELECT
          COUNT(DISTINCT CASE WHEN attempted_at >= NOW() - INTERVAL '1 day' THEN user_id END) as dau,
          COUNT(DISTINCT CASE WHEN attempted_at >= NOW() - INTERVAL '7 days' THEN user_id END) as wau,
          COUNT(DISTINCT CASE WHEN attempted_at >= NOW() - INTERVAL '30 days' THEN user_id END) as mau
        FROM attempts
      `),
    ]);

    res.json({
      daily: dailyResult.rows,
      subjects: subjectsResult.rows,
      contentHealth: {
        missing_explanations: parseInt(missingExpResult.rows[0].count),
        flagged_questions: parseInt(flaggedResult.rows[0].count),
      },
      weakTopics: weakTopicsResult.rows,
      engagement: dauResult.rows[0],
    });
  });

  // ── GET /api/admin/analytics/pageviews — in-house landing analytics ────────
  app.get('/api/admin/analytics/pageviews', adminAuth, async (req: Request, res: Response) => {
    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const data = await db.getPageViewAnalytics(days);
    res.json(data);
  });

  // ── GET /api/admin/analytics/hard-questions ────────────────────────────────
  app.get('/api/admin/analytics/hard-questions', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT
        q.id,
        q.exam_type,
        q.subject,
        q.year,
        LEFT(q.question_text, 100) AS question_preview,
        q.correct_option,
        q.explanation IS NOT NULL AND length(q.explanation) > 10 AS has_explanation,
        q.flag_count,
        COUNT(a.id) AS attempts,
        SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) AS correct_count,
        ROUND(100.0 * (1 - SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END)::float / COUNT(a.id)), 1) AS wrong_rate
      FROM questions q
      JOIN attempts a ON a.question_id = q.id
      WHERE q.is_active = TRUE
      GROUP BY q.id
      HAVING COUNT(a.id) >= 10
        AND (1 - SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END)::float / COUNT(a.id)) >= 0.7
      ORDER BY wrong_rate DESC, attempts DESC
      LIMIT 50
    `);
    res.json({ questions: rows });
  });

  // ── GET /api/admin/leaderboard ──────────────────────────────────────────────
  app.get('/api/admin/leaderboard', adminAuth, async (req: Request, res: Response) => {
    const subject = req.query.subject as string | undefined;
    const [entries, { rows: countRows }] = await Promise.all([
      db.getLeaderboard(subject || undefined),
      db.query(
        `SELECT COUNT(DISTINCT a.user_id) as active_users
         FROM attempts a
         WHERE a.attempted_at >= NOW() - INTERVAL '7 days'`
      ),
    ]);
    res.json({ entries, active_users: parseInt(countRows[0].active_users) });
  });

  // ── GET /api/admin/leaderboard/weeks ───────────────────────────────────────
  app.get('/api/admin/leaderboard/weeks', adminAuth, async (_req: Request, res: Response) => {
    const weeks = await db.getSnapshotWeeks();
    res.json({ weeks });
  });

  // ── GET /api/admin/leaderboard/snapshot?week=YYYY-MM-DD ────────────────────
  app.get('/api/admin/leaderboard/snapshot', adminAuth, async (req: Request, res: Response) => {
    const week = req.query.week as string;
    if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      return res.status(400).json({ error: 'week param required (YYYY-MM-DD)' });
    }
    const entries = await db.getLeaderboardSnapshot(week);
    res.json({ entries });
  });

  // ── POST /api/admin/dm ──────────────────────────────────────────────────────
  app.post('/api/admin/dm', adminAuth, async (req: Request, res: Response) => {
    const { telegram_id, message } = req.body;
    if (!telegram_id || !message) {
      return res.status(400).json({ error: 'telegram_id and message are required' });
    }
    try {
      await bot.telegram.sendMessage(telegram_id, message, { parse_mode: 'HTML' });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to send message' });
    }
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

    let whereClause = 'WHERE notifications_enabled = true';
    if (target === 'waec') whereClause += ` AND exam_type = 'WAEC'`;
    else if (target === 'jamb') whereClause += ` AND exam_type = 'JAMB'`;
    else if (target === 'neco') whereClause += ` AND exam_type = 'NECO'`;
    else if (target === 'premium') whereClause += ` AND plan = 'premium'`;
    else if (target === 'free') whereClause += ` AND plan = 'free'`;

    const { rows: users } = await db.query(`SELECT telegram_id FROM users ${whereClause}`);

    let sent = 0;
    let failed = 0;
    const total = users.length;

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegram_id, message, {
          parse_mode: 'HTML',
        });
        sent++;
      } catch (err: any) {
        console.error(`[Broadcast] Failed to send to ${user.telegram_id}:`, err.message);
        failed++;
      }
      // Rate limit: 50ms delay between sends
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await db.query(
      `INSERT INTO broadcast_log (message, target, sent, failed, total) VALUES ($1, $2, $3, $4, $5)`,
      [message, target, sent, failed, total]
    );

    res.json({ sent, failed, total });
  });

  // ── GET /api/admin/broadcast/history ───────────────────────────────────────
  app.get('/api/admin/broadcast/history', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(
      `SELECT id, message, target, sent, failed, total, sent_at
       FROM broadcast_log ORDER BY sent_at DESC LIMIT 50`
    );
    res.json({ history: rows });
  });

  // ── GET /api/admin/analytics/growth ────────────────────────────────────────
  app.get('/api/admin/analytics/growth', adminAuth, async (_req: Request, res: Response) => {
    const [usersResult, revenueResult, examBreakdownResult] = await Promise.all([
      db.query(`
        SELECT
          DATE(joined_at) as date,
          COUNT(*) as new_users,
          COUNT(CASE WHEN plan = 'premium' THEN 1 END) as new_premium
        FROM users
        WHERE joined_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(joined_at)
        ORDER BY date ASC
      `),
      db.query(`
        SELECT
          DATE(started_at) as date,
          COUNT(*) as subs,
          SUM(amount_ngn) as revenue_ngn
        FROM subscriptions
        WHERE started_at >= NOW() - INTERVAL '30 days'
          AND status = 'active'
        GROUP BY DATE(started_at)
        ORDER BY date ASC
      `),
      db.query(`
        SELECT
          COALESCE(exam_type, 'unset') as exam_type,
          COUNT(*) as users,
          COUNT(CASE WHEN plan = 'premium' THEN 1 END) as premium
        FROM users
        GROUP BY exam_type
        ORDER BY users DESC
      `),
    ]);
    res.json({
      userGrowth: usersResult.rows,
      revenueGrowth: revenueResult.rows,
      examBreakdown: examBreakdownResult.rows,
    });
  });

  // ── GET /api/admin/analytics/retention ─────────────────────────────────────
  app.get('/api/admin/analytics/retention', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(`
      WITH cohort AS (
        SELECT id, joined_at::date AS join_date FROM users
        WHERE joined_at >= NOW() - INTERVAL '60 days'
      ),
      activity AS (
        SELECT DISTINCT user_id, attempted_at::date AS active_date FROM attempts
      )
      SELECT
        COUNT(DISTINCT c.id) AS total_users,
        COUNT(DISTINCT CASE
          WHEN a1.active_date >= c.join_date + 1 AND a1.active_date <= c.join_date + 1 THEN c.id
        END) AS d1,
        COUNT(DISTINCT CASE
          WHEN a7.active_date >= c.join_date + 7 AND a7.active_date <= c.join_date + 7 THEN c.id
        END) AS d7,
        COUNT(DISTINCT CASE
          WHEN a30.active_date >= c.join_date + 30 AND a30.active_date <= c.join_date + 30 THEN c.id
        END) AS d30
      FROM cohort c
      LEFT JOIN activity a1 ON a1.user_id = c.id AND a1.active_date = c.join_date + 1
      LEFT JOIN activity a7 ON a7.user_id = c.id AND a7.active_date = c.join_date + 7
      LEFT JOIN activity a30 ON a30.user_id = c.id AND a30.active_date = c.join_date + 30
    `);
    const r = rows[0];
    const total = parseInt(r.total_users) || 1;
    res.json({
      total_users: parseInt(r.total_users),
      d1: parseInt(r.d1),
      d7: parseInt(r.d7),
      d30: parseInt(r.d30),
      d1_rate: Math.round((parseInt(r.d1) / total) * 100),
      d7_rate: Math.round((parseInt(r.d7) / total) * 100),
      d30_rate: Math.round((parseInt(r.d30) / total) * 100),
    });
  });

  // ── GET /api/admin/analytics/funnel ────────────────────────────────────────
  app.get('/api/admin/analytics/funnel', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN plan = 'premium' THEN 1 END) as premium_users,
        COUNT(CASE WHEN plan = 'free' AND last_active_date >= CURRENT_DATE - 7 THEN 1 END) as active_free,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_subs,
        (SELECT COUNT(*) FROM subscriptions
          WHERE status = 'expired' AND expires_at >= NOW() - INTERVAL '30 days') as churned_30d,
        (SELECT COALESCE(SUM(amount_ngn),0) FROM subscriptions
          WHERE status = 'active') as mrr
      FROM users
    `);
    res.json(rows[0]);
  });

  // ── GET /api/admin/users/export ─────────────────────────────────────────────
  app.get('/api/admin/users/export', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT telegram_id, first_name, username, exam_type, plan,
             CASE
               WHEN plan = 'premium' AND streak_freeze_used_at = (NOW() + INTERVAL '1 hour')::date THEN streak
               WHEN last_active_date IS NULL THEN 0
               WHEN last_active_date < ((NOW() + INTERVAL '1 hour')::date - INTERVAL '1 day') THEN 0
               ELSE streak
             END AS streak,
             joined_at, last_active_date, daily_count,
             last_qotd_sent_at, last_dyk_sent_at
      FROM users ORDER BY joined_at DESC
    `);
    const header = 'telegram_id,first_name,username,exam_type,plan,streak,joined_at,last_active_date,daily_count,last_qotd_sent_at,last_dyk_sent_at\n';
    const csv = rows.map(r =>
      [r.telegram_id, `"${(r.first_name||'').replace(/"/g,'""')}"`,
       r.username||'', r.exam_type||'', r.plan, r.streak,
       r.joined_at?.toISOString()||'', r.last_active_date||'', r.daily_count,
       r.last_qotd_sent_at?.toISOString()||'', r.last_dyk_sent_at?.toISOString()||''
      ].join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(header + csv);
  });

  // ── POST /api/admin/questions/bulk-import ───────────────────────────────────
  app.post('/api/admin/questions/bulk-import', adminAuth, async (req: Request, res: Response) => {
    const { questions } = req.body as { questions: any[] };
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions array required' });
    }
    if (questions.length > 500) {
      return res.status(400).json({ error: 'max 500 questions per import' });
    }

    const required = ['exam_type','subject','year','question_text','option_a','option_b','option_c','option_d','correct_option'];
    const validExams = ['WAEC','JAMB','NECO'];
    const validOpts = ['A','B','C','D','E'];

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const row = i + 1;

      const missing = required.filter(f => !q[f]);
      if (missing.length) { errors.push(`Row ${row}: missing ${missing.join(', ')}`); skipped++; continue; }
      if (!validExams.includes(q.exam_type)) { errors.push(`Row ${row}: invalid exam_type '${q.exam_type}'`); skipped++; continue; }
      if (!validOpts.includes(String(q.correct_option).toUpperCase())) { errors.push(`Row ${row}: invalid correct_option`); skipped++; continue; }
      const yr = parseInt(q.year);
      if (isNaN(yr) || yr < 1990 || yr > 2030) { errors.push(`Row ${row}: invalid year`); skipped++; continue; }

      try {
        await db.query(`
          INSERT INTO questions (exam_type, subject, year, topic, question_text, option_a, option_b, option_c, option_d, option_e, correct_option, explanation, is_active)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)
        `, [
          q.exam_type.toUpperCase(), q.subject.toLowerCase(), yr,
          q.topic || null, q.question_text,
          q.option_a, q.option_b, q.option_c, q.option_d, q.option_e || null,
          String(q.correct_option).toUpperCase(), q.explanation || null,
        ]);
        inserted++;
      } catch (err: any) {
        errors.push(`Row ${row}: ${err.message}`);
        skipped++;
      }
    }

    res.json({ inserted, skipped, errors: errors.slice(0, 20) });
  });

  // ── GET /api/admin/qotd ─────────────────────────────────────────────────────
  app.get('/api/admin/qotd', adminAuth, async (_req: Request, res: Response) => {
    const date = new Date(Date.now() + 3600_000).toISOString().split('T')[0];

    const { rows: recentBroadcasts } = await db.query(
      `SELECT q.id, q.exam_type, q.subject, q.year,
              LEFT(q.question_text, 120) as question_preview, q.correct_option
       FROM questions q
       WHERE q.is_active = TRUE AND q.explanation IS NOT NULL AND length(q.explanation) > 20
       ORDER BY RANDOM() LIMIT 3`
    );

    res.json({ date, sample: recentBroadcasts });
  });

  // ── GET /api/admin/analytics/ranks ─────────────────────────────────────────
  app.get('/api/admin/analytics/ranks', adminAuth, async (_req: Request, res: Response) => {
    const { rows } = await db.query(`
      SELECT
        u.telegram_id,
        COUNT(a.id)::int as total_answered
      FROM users u
      LEFT JOIN attempts a ON a.user_id = u.id
      GROUP BY u.telegram_id
    `);

    const tierCounts: Record<string, number> = {
      'Rookie': 0, 'Hustler': 0, 'Grinder': 0,
      'Sharp Guy': 0, 'Odogwu': 0, 'Legend': 0,
    };
    const RANKS = [
      { tier: 'Rookie',    min: 0    }, { tier: 'Rookie',    min: 50   },
      { tier: 'Rookie',    min: 120  }, { tier: 'Rookie',    min: 200  },
      { tier: 'Rookie',    min: 300  }, { tier: 'Hustler',   min: 420  },
      { tier: 'Hustler',   min: 560  }, { tier: 'Hustler',   min: 720  },
      { tier: 'Hustler',   min: 900  }, { tier: 'Hustler',   min: 1100 },
      { tier: 'Grinder',   min: 1320 }, { tier: 'Grinder',   min: 1560 },
      { tier: 'Grinder',   min: 1820 }, { tier: 'Grinder',   min: 2100 },
      { tier: 'Grinder',   min: 2400 }, { tier: 'Sharp Guy', min: 2720 },
      { tier: 'Sharp Guy', min: 3060 }, { tier: 'Sharp Guy', min: 3420 },
      { tier: 'Sharp Guy', min: 3800 }, { tier: 'Sharp Guy', min: 4200 },
      { tier: 'Odogwu',    min: 4620 }, { tier: 'Odogwu',    min: 5060 },
      { tier: 'Odogwu',    min: 5520 }, { tier: 'Odogwu',    min: 6000 },
      { tier: 'Odogwu',    min: 6500 }, { tier: 'Legend',    min: 7020 },
      { tier: 'Legend',    min: 7560 }, { tier: 'Legend',    min: 8120 },
      { tier: 'Legend',    min: 8700 }, { tier: 'Legend',    min: 9300 },
    ];
    const getTier = (n: number) => {
      let t = RANKS[0].tier;
      for (const r of RANKS) { if (n >= r.min) t = r.tier; else break; }
      return t;
    };
    for (const row of rows) {
      const tier = getTier(Number(row.total_answered));
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }
    res.json({ distribution: tierCounts, total: rows.length });
  });

  return app;
}
