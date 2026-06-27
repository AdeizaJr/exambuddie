import React, { useState, useEffect, useCallback, useRef } from "react";
import { broadcast, getStats, searchUsers, sendDM } from "../api";
import type { BroadcastTarget, UserSearchResult } from "../api";
import type { Stats } from "../types";
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
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [dmMessage, setDmMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setSelected(null);
    setSent(false);
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

  async function handleSend() {
    if (!selected || !dmMessage.trim()) return;
    setSending(true);
    try {
      await sendDM(selected.telegram_id, dmMessage.trim());
      setSent(true);
      setDmMessage("");
      setQuery("");
      setSelected(null);
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

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div>
        <h2 className="font-medium text-white">Direct Message</h2>
        <p className="text-xs text-muted mt-0.5">Send a message to one specific user</p>
      </div>

      {sent && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          ✓ Message sent!{" "}
          <button onClick={() => setSent(false)} className="underline text-xs opacity-70 hover:opacity-100">
            Send another
          </button>
        </div>
      )}

      {/* User search */}
      <div className="relative">
        <input
          type="text"
          value={selected ? `${selected.first_name}${selected.username ? ` (@${selected.username})` : ""}` : query}
          onChange={selected ? undefined : handleQueryChange}
          readOnly={!!selected}
          placeholder="Type a name or username..."
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
        />
        {selected && (
          <button
            onClick={() => { setSelected(null); setQuery(""); setResults([]); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-white px-1"
          >
            ✕
          </button>
        )}
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
        {!selected && results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
            {results.map((u) => (
              <button
                key={u.telegram_id}
                onClick={() => { setSelected(u); setResults([]); }}
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

      {/* Message input — only show once user selected */}
      {selected && (
        <>
          <div className="rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-muted">
            To: <strong className="text-white">{selected.first_name}</strong>
            {selected.username && <span> (@{selected.username})</span>}
            {" · "}
            <span className={`font-medium ${selected.plan === "premium" ? "text-accent" : ""}`}>{selected.plan}</span>
            {selected.streak > 0 && <span> · 🔥 {selected.streak} streak</span>}
          </div>
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? <><Spinner size="sm" /> Sending...</> : "Send Message"}
          </button>
        </>
      )}
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
      <div className="flex gap-6 items-start">
        {/* Left — bulk broadcast */}
        <div className="min-w-0 flex-1 max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Broadcast</h1>
          <p className="mt-0.5 text-sm text-muted">Send a message to all or targeted users</p>
        </div>

      {result && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
          <p className="text-sm font-medium text-accent">Broadcast sent successfully</p>
          <div className="mt-2 flex gap-6">
            <span className="text-xs text-muted">
              Sent: <strong className="text-accent">{result.sent}</strong>
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
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 font-medium text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
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
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-dark"
              >
                Yes, Send Now
              </button>
            </div>
          </div>
        </Modal>
      )}

        </div>{/* end left column */}

        {/* Right — direct message, sticky top */}
        <div className="w-80 shrink-0 sticky top-6">
          <DirectMessage />
        </div>
      </div>
    </div>
  );
}
