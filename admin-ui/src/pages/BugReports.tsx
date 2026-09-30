import React, { useState, useEffect, useCallback } from "react";
import { getBugReports, getBugReportPhotoUrl, setBugReportResolved, invalidateCache } from "../api";
import type { BugReport } from "../types";
import Spinner from "../components/Spinner";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Screenshot({ reportId, index }: { reportId: number; index: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    getBugReportPhotoUrl(reportId, index)
      .then((u) => {
        objectUrl = u;
        if (cancelled) URL.revokeObjectURL(u);
        else setUrl(u);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportId, index]);

  const box = "flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface2";
  if (failed) return <div className={`${box} text-xs text-muted`}>Failed to load</div>;
  if (!url) return <div className={box}><Spinner size="sm" /></div>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`${box} transition-opacity hover:opacity-80`}>
      <img src={url} alt={`Screenshot ${index + 1}`} className="h-full w-full object-cover" />
    </a>
  );
}

interface BugCardProps {
  report: BugReport;
  onToggled: (id: number) => void;
}

function BugCard({ report, onToggled }: BugCardProps) {
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    try {
      await setBugReportResolved(report.id, !report.resolved);
      onToggled(report.id);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Failed to update");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-white">{report.name || "Unknown user"}</span>
          <code className="rounded border border-border bg-surface2 px-2 py-0.5 text-xs text-muted">
            {report.telegram_id}
          </code>
        </div>
        <span className="text-xs text-muted">{formatDate(report.created_at)}</span>
      </div>
      {report.message ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white">{report.message}</p>
      ) : (
        <p className="text-sm italic text-muted">No description, screenshot only</p>
      )}
      {report.photo_count > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: report.photo_count }, (_, i) => (
            <Screenshot key={i} reportId={report.id} index={i} />
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={handleToggle}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-white transition-colors hover:bg-border disabled:opacity-50"
        >
          {saving && <Spinner size="sm" />}
          {report.resolved ? "Reopen" : "Mark resolved"}
        </button>
      </div>
    </div>
  );
}

interface BugReportsProps {
  onChanged?: () => void;
}

export default function BugReports({ onChanged }: BugReportsProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBugReports(showResolved);
      setReports(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load bug reports");
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  const handleToggled = useCallback((id: number) => {
    setReports(prev => prev.filter(r => r.id !== id));
    invalidateCache("/bug-reports?resolved=false");
    invalidateCache("/bug-reports?resolved=true");
    onChanged?.();
  }, [onChanged]);

  function handleRefresh() {
    invalidateCache(`/bug-reports?resolved=${showResolved}`);
    load();
    onChanged?.();
  }

  useEffect(() => {
    load();
  }, [load]);

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-accent/10 text-accent" : "text-muted hover:text-white"
    }`;

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Bug Reports</h1>
          <p className="mt-0.5 text-sm text-muted">Sent by users from the bot's "Report a Bug" button</p>
        </div>
        <button
          onClick={handleRefresh}
          className="shrink-0 rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-1">
        <button className={tabClass(!showResolved)} onClick={() => setShowResolved(false)}>Open</button>
        <button className={tabClass(showResolved)} onClick={() => setShowResolved(true)}>Resolved</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mb-3 text-4xl">{showResolved ? "📭" : "✅"}</div>
          <p className="font-medium text-white">{showResolved ? "No resolved reports yet" : "No open bug reports"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <BugCard key={report.id} report={report} onToggled={handleToggled} />
          ))}
        </div>
      )}
    </div>
  );
}
