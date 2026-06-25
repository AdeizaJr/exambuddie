import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { haptic } from '../telegram';
import type { User, Question } from '../types';
import SubjectPicker, { SUBJECT_LABELS } from '../components/SubjectPicker';
import QuestionCard from '../components/QuestionCard';
import Timer from '../components/Timer';
import LoadingScreen from '../components/LoadingScreen';

type Stage = 'subject' | 'examtype' | 'timer' | 'active' | 'results';

const EXAM_TYPES = ['WAEC', 'JAMB', 'NECO'];
const TIMER_OPTIONS = [
  { label: '10s', secs: 10 },
  { label: '20s', secs: 20 },
  { label: '30s', secs: 30 },
  { label: 'No timer', secs: 0 },
];

const QUIZ_SECS = 45 * 60;

interface Answer { qId: number; selected: string; correct: string; isCorrect: boolean; }

export default function Quiz() {
  const [user, setUser] = useState<User | null>(null);
  const [stage, setStage] = useState<Stage>('subject');
  const [subject, setSubject] = useState('');
  const [examType, setExamType] = useState('');
  const [timerSecs, setTimerSecs] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [overallLeft, setOverallLeft] = useState(QUIZ_SECS);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const overallRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.getMe().then(u => {
      setUser(u);
      if (u.plan !== 'premium') setStage('subject'); // will show paywall below
    }).catch(() => {});
  }, []);

  useEffect(() => () => { if (overallRef.current) clearInterval(overallRef.current); }, []);

  const handleQTimerExpire = useCallback(() => {
    haptic('error');
    const q = questions[qIndex];
    if (q) setAnswers(prev => [...prev, { qId: q.id, selected: '', correct: q.correct_option, isCorrect: false }]);
    setRevealed(true);
  }, [questions, qIndex]);

  async function startQuiz(subj: string, et: string, ts: number) {
    setLoading(true);
    try {
      const { questions: qs, sessionId: sid } = await api.startQuiz({ subject: subj, examType: et });
      setQuestions(qs);
      setSessionId(sid);
      setQIndex(0);
      setAnswers([]);
      setSelected('');
      setRevealed(false);
      setStartTime(Date.now());
      setOverallLeft(QUIZ_SECS);
      setStage('active');

      // Overall countdown
      overallRef.current = setInterval(() => {
        setOverallLeft(prev => {
          if (prev <= 1) {
            if (overallRef.current) clearInterval(overallRef.current);
            finishQuiz(qs, sid, Date.now());
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } finally {
      setLoading(false);
    }
  }

  async function finishQuiz(qs: Question[], sid: string, endTime: number) {
    if (overallRef.current) { clearInterval(overallRef.current); overallRef.current = null; }
    setAnswers(prev => {
      api.completeQuiz({
        sessionId: sid,
        subject,
        answers: prev,
        durationSecs: Math.round((endTime - startTime) / 1000),
      }).catch(() => {});
      return prev;
    });
    setStage('results');
  }

  function handleAnswer(opt: string) {
    if (revealed || !questions[qIndex]) return;
    haptic(opt === questions[qIndex].correct_option ? 'success' : 'error');
    setSelected(opt);
    setRevealed(true);
    const q = questions[qIndex];
    setAnswers(prev => [...prev, { qId: q.id, selected: opt, correct: q.correct_option, isCorrect: opt === q.correct_option }]);
  }

  function handleNext() {
    haptic('light');
    const nextIdx = qIndex + 1;
    if (nextIdx >= questions.length) {
      finishQuiz(questions, sessionId, Date.now());
      return;
    }
    setQIndex(nextIdx);
    setSelected('');
    setRevealed(false);
  }

  if (!user) return <LoadingScreen />;

  // Paywall
  if (user.plan !== 'premium') {
    return (
      <div className="page px-4 pt-10 flex flex-col items-center text-center">
        <span className="text-6xl mb-4">📋</span>
        <h2 className="text-xl font-bold mb-2">Quiz Mode</h2>
        <p className="text-[var(--tg-hint)] mb-6 max-w-xs">
          Get the full exam experience with 40 questions, a 45-minute countdown, and a complete score breakdown.
        </p>
        <div className="bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-2xl p-5 w-full max-w-sm mb-6">
          <p className="font-bold text-lg mb-2">💎 Premium Feature</p>
          <ul className="text-sm text-left space-y-1 opacity-90">
            <li>✅ 40 questions per quiz</li>
            <li>✅ 45-minute countdown timer</li>
            <li>✅ Per-question timers (10/20/30s)</li>
            <li>✅ Full score breakdown</li>
            <li>✅ Choose exam type per session</li>
          </ul>
        </div>
        <p className="text-xs text-[var(--tg-hint)]">Upgrade via /subscribe in the bot</p>
      </div>
    );
  }

  if (loading) return <LoadingScreen message="Loading quiz..." />;

  // Subject picker
  if (stage === 'subject') {
    return (
      <div className="page px-4 pt-6">
        <h2 className="text-lg font-bold mb-1">📋 Quiz Mode</h2>
        <p className="text-sm text-[var(--tg-hint)] mb-5">Choose a subject</p>
        <SubjectPicker subjects={user.subjects} onSelect={s => { haptic('light'); setSubject(s); setStage('examtype'); }} />
      </div>
    );
  }

  // Exam type
  if (stage === 'examtype') {
    return (
      <div className="page px-4 pt-6">
        <h2 className="text-lg font-bold mb-1">🎓 Exam Type</h2>
        <p className="text-sm text-[var(--tg-hint)] mb-5">Which exam are you preparing for?</p>
        <div className="flex flex-col gap-3">
          {EXAM_TYPES.map(et => (
            <button key={et} onClick={() => { haptic('light'); setExamType(et); setStage('timer'); }}
              className="flex items-center gap-4 p-4 bg-white/70 rounded-2xl border border-gray-100 shadow-sm text-left">
              <span className="text-2xl">{et === 'WAEC' ? '🏫' : et === 'JAMB' ? '🎓' : '📝'}</span>
              <p className="font-semibold">{et}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Timer picker
  if (stage === 'timer') {
    return (
      <div className="page px-4 pt-6">
        <h2 className="text-lg font-bold mb-1">⏱️ Per-Question Timer</h2>
        <p className="text-sm text-[var(--tg-hint)] mb-5">Set a time limit per question</p>
        <div className="grid grid-cols-2 gap-3">
          {TIMER_OPTIONS.map(opt => (
            <button key={opt.secs} onClick={() => { haptic('light'); setTimerSecs(opt.secs); startQuiz(subject, examType, opt.secs); }}
              className="p-5 bg-white/70 rounded-2xl border border-gray-100 shadow-sm text-center">
              <p className="text-2xl font-bold text-[var(--tg-button)]">{opt.label}</p>
              {opt.secs > 0 && <p className="text-xs text-[var(--tg-hint)] mt-1">per question</p>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Results
  if (stage === 'results') {
    const correct = answers.filter(a => a.isCorrect).length;
    const acc = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;
    const grade = acc >= 80 ? '🏆 Outstanding!' : acc >= 65 ? '🌟 Excellent!' : acc >= 50 ? '👍 Good effort!' : '💪 Keep practising!';
    return (
      <div className="page px-4 pt-6">
        <h2 className="text-2xl font-bold text-center mb-1">Quiz Complete! 🎉</h2>
        <p className="text-center text-[var(--tg-hint)] mb-6">{grade}</p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatCard label="Score" value={`${correct}/${answers.length}`} />
          <StatCard label="Accuracy" value={`${acc}%`} color={acc >= 60 ? 'text-green-600' : 'text-red-500'} />
          <StatCard label="Subject" value={SUBJECT_LABELS[subject] || subject} />
          <StatCard label="Exam" value={examType} />
        </div>
        <button onClick={() => { setStage('subject'); setAnswers([]); }}
          className="w-full py-3 rounded-2xl font-bold text-[var(--tg-button-text)] mb-3"
          style={{ background: 'var(--tg-button)' }}>
          Take Another Quiz
        </button>
      </div>
    );
  }

  // Active quiz
  const q = questions[qIndex];
  const overallMins = Math.floor(overallLeft / 60);
  const overallSec = overallLeft % 60;

  return (
    <div className="page px-4 pt-4">
      {/* Overall timer */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--tg-hint)]">
          {qIndex + 1} / {questions.length}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${overallLeft < 300 ? 'text-red-500' : 'text-[var(--tg-text)]'}`}>
            ⏱ {overallMins}:{overallSec.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-gray-200 mb-4 overflow-hidden">
        <div className="h-full bg-[var(--tg-button)] rounded-full transition-all"
          style={{ width: `${((qIndex) / questions.length) * 100}%` }} />
      </div>

      {/* Per-question timer — mounts per question, unmounts on reveal (auto-clears interval) */}
      {timerSecs > 0 && !revealed && (
        <div className="mb-4">
          <Timer key={qIndex} totalSecs={timerSecs} label="Question time:" onExpire={handleQTimerExpire} />
        </div>
      )}

      {q && (
        <QuestionCard
          question={q}
          qNum={qIndex + 1}
          total={questions.length}
          selected={selected}
          revealed={revealed}
          onSelect={handleAnswer}
          disabled={revealed}
        />
      )}

      {revealed && (
        <div className="mt-4">
          {qIndex + 1 < questions.length ? (
            <button onClick={handleNext}
              className="w-full py-3 rounded-2xl font-bold text-[var(--tg-button-text)]"
              style={{ background: 'var(--tg-button)' }}>
              Next Question →
            </button>
          ) : (
            <button onClick={() => finishQuiz(questions, sessionId, Date.now())}
              className="w-full py-3 rounded-2xl font-bold text-[var(--tg-button-text)]"
              style={{ background: 'var(--tg-button)' }}>
              See Results 🏆
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white/70 rounded-2xl p-4 border border-gray-100 text-center shadow-sm">
      <p className={`text-lg font-bold ${color || 'text-[var(--tg-text)]'}`}>{value}</p>
      <p className="text-xs text-[var(--tg-hint)]">{label}</p>
    </div>
  );
}
