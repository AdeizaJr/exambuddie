import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';
import * as redis from '../services/redis';

const router = Router();

// ── Auth middleware ────────────────────────────────────────────────────────────
function validateInitData(initData: string): { id: number } | null {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (expected !== hash) return null;

    const user = JSON.parse(params.get('user') || 'null');
    return user?.id ? { id: user.id } : null;
  } catch {
    return null;
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers['authorization'] || '';
  const initData = auth.startsWith('tma ') ? auth.slice(4) : '';

  // In dev mode, allow a fake initData with just user id
  if (process.env.NODE_ENV !== 'production' && req.headers['x-dev-user-id']) {
    (req as any).telegramId = parseInt(req.headers['x-dev-user-id'] as string);
    return next();
  }

  const parsed = validateInitData(initData);
  if (!parsed) return res.status(401).json({ error: 'Unauthorized' });
  (req as any).telegramId = parsed.id;
  next();
}

// ── GET /api/miniapp/me ────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ── PUT /api/miniapp/me ────────────────────────────────────────────────────────
router.put('/me', requireAuth, async (req: Request, res: Response) => {
  const { exam_type, subjects } = req.body;
  const telegramId = (req as any).telegramId;

  if (exam_type) {
    await db.query(`UPDATE users SET exam_type = $1 WHERE telegram_id = $2`, [exam_type, telegramId]);
  }
  if (subjects && Array.isArray(subjects) && subjects.length > 0) {
    await db.query(`UPDATE users SET subjects = $1 WHERE telegram_id = $2`, [subjects, telegramId]);
  }

  const user = await db.getUser(telegramId);
  res.json(user);
});

// ── GET /api/miniapp/limit ─────────────────────────────────────────────────────
router.get('/limit', requireAuth, async (req: Request, res: Response) => {
  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const check = await db.checkDailyLimit(user);
  res.json({ allowed: check.allowed, used: user.daily_count || 0, limit: check.limit });
});

// ── GET /api/miniapp/question ──────────────────────────────────────────────────
router.get('/question', requireAuth, async (req: Request, res: Response) => {
  const { subject, examType, year, excludeIds, topic } = req.query;
  if (!subject || !examType) return res.status(400).json({ error: 'subject and examType required' });

  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const check = await db.checkDailyLimit(user);
  if (!check.allowed) return res.status(429).json({ error: 'Daily limit reached', limit: check.limit });

  const excludeArr = excludeIds
    ? String(excludeIds).split(',').map(Number).filter(Boolean)
    : [];

  const q = await db.getRandomQuestion(
    String(examType),
    String(subject),
    excludeArr,
    year ? parseInt(String(year)) : null,
    topic && topic !== '__all__' ? String(topic) : null,
  );

  res.json(q || null);
});

// ── POST /api/miniapp/answer ───────────────────────────────────────────────────
router.post('/answer', requireAuth, async (req: Request, res: Response) => {
  const { questionId, selectedOption, sessionId, timeTakenMs, subject } = req.body;
  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const [{ rows }] = await Promise.all([
    db.query(`SELECT correct_option FROM questions WHERE id = $1`, [questionId]),
  ]);

  if (!rows.length) return res.status(404).json({ error: 'Question not found' });

  const isCorrect = selectedOption === rows[0].correct_option;

  await db.logAttempt({
    userId: user.id,
    questionId,
    selectedOption,
    isCorrect,
    sessionId: sessionId || uuidv4(),
    timeTakenMs: timeTakenMs || 0,
  });

  if (user.plan !== 'premium') {
    await db.incrementDailyCount((req as any).telegramId);
    if (subject) await redis.incrementSubjectUsage((req as any).telegramId, subject);
  }

  res.json({ ok: true, isCorrect, correct: rows[0].correct_option });
});

// ── GET /api/miniapp/stats ─────────────────────────────────────────────────────
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const examType = req.query.examType ? String(req.query.examType) : undefined;

  const [statsRaw, subjectStatsRaw, weakTopicsRaw] = await Promise.all([
    db.getUserStats(user.id, examType),
    db.getSubjectStats(user.id, examType),
    db.getWeakTopics(user.id, user.subjects?.[0] || '', examType),
  ]);

  res.json({
    total: Number(statsRaw.total_attempts),
    correct: Number(statsRaw.correct),
    accuracy: Number(statsRaw.accuracy),
    streak: user.streak,
    subjectStats: subjectStatsRaw,
    weakTopics: weakTopicsRaw,
  });
});

// ── POST /api/miniapp/quiz/start ───────────────────────────────────────────────
router.post('/quiz/start', requireAuth, async (req: Request, res: Response) => {
  const { subject, examType } = req.body;
  if (!subject || !examType) return res.status(400).json({ error: 'subject and examType required' });

  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.plan !== 'premium') return res.status(403).json({ error: 'Premium required' });

  const questions = await db.getQuizQuestions(examType, subject, 40);
  if (questions.length < 5) return res.status(404).json({ error: 'Not enough questions available' });

  const sessionId = uuidv4();
  await db.updateStreak((req as any).telegramId);

  res.json({ questions, sessionId });
});

// ── POST /api/miniapp/quiz/complete ───────────────────────────────────────────
router.post('/quiz/complete', requireAuth, async (req: Request, res: Response) => {
  const { sessionId, answers, durationSecs } = req.body;
  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Bulk log attempts
  if (Array.isArray(answers)) {
    await Promise.all(
      answers
        .filter((a: any) => a.selected)
        .map((a: any) =>
          db.logAttempt({
            userId: user.id,
            questionId: a.qId,
            selectedOption: a.selected,
            isCorrect: a.isCorrect,
            sessionId,
          }).catch(() => {})
        )
    );
  }

  const correct = answers?.filter((a: any) => a.isCorrect).length || 0;
  const total = answers?.length || 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  res.json({ sessionId, correct, total, accuracy, durationSecs });
});

// ── GET /api/miniapp/topics ────────────────────────────────────────────────────
router.get('/topics', requireAuth, async (req: Request, res: Response) => {
  const { subject, examType } = req.query;
  if (!subject) return res.status(400).json({ error: 'subject required' });
  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const et = String(examType || user.exam_type || 'ALL');
  const topics = await db.getTopicsForSubject(et, String(subject));
  res.json(topics);
});

// ── GET /api/miniapp/weak-topics ───────────────────────────────────────────────
router.get('/weak-topics', requireAuth, async (req: Request, res: Response) => {
  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const subject = String(req.query.subject || user.subjects?.[0] || '');
  const topics = await db.getWeakTopics(user.id, subject);
  res.json(topics);
});

// ── GET /api/miniapp/drill ─────────────────────────────────────────────────────
router.get('/drill', requireAuth, async (req: Request, res: Response) => {
  const { subject, topic } = req.query;
  if (!subject || !topic) return res.status(400).json({ error: 'subject and topic required' });

  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const questions = await db.getQuestionsByTopic(user.exam_type || '', String(subject), String(topic), 10);
  res.json(questions);
});

export default router;
