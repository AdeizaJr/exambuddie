import React, { useEffect, useState, useCallback } from 'react';
import { getStats, getUsers } from '../api';
import type { Stats, User } from '../types';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([
        getStats(),
        getUsers({ page: 1, limit: 8 }),
      ]);
      setStats(s);
      setRecentUsers(u.data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold font-display text-white">Overview</h1>
        <p className="text-sm text-muted mt-0.5">Real-time stats — auto-refreshes every 30s</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats.total_users}
            sub={`+${stats.new_today} today`}
            icon="👥"
          />
          <StatCard
            label="Premium Users"
            value={stats.premium_users}
            sub={`${stats.total_users > 0 ? Math.round((stats.premium_users / stats.total_users) * 100) : 0}% of total`}
            icon="⭐"
            accent
          />
          <StatCard
            label="Attempts Today"
            value={stats.attempts_today}
            sub={`${stats.total_attempts.toLocaleString()} total`}
            icon="📝"
          />
          <StatCard
            label="Pending Flags"
            value={stats.pending_flags}
            sub={`${stats.total_questions.toLocaleString()} questions`}
            icon="🚩"
          />
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-white">Recent Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted font-medium uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-medium uppercase tracking-wider">Exam</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-medium uppercase tracking-wider">Plan</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-medium uppercase tracking-wider">Streak</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-medium uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentUsers.map((u) => (
                <tr key={u.telegram_id} className="hover:bg-surface2 transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-white font-medium">{u.first_name}</p>
                      {u.username && <p className="text-xs text-muted">@{u.username}</p>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">{u.exam_type || '—'}</td>
                  <td className="px-5 py-3">
                    <Badge variant={u.plan === 'premium' ? 'green' : 'gray'}>
                      {u.plan}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-muted">{u.streak} 🔥</td>
                  <td className="px-5 py-3 text-muted">{formatDate(u.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentUsers.length === 0 && (
            <div className="text-center py-10 text-muted text-sm">No users yet</div>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-xs text-muted uppercase tracking-wider font-medium mb-1">Total Questions</p>
            <p className="text-2xl font-bold font-display text-white">{stats.total_questions.toLocaleString()}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-xs text-muted uppercase tracking-wider font-medium mb-1">Revenue (Active)</p>
            <p className="text-2xl font-bold font-display text-accent">
              ₦{Number(stats.total_revenue_ngn).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
