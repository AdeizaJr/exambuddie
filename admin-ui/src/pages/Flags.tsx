import React, { useState, useEffect, useCallback } from "react";
import { getFlags, resolveFlag } from "../api";
import type { Flag } from "../types";
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

interface FlagCardProps {
  flag: Flag;
  onResolved: () => void;
}

function FlagCard({ flag, onResolved }: FlagCardProps) {
  const [explanation, setExplanation] = useState(flag.explanation || "");
  const [saving, setSaving] = useState(false);

  async function handleSaveAndResolve() {
    setSaving(true);
    try {
      await resolveFlag(flag.id, explanation);
      onResolved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to resolve");
    } finally {
      setSaving(false);
    }
  }

  async function handleResolveOnly() {
    setSaving(true);
    try {
      await resolveFlag(flag.id);
      onResolved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to resolve");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded border border-border bg-surface2 px-2 py-0.5 text-xs font-medium text-muted">
              {flag.subject}
            </span>
            <span className="text-xs text-muted">
              Correct: <strong className="text-white">{flag.correct_option}</strong>
            </span>
            <span className="text-xs text-muted">Q#{flag.question_id}</span>
          </div>
          <p className="text-sm leading-relaxed text-white">{flag.question_text}</p>
        </div>
        <div className="text-xs text-muted sm:whitespace-nowrap">{formatDate(flag.flagged_at)}</div>
      </div>

      {flag.reason && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400">
            <strong>Flag reason:</strong> {flag.reason}
          </p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
          Explanation {!flag.explanation && <span className="ml-1 text-red-400">(missing)</span>}
        </label>
        <textarea
          rows={4}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
          placeholder="Write or update the explanation for this question..."
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleResolveOnly}
          disabled={saving}
          className="rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-white transition-colors hover:bg-border disabled:opacity-50"
        >
          Resolve Only
        </button>
        <button
          onClick={handleSaveAndResolve}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
        >
          {saving && <Spinner size="sm" />}
          Save & Resolve
        </button>
      </div>
    </div>
  );
}

interface FlagsProps {
  onFlagsResolved?: () => void;
}

export default function Flags({ onFlagsResolved }: FlagsProps) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFlags();
      setFlags(data);
      setError(null);
      onFlagsResolved?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load flags");
    } finally {
      setLoading(false);
    }
  }, [onFlagsResolved]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Flagged Explanations</h1>
          <p className="mt-0.5 text-sm text-muted">
            {flags.length > 0
              ? `${flags.length} unresolved flag${flags.length === 1 ? "" : "s"}`
              : "All clear"}
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      ) : flags.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mb-3 text-4xl">✅</div>
          <p className="font-medium text-white">No pending flags</p>
          <p className="mt-1 text-sm text-muted">All flagged explanations have been resolved</p>
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => (
            <FlagCard key={flag.id} flag={flag} onResolved={load} />
          ))}
        </div>
      )}
    </div>
  );
}
