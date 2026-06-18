import React, { useState, useEffect, useCallback } from "react";
import { getLeaderboard, type LeaderboardEntry } from "../api";
import Spinner from "../components/Spinner";
import Badge from "../components/Badge";

const MEDALS = ["🥇", "🥈", "🥉"];

const ALL_SUBJECTS = [
  { code: "accounts",         label: "Accounts" },
  { code: "agric",            label: "Agricultural Science" },
  { code: "biology",          label: "Biology" },
  { code: "chemistry",        label: "Chemistry" },
  { code: "commerce",         label: "Commerce" },
  { code: "computer",         label: "Computer Studies" },
  { code: "economics",        label: "Economics" },
  { code: "english",          label: "English Language" },
  { code: "further-math",     label: "Further Mathematics" },
  { code: "geography",        label: "Geography" },
  { code: "government",       label: "Government" },
  { code: "literature",       label: "Literature In English" },
  { code: "math",             label: "Mathematics" },
  { code: "physics",          label: "Physics" },
];

export default function Leaderboard() {
  const [subject, setSubject] = useState("");
  const [data, setData] = useState<{ entries: LeaderboardEntry[]; active_users: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLeaderboard(subject || undefined);
      setData(result);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [subject]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Leaderboard</h1>
          <p className="mt-0.5 text-sm text-muted">Weekly top users by accuracy · resets every Monday · min. 5 questions</p>
        </div>
        {data && (
          <div className="rounded-lg border border-border bg-surface px-4 py-2 text-center">
            <p className="text-lg font-bold text-white">{data.active_users}</p>
            <p className="text-xs text-muted">active this week</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        >
          <option value="">All Subjects</option>
          {ALL_SUBJECTS.map((s) => (
            <option key={s.code} value={s.code}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6 text-red-400">{error}</div>
        ) : !data || data.entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            No users qualify yet — need at least 5 questions answered this week.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="w-16 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Telegram ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Correct</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.entries.map((e) => (
                <tr key={e.telegram_id} className="transition-colors hover:bg-surface2">
                  <td className="px-4 py-3 text-lg">
                    {MEDALS[e.rank - 1] ?? <span className="font-mono text-sm text-muted">{e.rank}</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{e.first_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{e.telegram_id}</td>
                  <td className="px-4 py-3 text-white">{e.correct}</td>
                  <td className="px-4 py-3 text-muted">{e.total}</td>
                  <td className="px-4 py-3">
                    <Badge variant={e.accuracy >= 80 ? "green" : e.accuracy >= 60 ? "amber" : "red"}>
                      {e.accuracy}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
