import React, { useState, useEffect, useCallback } from "react";
import { getAnalytics, getRetention, getFunnel, getPageViewAnalytics } from "../api";
import type { Analytics, DailyData, SubjectData, WeakTopicData, RetentionData, FunnelData, PageViewAnalytics } from "../types";
import Spinner from "../components/Spinner";
import DonutChart, { foldSlices, NEUTRAL_COLOR } from "../components/DonutChart";

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

function ViewsBarChart({ data }: { data: PageViewAnalytics["daily"] }) {
  const max = Math.max(...data.map((d) => d.views), 1);

  return (
    <div className="flex h-32 items-end gap-1.5">
      {data.map((d) => {
        const height = Math.max(4, Math.round((d.views / max) * 100));
        const label = new Date(d.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
        return (
          <div key={d.date} className="group relative flex flex-1 flex-col items-center gap-1">
            <div className="absolute bottom-full z-10 mb-1 hidden group-hover:block">
              <div className="whitespace-nowrap rounded border border-border bg-surface2 px-2 py-1 text-xs text-white shadow-lg">
                {label}: {d.views} views, {d.uniques} unique
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
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [pageViews, setPageViews] = useState<PageViewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, ret, fun, pv] = await Promise.all([getAnalytics(), getRetention(), getFunnel(), getPageViewAnalytics(30)]);
      setAnalytics(data);
      setRetention(ret);
      setFunnel(fun);
      setPageViews(pv);
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
  const subjectSlices = foldSlices(analytics.subjects.map((s) => ({ label: s.subject, value: Number(s.attempts) })));

  const listedSourceViews = pageViews?.topSources.reduce((sum, s) => sum + Number(s.views), 0) ?? 0;
  const sourceSlices = pageViews
    ? foldSlices(
        pageViews.topSources.map((s) => ({ label: s.source, value: Number(s.views) })),
        undefined,
        pageViews.totalViews - listedSourceViews
      )
    : [];
  const sourceColor = (source: string) =>
    sourceSlices.find((s) => s.label === source)?.color ?? NEUTRAL_COLOR;

  const funnelPremium = Number(funnel?.premium_users ?? 0);
  const funnelActiveFree = Number(funnel?.active_free ?? 0);
  const funnelSlices = [
    { label: "Premium", value: funnelPremium, color: "#25A865" },
    { label: "Active free", value: funnelActiveFree, color: "#c98500" },
    {
      label: "Inactive",
      value: Math.max(Number(funnel?.total_users ?? 0) - funnelPremium - funnelActiveFree, 0),
      color: NEUTRAL_COLOR,
    },
  ];

  const conversionRate = funnel ? Math.round((Number(funnel.premium_users) / Math.max(Number(funnel.total_users), 1)) * 100) : 0;

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

      {/* Engagement */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "DAU", value: analytics.engagement?.dau ?? 0, sub: "active today" },
          { label: "WAU", value: analytics.engagement?.wau ?? 0, sub: "active this week" },
          { label: "MAU", value: analytics.engagement?.mau ?? 0, sub: "active this month" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
            <p className="font-display text-2xl font-bold text-accent">{Number(value).toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted">{sub}</p>
          </div>
        ))}
      </div>

      {/* Retention */}
      {retention && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">User Retention (60-day cohort)</h2>
            <p className="mt-0.5 text-xs text-muted">% of new users who returned on day 1 / 7 / 30</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "D1 Retention", rate: retention.d1_rate, count: retention.d1, color: retention.d1_rate >= 20 ? "text-accent" : retention.d1_rate >= 10 ? "text-amber-400" : "text-red-400" },
              { label: "D7 Retention", rate: retention.d7_rate, count: retention.d7, color: retention.d7_rate >= 10 ? "text-accent" : retention.d7_rate >= 5 ? "text-amber-400" : "text-red-400" },
              { label: "D30 Retention", rate: retention.d30_rate, count: retention.d30, color: retention.d30_rate >= 5 ? "text-accent" : retention.d30_rate >= 2 ? "text-amber-400" : "text-red-400" },
            ].map(({ label, rate, count, color }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-muted mb-1">{label}</p>
                <p className={`font-display text-3xl font-bold ${color}`}>{rate}%</p>
                <p className="text-xs text-muted mt-1">{count} / {retention.total_users} users</p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-surface2">
                  <div className={`h-1.5 rounded-full ${rate >= 10 ? "bg-accent" : rate >= 5 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${Math.min(rate * 3, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversion Funnel */}
      {funnel && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Conversion Funnel</h2>
            <p className="mt-0.5 text-xs text-muted">Free → Premium conversion and churn</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted mb-1">Total Users</p>
              <p className="font-display text-2xl font-bold text-white">{Number(funnel.total_users).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Active Free (7d)</p>
              <p className="font-display text-2xl font-bold text-white">{Number(funnel.active_free).toLocaleString()}</p>
              <p className="text-xs text-muted mt-0.5">potential converts</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Premium</p>
              <p className="font-display text-2xl font-bold text-accent">{Number(funnel.premium_users).toLocaleString()}</p>
              <p className="text-xs text-muted mt-0.5">{conversionRate}% conversion</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Churned (30d)</p>
              <p className={`font-display text-2xl font-bold ${Number(funnel.churned_30d) > 0 ? "text-red-400" : "text-accent"}`}>
                {Number(funnel.churned_30d).toLocaleString()}
              </p>
              <p className="text-xs text-muted mt-0.5">MRR: ₦{Number(funnel.mrr).toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <DonutChart slices={funnelSlices} centerLabel="users" />
          </div>
        </div>
      )}

      {/* Web Traffic (landing page) */}
      {pageViews && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Web Traffic — Last 30 Days</h2>
            <p className="mt-0.5 text-xs text-muted">Landing page views, in-house tracking (no third-party pixel)</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted mb-1">Page Views</p>
              <p className="font-display text-2xl font-bold text-white">{pageViews.totalViews.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Unique Visitors</p>
              <p className="font-display text-2xl font-bold text-accent">{pageViews.uniqueVisitors.toLocaleString()}</p>
            </div>
          </div>

          {pageViews.daily.length > 0 && (
            <div className="mt-5">
              <ViewsBarChart data={pageViews.daily} />
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Top Pages</p>
              {pageViews.topPages.length === 0 ? (
                <p className="text-xs text-muted">No data yet</p>
              ) : (
                <div className="space-y-1.5">
                  {pageViews.topPages.map((p) => (
                    <div key={p.path} className="flex items-center justify-between text-sm">
                      <span className="truncate text-slate-300">{p.path}</span>
                      <span className="ml-2 shrink-0 font-medium text-white">{p.views}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Top Sources</p>
              {pageViews.topSources.length === 0 ? (
                <p className="text-xs text-muted">No data yet</p>
              ) : (
                <div className="space-y-1.5">
                  <div className="mb-3">
                    <DonutChart slices={sourceSlices} centerLabel="views" legend={false} />
                  </div>
                  {pageViews.topSources.map((s) => {
                    const pct = Math.round((s.views / Math.max(pageViews.totalViews, 1)) * 100);
                    return (
                      <div key={s.source}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">{s.source}</span>
                          <span className="font-medium text-white">{s.views} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-surface2">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: sourceColor(s.source) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
        {subjectSlices.length > 0 && (
          <div className="border-b border-border px-5 py-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Share of attempts</p>
            <DonutChart slices={subjectSlices} centerLabel="attempts" />
          </div>
        )}
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

      {/* Weakest Topics */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Weakest Topics</h2>
            <p className="mt-0.5 text-xs text-muted">Topics with lowest accuracy (min 10 attempts)</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">#</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Topic</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Subject</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Attempts</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Accuracy</th>
                <th className="w-36 px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(analytics.weakTopics ?? []).map((t: WeakTopicData, i: number) => {
                const acc = Number(t.accuracy) || 0;
                return (
                  <tr key={`${t.subject}-${t.topic}`} className="transition-colors hover:bg-surface2">
                    <td className="px-5 py-3 font-mono text-xs text-muted">{i + 1}</td>
                    <td className="px-5 py-3 text-white">{t.topic}</td>
                    <td className="px-5 py-3 text-xs capitalize text-muted">{t.subject.replace(/-/g, " ")}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-muted">{Number(t.attempts).toLocaleString()}</td>
                    <td className={`px-5 py-3 text-right font-mono font-bold ${accuracyColor(acc)}`}>{acc}%</td>
                    <td className="px-5 py-3">
                      <div className="h-1.5 w-full rounded-full bg-surface2">
                        <div className={`h-1.5 rounded-full ${accuracyBg(acc)}`} style={{ width: `${acc}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(analytics.weakTopics ?? []).length === 0 && (
            <div className="py-10 text-center text-sm text-muted">No topic data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
