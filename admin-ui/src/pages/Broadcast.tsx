import React, { useState, useEffect, useCallback } from 'react';
import { broadcast, getStats } from '../api';
import type { BroadcastTarget } from '../api';
import type { Stats } from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface TargetOption {
  value: BroadcastTarget;
  label: string;
  description: string;
}

const TARGETS: TargetOption[] = [
  { value: 'all', label: 'All Users', description: 'Every registered user' },
  { value: 'waec', label: 'WAEC Students', description: 'Users preparing for WAEC' },
  { value: 'jamb', label: 'JAMB Students', description: 'Users preparing for JAMB' },
  { value: 'neco', label: 'NECO Students', description: 'Users preparing for NECO' },
  { value: 'premium', label: 'Premium Users', description: 'Paying subscribers only' },
  { value: 'free', label: 'Free Users', description: 'Non-paying users' },
];

function estimateReach(target: BroadcastTarget, stats: Stats | null): number | null {
  if (!stats) return null;
  if (target === 'all') return stats.total_users;
  if (target === 'premium') return stats.premium_users;
  if (target === 'free') return stats.total_users - stats.premium_users;
  return null; // can't estimate exam-type splits without extra data
}

export default function Broadcast() {
  const [target, setTarget] = useState<BroadcastTarget>('all');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
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
      setMessage('');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Broadcast failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold font-display text-white">Broadcast</h1>
        <p className="text-sm text-muted mt-0.5">Send a message to all or targeted users</p>
      </div>

      {result && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
          <p className="text-accent font-medium text-sm">Broadcast sent successfully</p>
          <div className="flex gap-6 mt-2">
            <span className="text-xs text-muted">Sent: <strong className="text-accent">{result.sent}</strong></span>
            <span className="text-xs text-muted">Failed: <strong className="text-red-400">{result.failed}</strong></span>
            <span className="text-xs text-muted">Total: <strong className="text-white">{result.total}</strong></span>
          </div>
          <button
            onClick={() => setResult(null)}
            className="mt-3 text-xs text-muted hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Target selection */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-3">Target Audience</label>
        <div className="space-y-2">
          {TARGETS.map((t) => (
            <label
              key={t.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                target === t.value
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-surface hover:border-muted'
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
                <span className="text-xs text-accent font-medium">
                  ~{reach.toLocaleString()} users
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-2">
          Message <span className="text-muted normal-case font-normal">(Markdown supported)</span>
        </label>
        <textarea
          rows={8}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message here...&#10;&#10;*Bold*, _italic_, `code` and links work.&#10;&#10;Keep messages concise and clear."
          className="w-full bg-surface border border-border text-white text-sm rounded-lg px-3 py-3 focus:outline-none focus:border-accent resize-y placeholder-muted"
        />
        <p className="text-xs text-muted mt-1">{message.length} characters</p>
      </div>

      {/* Preview */}
      {message && (
        <div>
          <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-2">Preview</label>
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="bg-surface2 rounded-lg p-3">
              <p className="text-xs text-muted mb-2">ExamBuddie Bot · Telegram</p>
              <pre className="text-sm text-white whitespace-pre-wrap font-sans leading-relaxed">{message}</pre>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowConfirm(true)}
        disabled={!message.trim() || sending}
        className="w-full py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {sending ? (
          <>
            <Spinner size="sm" />
            Sending...
          </>
        ) : (
          'Send Broadcast'
        )}
      </button>

      {showConfirm && (
        <Modal title="Confirm Broadcast" onClose={() => setShowConfirm(false)}>
          <div className="space-y-4">
            <p className="text-sm text-white">
              You are about to send a message to{' '}
              <strong className="text-accent">
                {reach !== null ? `~${reach.toLocaleString()}` : 'all matching'}
              </strong>{' '}
              users ({TARGETS.find((t) => t.value === target)?.label}).
            </p>
            <div className="bg-surface2 border border-border rounded-lg p-3">
              <pre className="text-sm text-muted whitespace-pre-wrap">{message.slice(0, 200)}{message.length > 200 ? '…' : ''}</pre>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-400">
                Messages are sent at 50ms intervals. Large audiences may take several minutes.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm bg-surface2 border border-border text-white rounded-lg hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors flex items-center gap-2"
              >
                Yes, Send Now
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
