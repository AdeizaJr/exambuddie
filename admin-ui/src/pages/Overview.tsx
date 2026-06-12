import React, { useEffect, useState, useCallback } from "react";
import { Users, Star, PenLine, Flag, RefreshCw } from "lucide-react";
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

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hue = name.charCodeAt(0) * 37 % 360;
  return (
    <div
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: `hsl(${hue},50%,35%)` }}
    >
      {initials}
    </div>
  );
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [s, u] = await Promise.all([getStats(), getUsers({ page: 1, limit: 8 })]);
      setStats(s);
      setRecentUsers(u.data);
      setLastRefresh(new Date());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 30_000);
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
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const premiumPct = stats && stats.total_users > 0
    ? Math.round((stats.premium_users / stats.total_users) * 100)
    : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Overview</h1>
          <p className="mt-0.5 text-sm text-muted">
            Last updated {lastRefresh.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Users"
            value={stats.total_users}
            sub={`+${stats.new_today} today`}
            icon={<Users size={18} />}
            trend="up"
          />
          <StatCard
            label="Premium Users"
            value={stats.premium_users}
            sub={`${premiumPct}% of total`}
            icon={<Star size={18} />}
            accent
            trend="up"
          />
          <StatCard
            label="Attempts Today"
            value={stats.attempts_today}
            sub={`${stats.total_attempts.toLocaleString()} total`}
            icon={<PenLine size={18} />}
          />
          <StatCard
            label="Pending Flags"
            value={stats.pending_flags}
            sub={`${stats.total_questions.toLocaleString()} questions`}
            icon={<Flag size={18} />}
          />
        </div>
      )}

      {/* Recent users table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Recent Users</h2>
          <span className="text-xs text-muted">{recentUsers.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2/50">
                {["Name", "Exam", "Plan", "Streak", "Joined"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentUsers.map((u) => (
                <tr key={u.telegram_id} className="group transition-colors hover:bg-surface2/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.first_name} />
                      <div>
                        <p className="font-medium text-white">{u.first_name}</p>
                        {u.username && <p className="text-xs text-muted">@{u.username}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted">{u.exam_type || "—"}</td>
                  <td className="px-5 py-3">
                    <Badge variant={u.plan === "premium" ? "green" : "gray"}>{u.plan}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1 text-muted">
                      {u.streak > 0 && <span className="text-orange-400">🔥</span>}
                      <span className={u.streak > 0 ? "text-white" : ""}>{u.streak}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{formatDate(u.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentUsers.length === 0 && (
            <div className="py-12 text-center text-sm text-muted">No users yet</div>
          )}
        </div>
      </div>

      {/* Bottom stat pair */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-gradient-card p-5 shadow-card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Total Questions</p>
            <p className="font-display text-3xl font-bold tracking-tight text-white">
              {stats.total_questions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-gradient-card p-5 shadow-card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Revenue (Active)</p>
            <p className="font-display text-3xl font-bold tracking-tight text-accent-light">
              ₦{Number(stats.total_revenue_ngn).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
