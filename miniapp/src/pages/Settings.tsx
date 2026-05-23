import { useState, useEffect } from 'react';
import { api } from '../api';
import type { User } from '../types';
import LoadingScreen from '../components/LoadingScreen';
import { haptic } from '../telegram';
import { SUBJECT_LABELS } from '../components/SubjectPicker';

const ALL_SUBJECTS = [
  'math', 'english', 'biology', 'chemistry', 'physics', 'geography',
  'economics', 'government', 'accounts', 'commerce', 'crk', 'irk',
  'literature', 'agric', 'further-math', 'data-processing', 'computer', 'pe',
];

const EXAM_TYPES = ['WAEC', 'JAMB', 'NECO'];

export default function Settings() {
  const [user, setUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {});
  }, []);

  async function saveProfile(update: { exam_type?: string; subjects?: string[] }) {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile(update);
      setUser(updated);
      haptic('success');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      haptic('error');
    } finally { setSaving(false); }
  }

  function toggleSubject(s: string) {
    if (!user) return;
    haptic('selection');
    const current = user.subjects || [];
    const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
    if (next.length === 0) return; // need at least one
    setUser({ ...user, subjects: next });
    saveProfile({ subjects: next });
  }

  if (!user) return <LoadingScreen />;

  const expiry = user.plan_expires_at ? new Date(user.plan_expires_at).toLocaleDateString('en-NG') : null;

  return (
    <div className="page px-4 pt-6">
      <h2 className="text-lg font-bold mb-5">⚙️ Settings</h2>

      {/* Profile card */}
      <div className="bg-white/70 rounded-2xl p-4 border border-gray-100 shadow-sm mb-5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[var(--tg-button)] flex items-center justify-center text-white font-bold text-lg">
          {user.first_name[0]}
        </div>
        <div>
          <p className="font-semibold text-[var(--tg-text)]">{user.first_name}</p>
          {user.username && <p className="text-sm text-[var(--tg-hint)]">@{user.username}</p>}
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${
          user.plan === 'premium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {user.plan === 'premium' ? '💎 Premium' : 'Free'}
        </span>
      </div>

      {/* Subscription info */}
      {user.plan === 'premium' && expiry && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-800">
          💎 Premium active — expires {expiry}
        </div>
      )}
      {user.plan !== 'premium' && (
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl p-4 mb-5 text-white">
          <p className="font-bold mb-1">Upgrade to Premium</p>
          <p className="text-sm opacity-90 mb-3">Unlock quiz mode, timers, unlimited questions & more.</p>
          <p className="text-xs opacity-75">Use /subscribe in the ExamAce bot to upgrade.</p>
        </div>
      )}

      {/* Exam type */}
      <Section title="Exam Type">
        <div className="flex gap-2 flex-wrap">
          {EXAM_TYPES.map(et => (
            <button key={et}
              onClick={() => saveProfile({ exam_type: et })}
              disabled={saving}
              className={`px-5 py-2.5 rounded-full font-medium text-sm transition-colors ${
                user.exam_type === et
                  ? 'text-[var(--tg-button-text)]'
                  : 'bg-white/70 border border-gray-200 text-[var(--tg-text)]'
              }`}
              style={user.exam_type === et ? { background: 'var(--tg-button)' } : {}}>
              {et}
            </button>
          ))}
        </div>
      </Section>

      {/* Subjects */}
      <Section title={`Subjects (${user.subjects?.length || 0} selected)`}>
        <div className="grid grid-cols-2 gap-2">
          {ALL_SUBJECTS.map(s => {
            const active = user.subjects?.includes(s);
            return (
              <button key={s}
                onClick={() => toggleSubject(s)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors text-left ${
                  active
                    ? 'border-[var(--tg-button)] bg-blue-50 text-[var(--tg-button)]'
                    : 'border-gray-200 bg-white/60 text-[var(--tg-text)]'
                }`}>
                {active ? '✓ ' : ''}{SUBJECT_LABELS[s] || s}
              </button>
            );
          })}
        </div>
      </Section>

      {saved && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-5 py-2 rounded-full text-sm font-medium shadow-lg animate-fade-in">
          ✓ Saved
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-[var(--tg-hint)] uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}
