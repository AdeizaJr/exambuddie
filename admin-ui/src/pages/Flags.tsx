import React, { useState, useEffect, useCallback } from "react";
import { getFlags, resolveFlag, toggleQuestionActive, invalidateCache } from "../api";
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
  const isUnderline = flag.reason === "wrong_underline";
  const [explanation, setExplanation] = useState(flag.explanation || "");
  const [questionText, setQuestionText] = useState(flag.question_text || "");
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  async function handleSaveAndResolve() {
    setSaving(true);
    try {
      if (isUnderline) {
        await resolveFlag(flag.id, undefined, questionText);
      } else {
        await resolveFlag(flag.id, explanation);
      }
      onResolved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to resolve");
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
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!confirm(`Deactivate question #${flag.question_id}? It will be hidden from users until reactivated.`)) return;
    setDeactivating(true);
    try {
      await toggleQuestionActive(flag.question_id, false);
      await resolveFlag(flag.id);
      onResolved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to deactivate");
      setDeactivating(false);
    }
  }

  return (
    <div className={`space-y-4 rounded-xl border bg-surface p-5 ${isUnderline ? "border-blue-500/30" : "border-border"}`}>
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
            {flag.resolved && (
              <span className="rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                ✅ Resolved
              </span>
            )}
            {isUnderline && (
              <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                🔤 Wrong Underline
              </span>
            )}
            {flag.user_first_name && (
              <span className="rounded border border-border bg-surface2 px-2 py-0.5 text-xs text-muted">
                👤 {flag.user_first_name}
                {flag.user_telegram_id && (
                  <span className="ml-1 font-mono text-[10px] opacity-60">#{flag.user_telegram_id}</span>
                )}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-white">{flag.question_text}</p>
        </div>
        <div className="text-xs text-muted sm:whitespace-nowrap">{formatDate(flag.flagged_at)}</div>
      </div>

      {flag.reason && !isUnderline && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400">
            <strong>Flag reason:</strong> {flag.reason}
          </p>
        </div>
      )}

      {isUnderline ? (
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
            Fix Question Text{" "}
            <span className="ml-1 normal-case text-blue-400">(use *word* for underlined word)</span>
          </label>
          <textarea
            rows={4}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
      ) : (
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
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleDeactivate}
          disabled={saving || deactivating}
          className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
        >
          {deactivating && <Spinner size="sm" />}
          🚫 Deactivate
        </button>
        <button
          onClick={handleResolveOnly}
          disabled={saving || deactivating}
          className="rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-white transition-colors hover:bg-border disabled:opacity-50"
        >
          Resolve Only
        </button>
        <button
          onClick={handleSaveAndResolve}
          disabled={saving || deactivating}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
        >
          {saving && <Spinner size="sm" />}
          {isUnderline ? "Fix & Resolve" : "Save & Resolve"}
        </button>
      </div>
    </div>
  );
}

interface FlagsProps {
  onFlagsResolved?: () => void;
}

type StatusFilter = "unresolved" | "resolved" | "all";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "unresolved", label: "Unresolved" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

export default function Flags({ onFlagsResolved }: FlagsProps) {
  const [status, setStatus] = useState<StatusFilter>("unresolved");
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFlags(status);
      setFlags(data);
      setError(null);
      onFlagsResolved?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load flags");
    } finally {
      setLoading(false);
    }
  }, [status, onFlagsResolved]);

  // Re-fetch (rather than filtering the resolved flag out of local state) so the list
  // stays correct no matter which tab is active — resolving one on the "All" or
  // "Resolved" tab should keep it visible, only the "Unresolved" tab should drop it.
  const handleResolved = useCallback(() => {
    invalidateCache("/flags");
    load();
    onFlagsResolved?.();
  }, [load, onFlagsResolved]);

  useEffect(() => {
    load();
  }, [load]);

  const emptyCopy = status === "resolved"
    ? { title: "No resolved flags yet", body: "Flags will show up here once resolved." }
    : status === "all"
    ? { title: "No flags", body: "No explanations have been flagged." }
    : { title: "No pending flags", body: "All flagged explanations have been resolved" };

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Flagged Explanations</h1>
          <p className="mt-0.5 text-sm text-muted">
            {flags.length > 0
              ? `${flags.length} ${status === "all" ? "" : status + " "}flag${flags.length === 1 ? "" : "s"}`
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

      <div className="flex gap-1.5 rounded-lg border border-border bg-surface2 p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              status === tab.value ? "bg-accent text-white" : "text-muted hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
          <p className="font-medium text-white">{emptyCopy.title}</p>
          <p className="mt-1 text-sm text-muted">{emptyCopy.body}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => (
            <FlagCard key={flag.id} flag={flag} onResolved={handleResolved} />
          ))}
        </div>
      )}
    </div>
  );
}
