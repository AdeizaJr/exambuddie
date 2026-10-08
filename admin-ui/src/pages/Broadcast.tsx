import React, { useState, useEffect, useCallback, useRef } from "react";
import { broadcast, getStats, searchUsers, sendDM, getBroadcastHistory, MAX_DM_RECIPIENTS } from "../api";
import type { BroadcastTarget, UserSearchResult } from "../api";
import type { Stats, BroadcastLog } from "../types";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";

interface TargetOption {
  value: BroadcastTarget;
  label: string;
  description: string;
}

const TARGETS: TargetOption[] = [
  { value: "all", label: "All Users", description: "Every registered user" },
  { value: "waec", label: "WAEC Students", description: "Users preparing for WAEC" },
  { value: "jamb", label: "JAMB Students", description: "Users preparing for JAMB" },
  { value: "neco", label: "NECO Students", description: "Users preparing for NECO" },
  { value: "premium", label: "Premium Users", description: "Paying subscribers only" },
  { value: "free", label: "Free Users", description: "Non-paying users" },
];

function estimateReach(target: BroadcastTarget, stats: Stats | null): number | null {
  if (!stats) return null;
  if (target === "all") return stats.total_users;
  if (target === "premium") return stats.premium_users;
  if (target === "free") return stats.total_users - stats.premium_users;
  return null; // can't estimate exam-type splits without extra data
}

