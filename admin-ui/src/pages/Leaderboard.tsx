import React, { useState, useEffect, useCallback } from "react";
import {
  getLeaderboard,
  getSnapshotWeeks,
  getLeaderboardSnapshot,
  type LeaderboardEntry,
} from "../api";
import Spinner from "../components/Spinner";
import Badge from "../components/Badge";

const MEDALS = ["🥇", "🥈", "🥉"];

const ALL_SUBJECTS = [
  { code: "accounts",      label: "Accounts" },
  { code: "agric",         label: "Agricultural Science" },
  { code: "biology",       label: "Biology" },
  { code: "chemistry",     label: "Chemistry" },
  { code: "commerce",      label: "Commerce" },
  { code: "computer",      label: "Computer Studies" },
  { code: "economics",     label: "Economics" },
  { code: "english",       label: "English Language" },
  { code: "further-math",  label: "Further Mathematics" },
  { code: "geography",     label: "Geography" },
  { code: "government",    label: "Government" },
  { code: "literature",    label: "Literature In English" },
  { code: "math",          label: "Mathematics" },
  { code: "physics",       label: "Physics" },
];

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  const end = new Date(d.getTime() + 6 * 86400000);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(d)} – ${fmt(end)}`;
}

function groupByMonth(weeks: string[]): { label: string; weeks: string[] }[] {
  const map = new Map<string, string[]>();
  for (const w of weeks) {
    const d = new Date(w + "T00:00:00Z");
    const key = d.toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "UTC" });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }
  return Array.from(map.entries()).map(([label, ws]) => ({ label, weeks: ws }));
}

export default function Leaderboard() {
  const [subject, setSubject] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null); // null = current week
  const [snapshotWeeks, setSnapshotWeeks] = useState<string[]>([]);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available snapshot weeks once
  useEffect(() => {
    getSnapshotWeeks()
      .then(({ weeks }) => {
        setSnapshotWeeks(weeks);
        // Auto-expand the most recent month
        if (weeks.length > 0) {
          const d = new Date(weeks[0] + "T00:00:00Z");
          setExpandedMonth(
            d.toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "UTC" })
          );
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedWeek === null) {
        const result = await getLeaderboard(subject || undefined);
        setEntries(result.entries);
        setActiveUsers(result.active_users);
      } else {
        const result = await getLeaderboardSnapshot(selectedWeek);
        setEntries(result.entries);
        setActiveUsers(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedWeek, subject]);

  useEffect(() => { load(); }, [load]);

  const monthGroups = groupByMonth(snapshotWeeks);

  return (
    <div className="flex gap-6 p-6">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 space-y-2">
        {/* This week */}
        <button
          onClick={() => setSelectedWeek(null)}
          className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
            selectedWeek === null
              ? "bg-accent text-white"
              : "text-muted hover:bg-surface2 hover:text-white"
          }`}
        >
          🏆 This Week
        </button>

        {/* Month groups */}
        {monthGroups.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">
            No snapshots yet — first one runs Sunday 23:55 WAT.
          </p>
        ) : (
          monthGroups.map(({ label, weeks }) => (
            <div key={label}>
              <button
                onClick={() =>
                  setExpandedMonth(expandedMonth === label ? null : label)
                }
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted hover:text-white"
              >
                <span>{label}</span>
                <span>{expandedMonth === label ? "▾" : "▸"}</span>
              </button>
              {expandedMonth === label && (
                <div className="ml-3 space-y-1">
                  {weeks.map((w) => (
                    <button
                      key={w}
                      onClick={() => setSelectedWeek(w)}
                      className={`w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                        selectedWeek === w
                          ? "bg-accent text-white"
                          : "text-muted hover:bg-surface2 hover:text-white"
                      }`}
                    >
                      {formatWeekLabel(w)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-white">
              {selectedWeek === null
                ? "This Week's Leaderboard"
                : `Week of ${formatWeekLabel(selectedWeek)}`}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              Top users by accuracy · min. 5 questions to qualify
            </p>
          </div>
          {activeUsers !== null && (
            <div className="rounded-lg border border-border bg-surface px-4 py-2 text-center">
              <p className="text-lg font-bold text-white">{activeUsers}</p>
              <p className="text-xs text-muted">active this week</p>
            </div>
          )}
        </div>

        {/* Subject filter — current week only */}
        {selectedWeek === null && (
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
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <div className="p-6 text-red-400">{error}</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              {selectedWeek === null
                ? "No users qualify yet — need at least 5 questions this week."
                : "No data for this week."}
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
                {entries.map((e) => (
                  <tr key={e.telegram_id} className="transition-colors hover:bg-surface2">
                    <td className="px-4 py-3 text-lg">
                      {MEDALS[e.rank - 1] ?? (
                        <span className="font-mono text-sm text-muted">{e.rank}</span>
                      )}
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
    </div>
  );
}
