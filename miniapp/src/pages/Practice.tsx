import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { haptic } from '../telegram';
import type { User, Question } from '../types';
import SubjectPicker, { SUBJECT_LABELS } from '../components/SubjectPicker';
import QuestionCard from '../components/QuestionCard';
import Timer from '../components/Timer';
import LoadingScreen from '../components/LoadingScreen';

type Stage = 'subject' | 'examtype' | 'timer' | 'topic' | 'question' | 'revealed' | 'done';

const EXAM_TYPES = ['WAEC', 'JAMB', 'NECO'];
const TIMER_OPTIONS = [
  { label: '10s', secs: 10 },
  { label: '20s', secs: 20 },
  { label: '30s', secs: 30 },
  { label: 'No timer', secs: 0 },
];

function randomUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function Practice() {
  const [searchParams] = useSearchParams();
  const isDrill = searchParams.get('mode') === 'drill';

  const [user, setUser] = useState<User | null>(null);
  const [stage, setStage] = useState<Stage>('subject');
  const [subject, setSubject] = useState('');
  const [examType, setExamType] = useState('');
  const [timerSecs, setTimerSecs] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState('');
  const [usedIds, setUsedIds] = useState<number[]>([]);
  const [qNum, setQNum] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [sessionId] = useState(randomUUID);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [weakTopics, setWeakTopics] = useState<{ topic: string; accuracy: number }[]>([]);
  const [drillTopic, setDrillTopic] = useState('');
  const [drillQuestions, setDrillQuestions] = useState<Question[]>([]);
  const [drillIndex, setDrillIndex] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {});
  }, []);

  const handleTimerExpire = useCallback(() => {
    haptic('error');
    setSelected('');
    setTotal(t => t + 1);
    setStage('revealed');
  }, []);

  async function loadQuestion(subj: string, et: string, t: string | null = topic) {
    setLoading(true);
    try {
      const q = await api.getQuestion({ subject: subj, examType: et, excludeIds: usedIds, topic: t });
      if (!q) {
        setStage('done');
        return;
      }
      setQuestion(q);
      setSelected('');
      setBookmarked(false);
      setStage('question');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubject(s: string) {
    haptic('light');
    setSubject(s);
    setTopic(null);

    if (isDrill) {
      api.getWeakTopics(s).then(setWeakTopics);
      return;
    }

    const et = user?.plan === 'premium' ? examType : (user?.exam_type || 'WAEC');
    if (user?.plan !== 'premium') setExamType(et);

    // Fetch topics and show picker if any exist
    const topicList = await api.getTopics(s, et);
    if (topicList.length > 0) {
      setTopics(topicList);
      if (user?.plan === 'premium' && !examType) {
        setStage('examtype');
      } else {
        setStage('topic');
      }
    } else {
      if (user?.plan === 'premium') { setStage('examtype'); }
      else { loadQuestion(s, et, null); }
    }
  }

  function handleExamType(et: string) {
    haptic('light');
    setExamType(et);
    // Fetch topics after exam type is chosen
    api.getTopics(subject, et).then(topicList => {
      if (topicList.length > 0) { setTopics(topicList); setStage('topic'); }
      else { setStage('timer'); }
    });
  }

  function handleTopic(t: string | null) {
    haptic('light');
    setTopic(t);
    if (user?.plan === 'premium') { setStage('timer'); }
    else { loadQuestion(subject, examType || user?.exam_type || 'WAEC', t); }
  }

  function handleTimer(secs: number) {
    haptic('light');
    setTimerSecs(secs);
    loadQuestion(subject, examType, topic);
  }

  async function handleAnswer(opt: string) {
    if (stage !== 'question' || !question) return;
    haptic(opt === question.correct_option ? 'success' : 'error');
    setSelected(opt);
    setStage('revealed');
    const isCorrect = opt === question.correct_option;
    if (isCorrect) setCorrect(c => c + 1);
    setTotal(t => t + 1);
    setUsedIds(ids => [...ids, question.id]);
    await api.submitAnswer({
      questionId: question.id,
      selectedOption: opt,
      sessionId,
      timeTakenMs: 0,
      subject,
    }).catch(() => {});
  }

  function handleNext() {
    haptic('light');
    setQNum(n => n + 1);
    if (isDrill && drillQuestions.length > 0) {
      const next = drillIndex + 1;
      if (next >= drillQuestions.length) { setStage('done'); return; }
      setDrillIndex(next);
      setQuestion(drillQuestions[next]);
      setSelected('');
      setStage('question');
    } else {
      loadQuestion(subject, examType);
    }
  }

  async function handleDrillTopic(topic: string) {
    haptic('light');
    setDrillTopic(topic);
    setLoading(true);
    try {
      const qs = await api.getDrillQuestions(subject, topic);
      if (!qs.length) return;
      setDrillQuestions(qs);
      setDrillIndex(0);
      setQuestion(qs[0]);
      setStage('question');
    } finally { setLoading(false); }
  }

  if (!user) return <LoadingScreen />;
  if (loading) return <LoadingScreen message="Getting question..." />;

  // ── Drill topic picker ──────────────────────────────────────────────────────
  if (isDrill && stage === 'subject' && subject && weakTopics.length > 0 && !drillTopic) {
    return (
      <div className="page px-4 pt-6">
        <h1 className="text-lg font-bold mb-1">🎯 Topic Drill</h1>
        <p className="text-sm text-[var(--tg-hint)] mb-5">Your weakest topics in {SUBJECT_LABELS[subject] || subject}</p>
        <div className="flex flex-col gap-3">
          {weakTopics.map(t => (
            <button key={t.topic} onClick={() => handleDrillTopic(t.topic)}
              className="flex items-center justify-between p-4 bg-white/70 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-sm font-medium">{t.topic}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${t.accuracy < 40 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                {t.accuracy}%
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Subject picker ──────────────────────────────────────────────────────────
  if (stage === 'subject') {
    return (
      <div className="page px-4 pt-6">
        <h1 className="text-lg font-bold mb-1">{isDrill ? '🎯 Topic Drill' : '📚 Practice'}</h1>
        <p className="text-sm text-[var(--tg-hint)] mb-5">Choose a subject to start</p>
        <SubjectPicker subjects={user.subjects} onSelect={handleSubject} />
      </div>
    );
  }

  // ── Exam type picker ────────────────────────────────────────────────────────
  if (stage === 'examtype') {
    return (
      <div className="page px-4 pt-6">
        <h1 className="text-lg font-bold mb-1">🎓 Exam Type</h1>
        <p className="text-sm text-[var(--tg-hint)] mb-5">Which exam are you preparing for?</p>
        <div className="flex flex-col gap-3">
          {EXAM_TYPES.map(et => (
            <button key={et} onClick={() => handleExamType(et)}
              className="flex items-center gap-4 p-4 bg-white/70 rounded-2xl border border-gray-100 shadow-sm text-left">
              <span className="text-2xl">{et === 'WAEC' ? '🏫' : et === 'JAMB' ? '🎓' : '📝'}</span>
              <div>
                <p className="font-semibold">{et}</p>
                <p className="text-xs text-[var(--tg-hint)]">
                  {et === 'WAEC' ? 'West African Examinations Council' : et === 'JAMB' ? 'Joint Admissions Board' : 'National Examinations Council'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Topic picker ─────────────────────────────────────────────────────────────
  if (stage === 'topic') {
    return (
      <div className="page px-4 pt-6">
        <h1 className="text-lg font-bold mb-1">🎯 Choose Topic</h1>
        <p className="text-sm text-[var(--tg-hint)] mb-5">
          {SUBJECT_LABELS[subject] || subject} — pick a topic or practise all
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleTopic(null)}
            className="flex items-center gap-4 p-4 bg-white/70 rounded-2xl border-2 border-[var(--tg-button)] shadow-sm text-left"
          >
            <span className="text-2xl">📚</span>
            <div>
              <p className="font-semibold text-[var(--tg-button)]">All Topics</p>
              <p className="text-xs text-[var(--tg-hint)]">Mix of everything</p>
            </div>
          </button>
          {topics.map(t => (
            <button key={t} onClick={() => handleTopic(t)}
              className="flex items-center gap-4 p-4 bg-white/70 rounded-2xl border border-gray-100 shadow-sm text-left">
              <span className="text-2xl">🎯</span>
              <p className="font-medium text-sm">{t}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Timer picker ────────────────────────────────────────────────────────────
  if (stage === 'timer') {
    return (
      <div className="page px-4 pt-6">
        <h1 className="text-lg font-bold mb-1">⏱️ Per-Question Timer</h1>
        <p className="text-sm text-[var(--tg-hint)] mb-5">How long per question?</p>
        <div className="grid grid-cols-2 gap-3">
          {TIMER_OPTIONS.map(opt => (
            <button key={opt.secs} onClick={() => handleTimer(opt.secs)}
              className="p-5 bg-white/70 rounded-2xl border border-gray-100 shadow-sm text-center">
              <p className="text-2xl font-bold text-[var(--tg-button)]">{opt.label}</p>
              {opt.secs > 0 && <p className="text-xs text-[var(--tg-hint)] mt-1">per question</p>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  if (stage === 'done') {
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="page px-4 pt-10 flex flex-col items-center text-center">
        <span className="text-6xl mb-4">{acc >= 70 ? '🏆' : acc >= 50 ? '👍' : '💪'}</span>
        <h1 className="text-2xl font-bold mb-2">Session Complete</h1>
        <p className="text-[var(--tg-hint)] mb-6">You answered {total} question{total !== 1 ? 's' : ''}</p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
          <div className="bg-white/70 rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-green-600">{correct}</p>
            <p className="text-xs text-[var(--tg-hint)]">Correct</p>
          </div>
          <div className="bg-white/70 rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-[var(--tg-button)]">{acc}%</p>
            <p className="text-xs text-[var(--tg-hint)]">Accuracy</p>
          </div>
        </div>
        <button onClick={() => { setStage('subject'); setUsedIds([]); setQNum(1); setCorrect(0); setTotal(0); setTopic(null); setTopics([]); }}
          className="w-full max-w-xs py-3 rounded-2xl font-bold text-[var(--tg-button-text)]"
          style={{ background: 'var(--tg-button)' }}>
          New Session
        </button>
      </div>
    );
  }

  // ── Active question ─────────────────────────────────────────────────────────
  return (
    <div className="page px-4 pt-4">
      {/* Timer bar — mounts per question, unmounts on reveal (auto-clears interval) */}
      {timerSecs > 0 && stage === 'question' && (
        <div className="mb-4">
          <Timer
            key={question?.id}
            totalSecs={timerSecs}
            label="Time left:"
            onExpire={handleTimerExpire}
          />
        </div>
      )}

      {question && (
        <QuestionCard
          question={question}
          qNum={qNum}
          total="?"
          selected={selected}
          revealed={stage === 'revealed'}
          onSelect={handleAnswer}
          disabled={stage === 'revealed'}
        />
      )}

      {/* Action row after reveal */}
      {stage === 'revealed' && (
        <div className="mt-4 flex gap-3">
          <button onClick={handleNext}
            className="flex-1 py-3 rounded-2xl font-bold text-[var(--tg-button-text)]"
            style={{ background: 'var(--tg-button)' }}>
            Next Question →
          </button>
          <button
            onClick={async () => {
              if (!question) return;
              haptic('selection');
              const next = !bookmarked;
              setBookmarked(next);
              try {
                if (next) await api.addBookmark(question.id);
                else await api.removeBookmark(question.id);
              } catch { setBookmarked(!next); }
            }}
            className="px-4 py-3 rounded-2xl font-medium border text-base transition-colors"
            style={bookmarked ? { background: '#FFF7ED', border: '1.5px solid #FB923C', color: '#EA580C' } : { border: '1.5px solid rgba(0,0,0,0.12)', color: 'var(--tg-hint)' }}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
            aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
            aria-pressed={bookmarked}
          >
            {bookmarked ? '🔖' : '☆'}
          </button>
          <button onClick={() => setStage('done')}
            className="px-4 py-3 rounded-2xl font-medium border border-gray-200 text-[var(--tg-hint)]">
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
