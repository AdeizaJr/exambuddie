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

  return (
    <div className="page">
      {/* Gradient header */}
      <div
        className="px-5 pt-10 pb-6"
        style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-0.5">Welcome back 👋</p>
            <h1 className="text-white text-2xl font-extrabold tracking-tight">
              {user?.first_name || 'Hey there'}
            </h1>
          </div>
          {user?.plan === 'premium' ? (
            <span className="mt-1 px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full border border-white/30">
              💎 Premium
            </span>
          ) : (
            <span className="mt-1 px-3 py-1 bg-white/15 text-blue-100 text-xs font-medium rounded-full border border-white/20">
              Free
            </span>
          )}
        </div>

        {/* Exam badge */}
        {user?.exam_type && (
          <div className="inline-flex items-center gap-1.5 bg-white/15 border border-white/25 rounded-full px-3 py-1">
            <span className="text-white text-xs font-medium">🎓 Preparing for {user.exam_type}</span>
            <span className="text-blue-200 text-xs">· {user.subjects?.length || 0} subjects</span>
          </div>
        )}

        {/* Stat strip */}
        <div className="flex gap-3 mt-5">
          <StatChip icon="🔥" value={user?.streak || 0} label="Day streak" />
          <StatChip icon="📝" value={user?.daily_count || 0} label="Today" />
          <StatChip icon="⚡" value={user?.plan === 'premium' ? '∞' : '5/6h'} label="Limit" />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-5">
        <p className="text-xs font-semibold text-[var(--tg-hint)] uppercase tracking-wider mb-3">
          Quick Start
        </p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <ActionCard
            icon="📚"
            iconBg="bg-blue-500"
            title="Practice"
            desc="Your pace, instant hints"
            onClick={() => nav('/practice')}
          />
          <ActionCard
            icon="📋"
            iconBg="bg-violet-500"
            title="Quiz Mode"
            desc="40 questions · 45 min"
            badge={user?.plan !== 'premium' ? '💎' : undefined}
            onClick={() => nav('/quiz')}
          />
          <ActionCard
            icon="🎯"
            iconBg="bg-emerald-500"
            title="Drill"
            desc="Target weak topics"
            onClick={() => nav('/practice?mode=drill')}
          />
          <ActionCard
            icon="📊"
            iconBg="bg-orange-500"
            title="My Stats"
            desc="Track your progress"
            onClick={() => nav('/stats')}
          />
        </div>

        {/* Upgrade banner */}
        {user?.plan !== 'premium' && (
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-white font-bold text-base mb-1">💎 Go Premium</p>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Unlimited questions, quiz mode, timed drills & weekly reports.
                </p>
              </div>
            </div>
            <button
              onClick={() => nav('/settings')}
              className="mt-3 bg-white text-violet-700 text-sm font-bold px-5 py-2 rounded-full"
            >
              See Plans →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return (
    <div className="flex-1 bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-center">
      <p className="text-sm leading-none mb-0.5">{icon}</p>
      <p className="text-white font-extrabold text-base leading-tight">{value}</p>
      <p className="text-blue-200 text-[10px] leading-tight">{label}</p>
    </div>
  );
}

function ActionCard({
  icon, iconBg, title, desc, badge, onClick,
}: {
  icon: string;
  iconBg: string;
  title: string;
  desc: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col gap-2 p-4 rounded-2xl text-left active:scale-95 transition-transform"
      style={{ background: 'var(--tg-bg)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center text-xl shadow-sm`}>
        {icon}
      </div>
      <div>
        <p className="font-bold text-sm text-[var(--tg-text)]">{title}</p>
        <p className="text-[11px] text-[var(--tg-hint)] leading-tight">{desc}</p>
      </div>
      {badge && (
        <span className="absolute top-2.5 right-2.5 text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}
