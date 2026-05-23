import React, { useState, useEffect, useCallback } from 'react';
import { getUsers, updateUserPlan } from '../api';
import type { User, PaginatedResponse } from '../types';
import Spinner from '../components/Spinner';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Users() {
  const [result, setResult] = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [grantTarget, setGrantTarget] = useState<User | null>(null);
  const [months, setMonths] = useState(1);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers({ page, limit: 50, search: search || undefined });
      setResult(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePlanChange(user: User, plan: 'premium' | 'free', m?: number) {
    setSaving(true);
    try {
      await updateUserPlan(user.telegram_id, plan, m);
      setGrantTarget(null);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-display text-white">Users</h1>
        <p className="text-sm text-muted mt-0.5">Manage user accounts and plans</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name, username, or Telegram ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-surface border border-border text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-accent placeholder-muted"
        />
        <button
          onClick={load}
          className="px-4 py-2 bg-surface2 border border-border text-sm text-white rounded-lg hover:bg-border transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6 text-red-400">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Username</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Telegram ID</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Exam</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Subjects</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Plan</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Streak</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Last Active</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Joined</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result?.data.map((u) => (
                    <tr key={u.telegram_id} className="hover:bg-surface2 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{u.first_name}</td>
                      <td className="px-4 py-3 text-muted text-xs">{u.username ? `@${u.username}` : '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{u.telegram_id}</td>
                      <td className="px-4 py-3 text-muted">{u.exam_type || '—'}</td>
                      <td className="px-4 py-3 text-muted text-xs max-w-xs truncate" title={u.subjects?.join(', ')}>
                        {u.subjects?.length ? u.subjects.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <Badge variant={u.plan === 'premium' ? 'green' : 'gray'}>{u.plan}</Badge>
                          {u.plan === 'premium' && u.plan_expires_at && (
                            <p className="text-xs text-muted mt-1">
                              exp. {formatDate(u.plan_expires_at)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{u.streak} 🔥</td>
                      <td className="px-4 py-3 text-muted text-xs">{formatDate(u.last_active_date)}</td>
                      <td className="px-4 py-3 text-muted text-xs">{formatDate(u.joined_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.plan === 'free' ? (
                            <button
                              onClick={() => { setGrantTarget(u); setMonths(1); }}
                              className="text-xs px-2.5 py-1 bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors whitespace-nowrap"
                            >
                              Grant Premium
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePlanChange(u, 'free')}
                              className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result?.data.length === 0 && (
                <div className="text-center py-10 text-muted text-sm">No users found</div>
              )}
            </div>

            {result && result.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted">
                  {result.total.toLocaleString()} users · page {result.page} of {result.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs bg-surface2 border border-border text-white rounded hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(result.pages, p + 1))}
                    disabled={page === result.pages}
                    className="px-3 py-1.5 text-xs bg-surface2 border border-border text-white rounded hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {grantTarget && (
        <Modal title={`Grant Premium — ${grantTarget.first_name}`} onClose={() => setGrantTarget(null)}>
          <div className="space-y-5">
            <p className="text-sm text-muted">
              Select how many months of premium to grant to{' '}
              <strong className="text-white">{grantTarget.first_name}</strong>
              {grantTarget.username ? ` (@${grantTarget.username})` : ''}.
            </p>
            <div>
              <label className="block text-xs text-muted uppercase tracking-wider font-medium mb-3">Duration</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                      months === m
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'bg-surface2 border-border text-muted hover:border-muted'
                    }`}
                  >
                    {m} mo{m > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setGrantTarget(null)}
                className="px-4 py-2 text-sm bg-surface2 border border-border text-white rounded-lg hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePlanChange(grantTarget, 'premium', months)}
                disabled={saving}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Spinner size="sm" />}
                Grant {months} Month{months > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
