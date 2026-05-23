import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Stats } from '../types';
import LoadingScreen from '../components/LoadingScreen';
import { SUBJECT_LABELS } from '../components/SubjectPicker';
import { haptic } from '../telegram';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'WAEC', value: 'WAEC' },
  { label: 'JAMB', value: 'JAMB' },
  { label: 'NECO', value: 'NECO' },
];

export default function Stats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getStats(filter || undefined).then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  if (loading) return <LoadingScreen />;

  const accuracy = stats?.accuracy || 0;
  const arcColor = accuracy >= 60 ? '#22c55e' : accuracy >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="page px-4 pt-6">
      <h2 className="text-lg font-bold mb-4">📊 My Stats</h2>

      {/* Exam filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button key={f.value}
            onClick={() => { haptic('selection'); setFilter(f.value); }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.value
                ? 'text-[var(--tg-button-text)]'
                : 'bg-white/70 border border-gray-200 text-[var(--tg-hint)]'
            }`}
            style={filter === f.value ? { background: 'var(--tg-button)' } : {}}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Overall accuracy gauge */}
      <div className="bg-white/70 rounded-2xl p-5 border border-gray-100 shadow-sm mb-4 text-center">
        <AccuracyRing accuracy={accuracy} color={arcColor} />
        <p className="text-sm text-[var(--tg-hint)] mt-2">Overall Accuracy</p>
        <div className="flex justify-center gap-6 mt-4">
          <div>
            <p className="text-lg font-bold text-[var(--tg-text)]">{stats?.total || 0}</p>
            <p className="text-xs text-[var(--tg-hint)]">Attempted</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">{stats?.correct || 0}</p>
            <p className="text-xs text-[var(--tg-hint)]">Correct</p>
          </div>
          <div>
            <p className="text-lg font-bold text-orange-500">{stats?.streak || 0}</p>
            <p className="text-xs text-[var(--tg-hint)]">🔥 Streak</p>
          </div>
        </div>
      </div>

      {/* Subject breakdown */}
      {stats?.subjectStats && stats.subjectStats.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--tg-hint)] uppercase tracking-wider mb-3">
            By Subject
          </h3>
          <div className="flex flex-col gap-2">
            {stats.subjectStats
              .sort((a, b) => b.total - a.total)
              .map(s => (
                <SubjectRow key={s.subject} subject={s.subject} accuracy={s.accuracy} total={s.total} />
              ))}
          </div>
        </div>
      )}

      {/* Weak topics */}
      {stats?.weakTopics && stats.weakTopics.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--tg-hint)] uppercase tracking-wider mb-3">
            Needs Work
          </h3>
          <div className="flex flex-col gap-2">
            {stats.weakTopics.slice(0, 5).map(t => (
              <div key={t.topic} className="flex items-center justify-between bg-white/70 rounded-xl p-3 border border-gray-100">
                <span className="text-sm">{t.topic}</span>
                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full">
                  {t.accuracy}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!stats || stats.total === 0) && (
        <div className="text-center py-12">
          <span className="text-5xl">📭</span>
          <p className="text-[var(--tg-hint)] mt-3">No attempts yet. Start practising!</p>
        </div>
      )}
    </div>
  );
}

function AccuracyRing({ accuracy, color }: { accuracy: number; color: string }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (accuracy / 100) * circ;
  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{accuracy}%</span>
      </div>
    </div>
  );
}

function SubjectRow({ subject, accuracy, total }: { subject: string; accuracy: number; total: number }) {
  const color = accuracy >= 60 ? 'bg-green-500' : accuracy >= 40 ? 'bg-orange-400' : 'bg-red-400';
  return (
    <div className="bg-white/70 rounded-xl p-3 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{SUBJECT_LABELS[subject] || subject}</span>
        <span className="text-xs text-[var(--tg-hint)]">{total} attempts</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${accuracy}%` }} />
        </div>
        <span className={`text-xs font-bold w-9 text-right ${accuracy >= 60 ? 'text-green-600' : accuracy >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
          {accuracy}%
        </span>
      </div>
    </div>
  );
}
