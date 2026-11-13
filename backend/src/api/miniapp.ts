import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';
import * as redis from '../services/redis';
import * as referrals from '../services/referrals';
import { formatExplanation } from '../bot/formatter';

const router = Router();

// Run the bot's explanation formatter server-side so the mini app shows the exact same
// step-split, bolded, LaTeX-converted text bot users see, instead of the raw DB string.
function withExplanationHtml<T extends { explanation?: string | null; subject?: string }>(q: T): T & { explanation_html: string | null } {
  return { ...q, explanation_html: q.explanation ? formatExplanation(q.explanation, q.subject) : null };
}

// A question as handed to the mini app before it's answered: no correct option and no
// explanation. Those only come back from POST /answer, after the server has graded it —
// otherwise any client can read the answer key straight out of the response.
function toUnansweredQuestion<T extends { correct_option?: unknown; explanation?: unknown }>(q: T): Omit<T, 'correct_option' | 'explanation'> {
  const rest: Partial<T> = { ...q };
  delete rest.correct_option;
  delete rest.explanation;
  return rest as Omit<T, 'correct_option' | 'explanation'>;
}

const VALID_OPTIONS = new Set(['A', 'B', 'C', 'D', 'E']);
const MAX_EXCLUDE_IDS = 500;

// ── Auth middleware ────────────────────────────────────────────────────────────
// Telegram re-signs initData every time the mini app opens, so a day is plenty — this
// just stops a copied initData string from working forever.
const INIT_DATA_MAX_AGE_SECS = 24 * 60 * 60;

function validateInitData(initData: string): { id: number } | null {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!BOT_TOKEN) return null; // fail closed: an empty key is a value anyone could reproduce
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
    const expected = crypto.createHmac('sha256', secret).update(checkString).digest();
    const given = Buffer.from(hash, 'hex');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE_SECS) return null;

    const user = JSON.parse(params.get('user') || 'null');
    return user?.id ? { id: user.id } : null;
  } catch {
    return null;
  }
}

// Local-dev login shortcut. Needs BOTH a non-production NODE_ENV AND an explicit opt-in,
// so a missing or mistyped NODE_ENV on a deployed server can't turn it on by itself
// (it would let anyone act as any user just by sending a header).
const DEV_AUTH_ENABLED = process.env.NODE_ENV !== 'production' && process.env.MINIAPP_DEV_AUTH === '1';

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers['authorization'] || '';
  const initData = auth.startsWith('tma ') ? auth.slice(4) : '';

  if (DEV_AUTH_ENABLED && req.headers['x-dev-user-id']) {
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

  // Capped so a huge list can't push the query past Postgres's bind-parameter limit.
  // A real session never gets near this; the most recent ids matter most anyway.
  const excludeArr = excludeIds
    ? String(excludeIds).split(',').map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(-MAX_EXCLUDE_IDS)
    : [];

  const q = await db.getRandomQuestion(
    String(examType),
    String(subject),
    excludeArr,
    year ? parseInt(String(year)) : null,
    topic && topic !== '__all__' ? String(topic) : null,
  );

  if (!q) return res.json(null);
  await redis.markMiniappServed((req as any).telegramId, [q.id]);
  res.json(toUnansweredQuestion(q));
});

