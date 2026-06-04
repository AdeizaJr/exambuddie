import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSubscriptions } from '../api';
import type { Subscription } from '../types';
import Spinner from '../components/Spinner';
import Badge from '../components/Badge';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusVariant(status: string): 'green' | 'amber' | 'red' | 'gray' {
  if (status === 'active') return 'green';
  if (status === 'pending') return 'amber';
  if (status === 'failed' || status === 'cancelled') return 'red';
  return 'gray';
}

export default function Subscriptions() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive filter values from URL
  const statusFilter = searchParams.get('status') ?? '';

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function setFilter(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value); else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubscriptions();
      setSubs(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Apply status filter client-side (all subs are loaded at once)
  const filtered = statusFilter
    ? subs.filter((s) => s.status === statusFilter)
    : subs;

  const totalRevenue = subs
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + Number(s.amount_ngn), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Subscriptions</h1>
          <p className="text-sm text-muted mt-0.5">
            {filtered.length} subscription{filtered.length !== 1 ? 's' : ''}
            {statusFilter ? ` (${statusFilter})` : ''} · Active revenue:{' '}
            <span className="text-accent font-medium">₦{totalRevenue.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setFilter('status', e.target.value)}
            className="bg-surface border border-border text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={load}
            className="px-4 py-2 bg-surface2 border border-border text-sm text-white rounded-lg hover:bg-border transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6 text-red-400">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Started</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Expires</th>
                  <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-surface2 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{s.first_name}</p>
                        <p className="text-xs text-muted">
                          {s.username ? `@${s.username}` : `ID: ${s.telegram_id}`}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted capitalize">{s.plan}</td>
                    <td className="px-4 py-3 text-accent font-medium">
                      ₦{Number(s.amount_ngn).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">{formatDate(s.started_at)}</td>
                    <td className="px-4 py-3 text-muted text-xs">{formatDate(s.expires_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted truncate max-w-xs" title={s.flutterwave_tx_ref || ''}>
                      {s.flutterwave_tx_ref || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-10 text-muted text-sm">No subscriptions found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
