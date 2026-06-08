import React, { useState, useEffect, useCallback } from 'react';
import { getAnalytics } from '../api';
import type { Analytics, DailyData, SubjectData } from '../types';
import Spinner from '../components/Spinner';

function accuracyColor(acc: number): string {
  if (acc >= 70) return 'text-accent';
  if (acc >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function accuracyBg(acc: number): string {
  if (acc >= 70) return 'bg-accent';
  if (acc >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

interface BarChartProps {
  data: DailyData[];
}

function BarChart({ data }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.attempts), 1);

  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d) => {
        const height = Math.max(4, Math.round((d.attempts / max) * 100));
        const date = new Date(d.date);
        const label = date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
              <div className="bg-surface2 border border-border text-xs text-white rounded px-2 py-1 whitespace-nowrap shadow-lg">
                {label}: {d.attempts} attempts, {d.correct} correct
              </div>
            </div>
            <div
              className="w-full rounded-t-sm bg-accent/60 hover:bg-accent transition-colors cursor-default"
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
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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

  if (!analytics) return null;

  const totalAttempts = analytics.subjects.reduce((sum, s) => sum + Number(s.attempts), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Analytics</h1>
          <p className="text-sm text-muted mt-0.5">Performance data across subjects and time</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-surface2 border border-border text-sm text-white rounded-lg hover:bg-border transition-colors shrink-0"
        >
          Refresh
        </button>
      </div>

      {/* Content Health */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-wider font-medium mb-1">Missing Explanations</p>
          <p className={`text-2xl font-bold font-display ${analytics.contentHealth.missing_explanations > 0 ? 'text-amber-400' : 'text-accent'}`}>
            {analytics.contentHealth.missing_explanations.toLocaleString()}
          </p>
          <p className="text-xs text-muted mt-1">questions without explanation</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-muted uppercase tracking-wider font-medium mb-1">Flagged Questions</p>
          <p className={`text-2xl font-bold font-display ${analytics.contentHealth.flagged_questions > 0 ? 'text-red-400' : 'text-accent'}`}>
            {analytics.contentHealth.flagged_questions.toLocaleString()}
          </p>
          <p className="text-xs text-muted mt-1">questions with flag count &gt; 0</p>
        </div>
      </div>

      {/* Daily Activity */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Daily Activity — Last 14 Days</h2>
        {analytics.daily.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">No activity data yet</div>
        ) : (
          <>
            <BarChart data={analytics.daily} />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-muted">
                {analytics.daily.length > 0
                  ? new Date(analytics.daily[0].date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
                  : ''}
              </span>
              <span className="text-xs text-muted">
                {analytics.daily.length > 0
                  ? new Date(analytics.daily[analytics.daily.length - 1].date).toLocaleDateString('en-NG', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : ''}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Subject Performance */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Subject Performance</h2>
          <span className="text-xs text-muted">{totalAttempts.toLocaleString()} total attempts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted font-medium uppercase tracking-wider">Subject</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-medium uppercase tracking-wider">Attempts</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-medium uppercase tracking-wider">Correct</th>
                <th className="text-right px-5 py-3 text-xs text-muted font-medium uppercase tracking-wider">Accuracy</th>
                <th className="px-5 py-3 w-40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {analytics.subjects.map((s: SubjectData) => {
                const acc = Number(s.accuracy) || 0;
                const pct = Math.round((Number(s.attempts) / totalAttempts) * 100) || 0;
                return (
                  <tr key={s.subject} className="hover:bg-surface2 transition-colors">
                    <td className="px-5 py-3 text-white">{s.subject}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-muted">
                      {Number(s.attempts).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-muted">
                      {Number(s.correct).toLocaleString()}
                    </td>
                    <td className={`px-5 py-3 text-right font-bold font-mono ${accuracyColor(acc)}`}>
                      {acc}%
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-surface2 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${accuracyBg(acc)}`}
                            style={{ width: `${acc}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {analytics.subjects.length === 0 && (
            <div className="text-center py-10 text-muted text-sm">No attempt data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
