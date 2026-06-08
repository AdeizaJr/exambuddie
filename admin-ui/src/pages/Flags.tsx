import React, { useState, useEffect, useCallback } from 'react';
import { getFlags, resolveFlag } from '../api';
import type { Flag } from '../types';
import Spinner from '../components/Spinner';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface FlagCardProps {
  flag: Flag;
  onResolved: () => void;
}

function FlagCard({ flag, onResolved }: FlagCardProps) {
  const [explanation, setExplanation] = useState(flag.explanation || '');
  const [saving, setSaving] = useState(false);

  async function handleSaveAndResolve() {
    setSaving(true);
    try {
      await resolveFlag(flag.id, explanation);
      onResolved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to resolve');
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
      alert(e instanceof Error ? e.message : 'Failed to resolve');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted bg-surface2 border border-border rounded px-2 py-0.5">
              {flag.subject}
            </span>
            <span className="text-xs text-muted">Correct: <strong className="text-white">{flag.correct_option}</strong></span>
            <span className="text-xs text-muted">Q#{flag.question_id}</span>
          </div>
          <p className="text-sm text-white leading-relaxed">{flag.question_text}</p>
        </div>
        <div className="text-xs text-muted sm:whitespace-nowrap">{formatDate(flag.flagged_at)}</div>
      </div>

      {flag.reason && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-400">
            <strong>Flag reason:</strong> {flag.reason}
          </p>
        </div>
      )}

      <div>
        <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-2">
          Explanation {!flag.explanation && <span className="text-red-400 ml-1">(missing)</span>}
        </label>
        <textarea
          rows={4}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent resize-y"
          placeholder="Write or update the explanation for this question..."
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleResolveOnly}
          disabled={saving}
          className="px-3 py-2 text-sm bg-surface2 border border-border text-white rounded-lg hover:bg-border transition-colors disabled:opacity-50"
        >
          Resolve Only
        </button>
        <button
          onClick={handleSaveAndResolve}
          disabled={saving}
          className="px-3 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center gap-2"
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
      setError(e instanceof Error ? e.message : 'Failed to load flags');
    } finally {
      setLoading(false);
    }
  }, [onFlagsResolved]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Flagged Explanations</h1>
          <p className="text-sm text-muted mt-0.5">
            {flags.length > 0 ? `${flags.length} unresolved flag${flags.length === 1 ? '' : 's'}` : 'All clear'}
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-surface2 border border-border text-sm text-white rounded-lg hover:bg-border transition-colors shrink-0"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">{error}</div>
      ) : flags.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-white font-medium">No pending flags</p>
          <p className="text-sm text-muted mt-1">All flagged explanations have been resolved</p>
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