function DirectMessage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [dmMessage, setDmMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [failedNames, setFailedNames] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const atLimit = selected.length >= MAX_DM_RECIPIENTS;

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setSentCount(null);
    setFailedNames([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchUsers(q.trim());
        setResults(r);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }

  function addUser(u: UserSearchResult) {
    if (atLimit) return;
    setSelected((prev) => (prev.some((s) => s.telegram_id === u.telegram_id) ? prev : [...prev, u]));
    setQuery("");
    setResults([]);
  }

  function removeUser(telegramId: number) {
    setSelected((prev) => prev.filter((s) => s.telegram_id !== telegramId));
  }

  async function handleSend() {
    if (!selected.length || !dmMessage.trim()) return;
    setSending(true);
    try {
      const r = await sendDM(selected.map((s) => s.telegram_id), dmMessage.trim());
      // Number(): Postgres bigint ids can arrive as strings
      const failedIds = new Set(r.failed.map((f) => Number(f.telegram_id)));
      const stillFailed = selected.filter((s) => failedIds.has(Number(s.telegram_id)));
      setSentCount(r.sent);
      setFailedNames(stillFailed.map((s) => s.first_name));
      // Keep failed recipients + message so the admin can retry just those
      setSelected(stillFailed);
      if (!stillFailed.length) setDmMessage("");
      setQuery("");
      setResults([]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  const planBadge = (plan: string) =>
    plan === "premium"
      ? "text-accent border-accent/30 bg-accent/10"
      : "text-muted border-border bg-surface2";

  const visibleResults = results.filter((u) => !selected.some((s) => s.telegram_id === u.telegram_id));

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div>
        <h2 className="font-medium text-white">Direct Message</h2>
        <p className="text-xs text-muted mt-0.5">Send a message to up to {MAX_DM_RECIPIENTS} specific users</p>
      </div>

      {sentCount !== null && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          ✓ Sent to {sentCount} user{sentCount === 1 ? "" : "s"}!{" "}
          <button onClick={() => { setSentCount(null); setFailedNames([]); }} className="underline text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}
      {failedNames.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          Failed to reach: {failedNames.join(", ")}. They are still selected, press send to retry.
        </div>
      )}

      {/* Selected recipients */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u.telegram_id}
              className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 py-0.5 pl-2.5 pr-1 text-xs text-white"
            >
              {u.first_name}
              {u.username && <span className="text-muted">@{u.username}</span>}
              <button
                onClick={() => removeUser(u.telegram_id)}
                aria-label={`Remove ${u.first_name}`}
                className="rounded-full px-1 text-muted hover:text-white"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* User search */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          disabled={atLimit}
          placeholder={atLimit ? `Limit of ${MAX_DM_RECIPIENTS} users reached` : selected.length ? "Add another user..." : "Type a name or username..."}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
        {!atLimit && visibleResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
            {visibleResults.map((u) => (
              <button
                key={u.telegram_id}
                onClick={() => addUser(u)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface2 first:rounded-t-lg last:rounded-b-lg"
              >
                <div>
                  <span className="font-medium text-white">{u.first_name}</span>
                  {u.username && <span className="ml-1.5 text-xs text-muted">@{u.username}</span>}
                  {u.exam_type && <span className="ml-1.5 text-xs text-muted">{u.exam_type}</span>}
                </div>
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${planBadge(u.plan)}`}>
                  {u.plan}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted">
        {selected.length}/{MAX_DM_RECIPIENTS} selected
      </p>

      {/* Message input — only show once at least one user selected */}
      {selected.length > 0 && (
        <>
          <textarea
            rows={5}
            value={dmMessage}
            onChange={(e) => setDmMessage(e.target.value)}
            placeholder="Write your message... (HTML supported: <b>bold</b>, <i>italic</i>)"
            className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!dmMessage.trim() || sending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-dark py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <><Spinner size="sm" /> Sending...</>
            ) : selected.length === 1 ? (
              "Send Message"
            ) : (
              `Send to ${selected.length} users`
            )}
          </button>
        </>
      )}
    </div>
  );
}

function BroadcastHistory() {
  const [history, setHistory] = useState<BroadcastLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBroadcastHistory().then(setHistory).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-6 text-center"><Spinner size="sm" /></div>;
  if (!history.length) return <p className="py-4 text-xs text-muted">No broadcasts sent yet.</p>;

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {history.map((b) => (
        <div key={b.id} className="rounded-lg border border-border bg-surface2 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase text-accent">{b.target}</span>
            <span className="text-xs text-muted">{new Date(b.sent_at).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <p className="text-xs text-white line-clamp-2 mb-1.5">{b.message}</p>
          <div className="flex gap-4 text-xs text-muted">
            <span>✅ {b.sent}</span>
            {b.failed > 0 && <span className="text-red-400">❌ {b.failed}</span>}
            <span className="ml-auto">of {b.total}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Broadcast() {
  const [target, setTarget] = useState<BroadcastTarget>("all");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(
    null
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const reach = estimateReach(target, stats);

  async function handleSend() {
    setSending(true);
    setShowConfirm(false);
    try {
      const r = await broadcast(message, target);
      setResult(r);
      setMessage("");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6">
      {/* Two-column layout: broadcast left, DM right */}
      <div className="flex flex-col gap-6 items-start lg:flex-row">
        {/* Left — bulk broadcast */}
        <div className="min-w-0 flex-1 max-w-2xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-white">Broadcast</h1>
            <p className="mt-0.5 text-sm text-muted">Send a message to all or targeted users</p>
          </div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-white"
          >
            {showHistory ? "Hide" : "Show"} History
          </button>
        </div>
        {showHistory && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Broadcast History</h2>
            <BroadcastHistory />
          </div>
        )}

      {result && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4">
          <p className="text-sm font-medium text-success">Broadcast sent successfully</p>
          <div className="mt-2 flex gap-6">
            <span className="text-xs text-muted">
              Sent: <strong className="text-success">{result.sent}</strong>
            </span>
            <span className="text-xs text-muted">
              Failed: <strong className="text-red-400">{result.failed}</strong>
            </span>
            <span className="text-xs text-muted">
              Total: <strong className="text-white">{result.total}</strong>
            </span>
          </div>
          <button
            onClick={() => setResult(null)}
            className="mt-3 text-xs text-muted transition-colors hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Target selection */}
      <div>
        <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
          Target Audience
        </label>
        <div className="space-y-2">
          {TARGETS.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                target === t.value
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface hover:border-muted"
              }`}
            >
              <input
                type="radio"
                name="target"
                value={t.value}
                checked={target === t.value}
                onChange={() => setTarget(t.value)}
                className="accent-accent"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{t.label}</p>
                <p className="text-xs text-muted">{t.description}</p>
              </div>
              {t.value === target && reach !== null && (
                <span className="text-xs font-medium text-accent">
                  ~{reach.toLocaleString()} users
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
          Message <span className="font-normal normal-case text-muted">(Markdown supported)</span>
        </label>
        <textarea
          rows={8}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message here...&#10;&#10;*Bold*, _italic_, `code` and links work.&#10;&#10;Keep messages concise and clear."
          className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-3 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-xs text-muted">{message.length} characters</p>
      </div>

      {/* Preview */}
      {message && (
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
            Preview
          </label>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="rounded-lg bg-surface2 p-3">
              <p className="mb-2 text-xs text-muted">ExamBuddie Bot · Telegram</p>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white">
                {message}
              </pre>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowConfirm(true)}
        disabled={!message.trim() || sending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-dark py-3 font-medium text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sending ? (
          <>
            <Spinner size="sm" />
            Sending...
          </>
        ) : (
          "Send Broadcast"
        )}
      </button>

      {showConfirm && (
        <Modal title="Confirm Broadcast" onClose={() => setShowConfirm(false)}>
          <div className="space-y-4">
            <p className="text-sm text-white">
              You are about to send a message to{" "}
              <strong className="text-accent">
                {reach !== null ? `~${reach.toLocaleString()}` : "all matching"}
              </strong>{" "}
              users ({TARGETS.find((t) => t.value === target)?.label}).
            </p>
            <div className="rounded-lg border border-border bg-surface2 p-3">
              <pre className="whitespace-pre-wrap text-sm text-muted">
                {message.slice(0, 200)}
                {message.length > 200 ? "…" : ""}
              </pre>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <p className="text-xs text-amber-400">
                Messages are sent at 50ms intervals. Large audiences may take several minutes.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="flex items-center gap-2 rounded-lg bg-accent-dark px-4 py-2 text-sm text-white transition-colors hover:bg-accent-deep"
              >
                Yes, Send Now
              </button>
            </div>
          </div>
        </Modal>
      )}

        </div>{/* end left column */}

        {/* Right — direct message, sticky top */}
        <div className="w-full shrink-0 lg:w-80 lg:sticky lg:top-6">
          <DirectMessage />
        </div>
      </div>
    </div>
  );
}
