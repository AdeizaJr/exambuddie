import React, { useState, useEffect, useCallback } from "react";
import Spinner from "../components/Spinner";

const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api/admin";
function getToken() { return localStorage.getItem("admin_token") || ""; }

interface QOTDQuestion {
  id: number;
  exam_type: string;
  subject: string;
  year: number;
  question_preview: string;
  correct_option: string;
}

interface QOTDData {
  date: string;
  sample: QOTDQuestion[];
}

async function fetchQOTD(): Promise<QOTDData> {
  const r = await fetch(`${BASE}/qotd`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!r.ok) throw new Error("Failed to load QOTD");
  return r.json();
}

export default function QOTDPage() {
  const [data, setData] = useState<QOTDData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchQOTD();
      setData(d);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>;

  if (error) return (
    <div className="p-8">
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Question of the Day</h1>
          <p className="mt-0.5 text-sm text-muted">
            QOTD is auto-selected daily by the cron at 6:00 AM UTC. Today: <span className="text-white font-mono">{data?.date}</span>
          </p>
        </div>
        <button onClick={load} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted hover:text-white">
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">How it works</p>
        <p className="text-sm text-white">
          Every day at 6:05 AM UTC, the bot picks one random active question per exam type (WAEC/JAMB/NECO) that has an explanation and has been attempted at least 5 times. It broadcasts to all users with notifications enabled. Users who already answered today's QOTD are skipped.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Sample Questions (random eligible pool)</h2>
          <p className="text-xs text-muted mt-0.5">These are examples of questions eligible for QOTD selection</p>
        </div>
        <div className="divide-y divide-border">
          {data?.sample.map((q) => (
            <div key={q.id} className="px-5 py-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="rounded bg-surface2 px-2 py-0.5 text-xs font-mono text-muted">{q.exam_type}</span>
                <span className="text-xs text-muted capitalize">{q.subject.replace(/-/g, " ")}</span>
                <span className="text-xs text-muted">{q.year}</span>
                <span className="ml-auto rounded bg-success/20 px-2 py-0.5 text-xs font-bold text-success">Ans: {q.correct_option}</span>
              </div>
              <p className="text-sm text-white">{q.question_preview}{q.question_preview?.length >= 120 ? "…" : ""}</p>
            </div>
          ))}
          {!data?.sample.length && (
            <div className="py-10 text-center text-sm text-muted">No eligible questions found</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
        <p className="text-xs font-semibold text-amber-400 mb-1">To override today's QOTD</p>
        <p className="text-sm text-amber-200/80">
          Use the Broadcast page to send a specific question manually. The automated QOTD will still run tomorrow as normal.
          Manual question override via admin UI is not yet implemented — the random auto-selection is intentional to keep content varied.
        </p>
      </div>
    </div>
  );
}
