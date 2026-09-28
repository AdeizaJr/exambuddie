import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';
import * as redis from '../services/redis';
import { formatExplanation } from '../bot/formatter';

const router = Router();

// Run the bot's explanation formatter server-side so the mini app shows the exact same
// step-split, bolded, LaTeX-converted text bot users see, instead of the raw DB string.
function withExplanationHtml<T extends { explanation?: string | null; subject?: string }>(q: T): T & { explanation_html: string | null } {
  return { ...q, explanation_html: q.explanation ? formatExplanation(q.explanation, q.subject) : null };
}

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
  } else {
    const parsed = validateInitData(initData);
    if (!parsed) return res.status(401).json({ error: 'Unauthorized' });
    (req as any).telegramId = parsed.id;
  }

  // Eager-fetch and cache user on req — eliminates duplicate getUser() calls per request
  const user = await db.getUser((req as any).telegramId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  (req as any).user = user;
  next();
}

// ── GET /api/miniapp/me ────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json((req as any).user);
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
  const user = (req as any).user;
  const check = await db.checkDailyLimit(user);
  res.json({ allowed: check.allowed, used: user.daily_count || 0, limit: check.limit });
});

// ── GET /api/miniapp/question ──────────────────────────────────────────────────
router.get('/question', requireAuth, async (req: Request, res: Response) => {
  const { subject, examType, year, excludeIds, topic } = req.query;
  if (!subject || !examType) return res.status(400).json({ error: 'subject and examType required' });

  const user = (req as any).user;
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

  res.json(q ? withExplanationHtml(q) : null);
});

// ── POST /api/miniapp/answer ───────────────────────────────────────────────────
router.post('/answer', requireAuth, async (req: Request, res: Response) => {
  const { questionId, selectedOption, sessionId, timeTakenMs, subject } = req.body;
  const user = (req as any).user;

  const { rows } = await db.query(`SELECT correct_option FROM questions WHERE id = $1`, [questionId]);
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
  const user = (req as any).user;
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

  const user = (req as any).user;
  if (user.plan !== 'premium') return res.status(403).json({ error: 'Premium required' });

  const questions = await db.getQuizQuestions(examType, subject, 40);
  if (questions.length < 5) return res.status(404).json({ error: 'Not enough questions available' });

  const sessionId = uuidv4();
  await db.updateStreak((req as any).telegramId);

  res.json({ questions: questions.map(withExplanationHtml), sessionId });
});

// ── POST /api/miniapp/quiz/complete ───────────────────────────────────────────
router.post('/quiz/complete', requireAuth, async (req: Request, res: Response) => {
  const { sessionId, answers, durationSecs } = req.body;
  const user = (req as any).user;

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
  const user = (req as any).user;
  const et = examType ? String(examType) : (user.exam_type || 'ALL');
  const topics = await db.getTopicsForSubject(et, String(subject));
  res.json(topics);
});

// ── GET /api/miniapp/weak-topics ───────────────────────────────────────────────
router.get('/weak-topics', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const subject = String(req.query.subject || user.subjects?.[0] || '');
  const topics = await db.getWeakTopics(user.id, subject);
  res.json(topics);
});

// ── GET /api/miniapp/drill ─────────────────────────────────────────────────────
router.get('/drill', requireAuth, async (req: Request, res: Response) => {
  const { subject, topic } = req.query;
  if (!subject || !topic) return res.status(400).json({ error: 'subject and topic required' });

  const user = (req as any).user;
  const questions = await db.getQuestionsByTopic(user.exam_type || '', String(subject), String(topic), 10);
  res.json(questions.map(withExplanationHtml));
});

// ── GET /api/miniapp/bookmarks ────────────────────────────────────────────────
router.get('/bookmarks', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const questions = await db.getUserBookmarks(user.id);
  res.json(questions.map(withExplanationHtml));
});

// ── POST /api/miniapp/bookmarks/:questionId ───────────────────────────────────
router.post('/bookmarks/:questionId', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  await db.addBookmark(user.id, parseInt(String(req.params.questionId)));
  res.json({ ok: true });
});

// ── DELETE /api/miniapp/bookmarks/:questionId ─────────────────────────────────
router.delete('/bookmarks/:questionId', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  await db.removeBookmark(user.id, parseInt(String(req.params.questionId)));
  res.json({ ok: true });
});

// ── POST /api/miniapp/explanation-feedback/:questionId ────────────────────────
router.post('/explanation-feedback/:questionId', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const questionId = parseInt(String(req.params.questionId), 10);
  const { rating } = req.body;
  if (!questionId || (rating !== 1 && rating !== -1)) return res.status(400).json({ error: 'questionId and rating (1 or -1) required' });
  await db.saveExplanationFeedback(user.id, questionId, rating);
  res.json({ ok: true });
});

// ── GET /api/miniapp/bookmarks/:questionId/check ──────────────────────────────
router.get('/bookmarks/:questionId/check', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const bookmarked = await db.isBookmarked(user.id, parseInt(String(req.params.questionId)));
  res.json({ bookmarked });
});

// ── GET /api/miniapp/leaderboard ──────────────────────────────────────────────
router.get('/leaderboard', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const [entries, myRank] = await Promise.all([
    db.getLeaderboard(),
    db.getLeaderboardRank(user.id),
  ]);
  res.json({ entries, myRank });
});

export default router;
