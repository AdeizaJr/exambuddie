import React, { useEffect, useState, useCallback } from "react";
import { getStats, getUsers } from "../api";
import type { Stats, User } from "../types";
import StatCard from "../components/StatCard";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([getStats(), getUsers({ page: 1, limit: 8 })]);
      setStats(s);
      setRecentUsers(u.data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
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
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Overview</h1>
        <p className="mt-0.5 text-sm text-muted">Real-time stats — auto-refreshes every 30s</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Recent Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Exam
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Plan
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Streak
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentUsers.map((u) => (
                <tr key={u.telegram_id} className="transition-colors hover:bg-surface2">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium text-white">{u.first_name}</p>
                      {u.username && <p className="text-xs text-muted">@{u.username}</p>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">{u.exam_type || "—"}</td>
                  <td className="px-5 py-3">
                    <Badge variant={u.plan === "premium" ? "green" : "gray"}>{u.plan}</Badge>
                  </td>
                  <td className="px-5 py-3 text-muted">{u.streak} 🔥</td>
                  <td className="px-5 py-3 text-muted">{formatDate(u.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentUsers.length === 0 && (
            <div className="py-10 text-center text-sm text-muted">No users yet</div>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
              Total Questions
            </p>
            <p className="font-display text-2xl font-bold text-white">
              {stats.total_questions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
              Revenue (Active)
            </p>
            <p className="font-display text-2xl font-bold text-accent">
              ₦{Number(stats.total_revenue_ngn).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
