import React, { useState, useEffect, useCallback } from "react";
import { getAnalytics } from "../api";
import type { Analytics, DailyData, SubjectData } from "../types";
import Spinner from "../components/Spinner";

function accuracyColor(acc: number): string {
  if (acc >= 70) return "text-accent";
  if (acc >= 50) return "text-amber-400";
  return "text-red-400";
}

function accuracyBg(acc: number): string {
  if (acc >= 70) return "bg-accent";
  if (acc >= 50) return "bg-amber-400";
  return "bg-red-400";
}

interface BarChartProps {
  data: DailyData[];
}

function BarChart({ data }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.attempts), 1);

  return (
    <div className="flex h-32 items-end gap-1.5">
      {data.map((d) => {
        const height = Math.max(4, Math.round((d.attempts / max) * 100));
        const date = new Date(d.date);
        const label = date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
        return (
          <div key={d.date} className="group relative flex flex-1 flex-col items-center gap-1">
            <div className="absolute bottom-full z-10 mb-1 hidden group-hover:block">
              <div className="whitespace-nowrap rounded border border-border bg-surface2 px-2 py-1 text-xs text-white shadow-lg">
                {label}: {d.attempts} attempts, {d.correct} correct
              </div>
            </div>
            <div
              className="w-full cursor-default rounded-t-sm bg-accent/60 transition-colors hover:bg-accent"
              style={{ height: `${height}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAnalytics();
      setAnalytics(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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

  if (!analytics) return null;

  const totalAttempts = analytics.subjects.reduce((sum, s) => sum + Number(s.attempts), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted">Performance data across subjects and time</p>
        </div>
        <button
          onClick={load}
          className="shrink-0 rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
        >
          Refresh
        </button>
      </div>

      {/* Content Health */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
            Missing Explanations
          </p>
          <p
            className={`font-display text-2xl font-bold ${analytics.contentHealth.missing_explanations > 0 ? "text-amber-400" : "text-accent"}`}
          >
            {analytics.contentHealth.missing_explanations.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">questions without explanation</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
            Flagged Questions
          </p>
          <p
            className={`font-display text-2xl font-bold ${analytics.contentHealth.flagged_questions > 0 ? "text-red-400" : "text-accent"}`}
          >
            {analytics.contentHealth.flagged_questions.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">questions with flag count &gt; 0</p>
        </div>
      </div>

      {/* Daily Activity */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Daily Activity — Last 14 Days</h2>
        {analytics.daily.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">No activity data yet</div>
        ) : (
          <>
            <BarChart data={analytics.daily} />
            <div className="mt-2 flex justify-between">
              <span className="text-xs text-muted">
                {analytics.daily.length > 0
                  ? new Date(analytics.daily[0].date).toLocaleDateString("en-NG", {
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
              </span>
              <span className="text-xs text-muted">
                {analytics.daily.length > 0
                  ? new Date(analytics.daily[analytics.daily.length - 1].date).toLocaleDateString(
                      "en-NG",
                      {
                        month: "short",
                        day: "numeric",
                      }
                    )
                  : ""}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Subject Performance */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Subject Performance</h2>
          <span className="text-xs text-muted">
            {totalAttempts.toLocaleString()} total attempts
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Subject
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                  Attempts
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                  Correct
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                  Accuracy
                </th>
                <th className="w-40 px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {analytics.subjects.map((s: SubjectData) => {
                const acc = Number(s.accuracy) || 0;
                const pct = Math.round((Number(s.attempts) / totalAttempts) * 100) || 0;
                return (
                  <tr key={s.subject} className="transition-colors hover:bg-surface2">
                    <td className="px-5 py-3 text-white">{s.subject}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-muted">
                      {Number(s.attempts).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-muted">
                      {Number(s.correct).toLocaleString()}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono font-bold ${accuracyColor(acc)}`}
                    >
                      {acc}%
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-surface2">
                          <div
                            className={`h-1.5 rounded-full ${accuracyBg(acc)}`}
                            style={{ width: `${acc}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-muted">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {analytics.subjects.length === 0 && (
            <div className="py-10 text-center text-sm text-muted">No attempt data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
