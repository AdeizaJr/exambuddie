import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { User } from '../types';
import LoadingScreen from '../components/LoadingScreen';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;

  const accuracy = user ? Math.round((user.daily_count > 0 ? user.daily_count : 0)) : 0;

  return (
    <div className="page px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--tg-text)]">
            Hey, {user?.first_name || 'there'} 👋
          </h1>
          <p className="text-sm text-[var(--tg-hint)]">Ready to practise?</p>
        </div>
        {user?.plan === 'premium' && (
          <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
            💎 PREMIUM
          </span>
        )}
      </div>

      {/* Streak + stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon="🔥" value={user?.streak || 0} label="Day streak" />
        <StatCard icon="📝" value={user?.daily_count || 0} label="Today" />
        <StatCard icon="🎯" label="Plan" value={user?.plan === 'premium' ? '💎' : 'Free'} isText />
      </div>

      {/* Exam type badge */}
      {user?.exam_type && (
        <div className="mb-6 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-2">
          <span className="text-blue-600">🎓</span>
          <span className="text-sm text-blue-800 font-medium">
            Preparing for {user.exam_type}
          </span>
          <span className="ml-auto text-xs text-blue-500">
            {user.subjects?.length || 0} subject{user.subjects?.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-[var(--tg-hint)] uppercase tracking-wider mb-3">
        Quick Start
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <ActionCard
          icon="📚"
          title="Practice"
          desc="One question at a time"
          color="bg-blue-500"
          onClick={() => nav('/practice')}
        />
        <ActionCard
          icon="📋"
          title="Quiz Mode"
          desc="40 questions, 45 min"
          color="bg-purple-500"
          premium={user?.plan !== 'premium'}
          onClick={() => nav('/quiz')}
        />
        <ActionCard
          icon="🎯"
          title="Topic Drill"
          desc="Focus on weak areas"
          color="bg-green-500"
          onClick={() => nav('/practice?mode=drill')}
        />
        <ActionCard
          icon="📊"
          title="My Stats"
          desc="Track your progress"
          color="bg-orange-500"
          onClick={() => nav('/stats')}
        />
      </div>

      {/* Upgrade banner for free users */}
      {user?.plan !== 'premium' && (
        <div className="rounded-2xl p-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
          <p className="font-bold mb-1">💎 Upgrade to Premium</p>
          <p className="text-sm opacity-90 mb-3">Unlimited questions, quiz mode, per-question timers, and more.</p>
          <button
            onClick={() => nav('/settings')}
            className="bg-white text-purple-600 text-sm font-bold px-4 py-2 rounded-full"
          >
            See Plans →
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, isText }: { icon: string; value: number | string; label: string; isText?: boolean }) {
  return (
    <div className="bg-white/70 rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
      <p className="text-xl">{icon}</p>
      <p className={`font-bold ${isText ? 'text-base' : 'text-lg'} text-[var(--tg-text)]`}>{value}</p>
      <p className="text-xs text-[var(--tg-hint)]">{label}</p>
    </div>
  );
}

function ActionCard({ icon, title, desc, color, onClick, premium }: {
  icon: string; title: string; desc: string; color: string; onClick: () => void; premium?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col gap-1 p-4 rounded-2xl bg-white/70 border border-gray-100 shadow-sm text-left active:scale-95 transition-transform"
    >
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-xl mb-1`}>
        {icon}
      </div>
      <p className="font-semibold text-sm text-[var(--tg-text)]">{title}</p>
      <p className="text-xs text-[var(--tg-hint)]">{desc}</p>
      {premium && (
        <span className="absolute top-2 right-2 text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">
          💎
        </span>
      )}
    </button>
  );
}
