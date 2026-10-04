import React, { useEffect, useState, useCallback } from "react";
import { Users, Star, PenLine, Flag, Bell, RefreshCw, TrendingUp } from "lucide-react";
import { getStats, getUsers, getGrowthAnalytics, getAlerts } from "../api";
import type { Stats, User, GrowthAnalytics } from "../types";
import StatCard from "../components/StatCard";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import DonutChart, { SERIES_COLORS, NEUTRAL_COLOR } from "../components/DonutChart";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
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

function Sparkline({ data, color = "bg-accent" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-10 items-end gap-0.5">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${color} opacity-80`}
          style={{ height: `${Math.max(4, Math.round((v / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

const EXAM_COLORS: Record<string, string> = {
  WAEC: SERIES_COLORS[0],
  JAMB: SERIES_COLORS[1],
  NECO: SERIES_COLORS[2],
  unset: NEUTRAL_COLOR,
};

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [growth, setGrowth] = useState<GrowthAnalytics | null>(null);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [s, u, g, a] = await Promise.all([
        getStats(),
        getUsers({ page: 1, limit: 8, sort: "activity" }),
        getGrowthAnalytics(),
        getAlerts(),
      ]);
      setStats(s);
      setRecentUsers(u.data);
      setGrowth(g);
      setActiveAlerts(a.length);
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
    return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      </div>
    );
  }

  const premiumPct = stats && stats.total_users > 0
    ? Math.round((stats.premium_users / stats.total_users) * 100)
    : 0;

  const userSpark = growth?.userGrowth.slice(-14).map((d) => d.new_users) ?? [];
  const revSpark = growth?.revenueGrowth.slice(-14).map((d) => Number(d.revenue_ngn)) ?? [];
  const totalExamUsers = growth?.examBreakdown.reduce((s, e) => s + Number(e.users), 0) ?? 1;

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
          <StatCard label="Total Users" value={stats.total_users} sub={`+${stats.new_today} today`} icon={<Users size={18} />} trend="up" />
          <StatCard label="Premium Users" value={stats.premium_users} sub={`${premiumPct}% of total`} icon={<Star size={18} />} accent trend="up" />
          <StatCard label="Questions Answered" value={Number(stats.total_attempts)} sub={`+${Number(stats.attempts_today).toLocaleString()} today`} icon={<PenLine size={18} />} trend="up" />
          <StatCard label="Pending Flags" value={stats.pending_flags} sub={`${stats.total_questions.toLocaleString()} questions`} icon={<Flag size={18} />} />
          <StatCard label="Active Alerts" value={activeAlerts} sub={activeAlerts > 0 ? "needs attention" : "all clear"} icon={<Bell size={18} />} trend={activeAlerts > 0 ? "down" : "neutral"} />
        </div>
      )}

      {/* Growth sparklines + exam breakdown */}
      {growth && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">New Users (14d)</p>
                <p className="font-display text-2xl font-bold text-white mt-0.5">
                  {userSpark.reduce((a, b) => a + b, 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp size={18} className="text-accent" />
            </div>
            <Sparkline data={userSpark} color="bg-accent" />
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Revenue (14d)</p>
                <p className="font-display text-2xl font-bold text-accent-light mt-0.5">
                  ₦{revSpark.reduce((a, b) => a + b, 0).toLocaleString()}
                </p>
              </div>
              <span className="text-lg">💰</span>
            </div>
            <Sparkline data={revSpark} color="bg-amber-400" />
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Users by Exam Type</p>
            <div className="mb-4">
              <DonutChart
                legend={false}
                centerLabel="users"
                slices={growth.examBreakdown.map((e) => ({
                  label: e.exam_type,
                  value: Number(e.users),
                  color: EXAM_COLORS[e.exam_type] ?? NEUTRAL_COLOR,
                }))}
              />
            </div>
            <div className="space-y-2.5">
              {growth.examBreakdown.map((e) => {
                const pct = Math.round((Number(e.users) / totalExamUsers) * 100);
                const color = EXAM_COLORS[e.exam_type] ?? NEUTRAL_COLOR;
                return (
                  <div key={e.exam_type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-white">{e.exam_type}</span>
                      <span className="text-muted">{Number(e.users).toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface2">
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent users table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Most Active Users</h2>
          <span className="text-xs text-muted">{recentUsers.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2/50">
                {["Name", "Exam", "Plan", "Streak", "Last Active"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">{h}</th>
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
                  <td className="px-5 py-3 text-xs text-muted">
                    {u.last_active_date ? formatDate(u.last_active_date) : "—"}
                  </td>
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
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Revenue (Active Subs)</p>
            <p className="font-display text-3xl font-bold tracking-tight text-accent-light">
              ₦{Number(stats.total_revenue_ngn).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