// ── POST /api/miniapp/answer ───────────────────────────────────────────────────
// Body: { questionId, selectedOption ('A'-'E', or null/'' when the timer ran out),
//         sessionId?, timeTakenMs? }
// Grades server-side and only then reveals the correct option and explanation.
router.post('/answer', requireAuth, async (req: Request, res: Response) => {
  const { questionId, selectedOption, sessionId, timeTakenMs } = req.body ?? {};
  const user = (req as any).user;
  const telegramId = (req as any).telegramId;

  const qid = Number(questionId);
  if (!Number.isSafeInteger(qid) || qid <= 0) return res.status(400).json({ error: 'questionId required' });
  const selected = selectedOption == null || selectedOption === '' ? '' : String(selectedOption).toUpperCase();
  if (selected && !VALID_OPTIONS.has(selected)) return res.status(400).json({ error: 'selectedOption must be A-E' });

  const check = await db.checkDailyLimit(user);
  if (!check.allowed) return res.status(429).json({ error: 'Daily limit reached', limit: check.limit });

  // Only questions this user was actually served, and each one only once
  if (!(await redis.claimMiniappServed(telegramId, qid))) {
    return res.status(409).json({ error: 'This question has already been answered' });
  }

  const { rows } = await db.query(
    `SELECT correct_option, explanation, subject FROM questions WHERE id = $1`,
    [qid]
  );
  if (!rows.length) return res.status(404).json({ error: 'Question not found' });
  const q = rows[0];
  const isCorrect = selected !== '' && selected === q.correct_option;

  const quizSessionId = typeof sessionId === 'string' ? sessionId.slice(0, 50) : '';
  const ms = Number(timeTakenMs);

  await db.logAttempt({
    userId: user.id,
    questionId: qid,
    selectedOption: selected,
    isCorrect,
    sessionId: quizSessionId || uuidv4(),
    timeTakenMs: Number.isFinite(ms) ? Math.min(Math.max(0, Math.round(ms)), 3_600_000) : 0,
  });
  // Pays the inviter (if any) a Premium day once this user has practised. Fire-and-forget.
  const telegram = req.app.locals.telegram;
  if (telegram) referrals.rewardReferrer(user, telegram);

  if (quizSessionId) {
    const quiz = await redis.getMiniappQuiz(quizSessionId);
    if (quiz && quiz.userId === user.id && quiz.questionIds.includes(qid)) {
      await redis.recordMiniappQuizResult(quizSessionId, qid, isCorrect);
    }
  }

  if (user.plan !== 'premium') {
    await db.incrementDailyCount(telegramId);
    await redis.incrementSubjectUsage(telegramId, q.subject);
  }

  res.json({
    ok: true,
    isCorrect,
    correct: q.correct_option,
    explanation: q.explanation,
    explanation_html: q.explanation ? formatExplanation(q.explanation, q.subject) : null,
  });
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
  const questionIds = questions.map((q) => q.id);
  await redis.saveMiniappQuiz(sessionId, { userId: user.id, questionIds });
  await redis.markMiniappServed((req as any).telegramId, questionIds);
  await db.updateStreak((req as any).telegramId);

  res.json({ questions: questions.map(toUnansweredQuestion), sessionId });
});

// ── POST /api/miniapp/quiz/complete ───────────────────────────────────────────
// Each answer was already graded and logged by POST /answer; this only totals the
// server-side results. Anything the client sends about scores is ignored.
router.post('/quiz/complete', requireAuth, async (req: Request, res: Response) => {
  const { sessionId, durationSecs } = req.body ?? {};
  const user = (req as any).user;
  if (typeof sessionId !== 'string' || !sessionId) return res.status(400).json({ error: 'sessionId required' });

  const quiz = await redis.getMiniappQuiz(sessionId);
  if (!quiz || quiz.userId !== user.id) return res.status(404).json({ error: 'Quiz session not found' });

  const results = await redis.getMiniappQuizResults(sessionId);
  // Unanswered quiz questions can't be answered for credit after the quiz ends
  await redis.forfeitMiniappServed((req as any).telegramId, quiz.questionIds.filter((id) => !(String(id) in results)));

  const values = Object.values(results);
  const correct = values.filter(Boolean).length;
  const total = values.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const secs = Number(durationSecs);

  res.json({ sessionId, correct, total, accuracy, durationSecs: Number.isFinite(secs) ? Math.max(0, Math.round(secs)) : 0 });
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
  await redis.markMiniappServed((req as any).telegramId, questions.map((q) => q.id));
  res.json(questions.map(toUnansweredQuestion));
});

// ── GET /api/miniapp/bookmarks ────────────────────────────────────────────────
// Bookmarks show the answer, so any bookmarked question still waiting to be answered
// is forfeited first — otherwise bookmark-then-peek would leak the key for live questions.
router.get('/bookmarks', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const questions = await db.getUserBookmarks(user.id);
  await redis.forfeitMiniappServed((req as any).telegramId, questions.map((q) => q.id));
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
  // Other students' Telegram ids aren't needed to show a leaderboard, so don't hand them out
  res.json({ entries: entries.map(({ telegram_id: _t, ...e }: any) => e), myRank });
});

export default router;
