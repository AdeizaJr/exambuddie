import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Question } from '../types';
import LoadingScreen from '../components/LoadingScreen';
import { haptic } from '../telegram';

export default function Bookmarks() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    api.getBookmarks().then(setQuestions).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleRemove(q: Question) {
    haptic('medium');
    setRemoving(q.id);
    try {
      await api.removeBookmark(q.id);
      setQuestions(prev => prev.filter(x => x.id !== q.id));
    } catch {
      // ignore
    } finally {
      setRemoving(null);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="page pb-24">
      <div className="px-4 pt-8 pb-4">
        <button onClick={() => nav(-1)} className="text-blue-600 text-sm mb-4">← Back</button>
        <h1 className="text-2xl font-extrabold text-[var(--tg-text)]">Saved Questions</h1>
        <p className="text-sm text-[var(--tg-hint)] mt-1">{questions.length} bookmarked</p>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-5xl mb-4">🔖</p>
          <p className="text-base font-semibold text-[var(--tg-text)] mb-2">No bookmarks yet</p>
          <p className="text-sm text-[var(--tg-hint)]">Tap the bookmark icon after answering a question to save it here.</p>
          <button
            onClick={() => nav('/practice')}
            className="mt-5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-full"
          >
            Start Practising
          </button>
        </div>
      ) : (
        <div className="px-4 flex flex-col gap-3">
          {questions.map(q => (
            <div
              key={q.id}
              className="rounded-2xl p-4"
              style={{ background: 'var(--tg-bg)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[10px] font-semibold text-[var(--tg-hint)] bg-gray-100 px-2 py-0.5 rounded-full">
                  {q.exam_type} {q.subject} {q.year}
                </span>
                <button
                  onClick={() => handleRemove(q)}
                  disabled={removing === q.id}
                  className="text-red-400 text-xs font-medium flex-shrink-0 hover:text-red-600 transition-colors"
                >
                  {removing === q.id ? '…' : 'Remove'}
                </button>
              </div>
              <p className="text-sm text-[var(--tg-text)] leading-relaxed line-clamp-3">{q.question_text}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">
                  {q.correct_option}
                </span>
                <span className="text-xs text-[var(--tg-hint)]">correct answer</span>
              </div>
              {q.explanation && (
                <p className="mt-2 text-xs text-[var(--tg-hint)] leading-relaxed line-clamp-2 italic">{q.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
