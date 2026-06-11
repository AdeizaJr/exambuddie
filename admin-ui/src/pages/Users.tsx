import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getUsers, updateUserPlan, deleteUsers } from '../api';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('q')    ?? '';
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const [result, setResult]           = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [grantTarget, setGrantTarget] = useState<User | null>(null);
  const [months, setMonths]           = useState(1);
  const [saving, setSaving]           = useState(false);

  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [deleting, setDeleting]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function setFilter(key: string, value: string, keepPage = false) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value); else next.delete(key);
        if (!keepPage) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers({ page, limit: 50, search: search || undefined });
      setResult(data);
      setError(null);
      setSelected(new Set());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

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

  async function handleDeleteSelected() {
    setDeleting(true);
    try {
      await deleteUsers(Array.from(selected));
      setConfirmDelete(false);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to delete users');
    } finally {
      setDeleting(false);
    }
  }

  const pageIds = result?.data.map((u) => u.telegram_id) ?? [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = pageIds.some((id) => selected.has(id));

  function toggleAll() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...pageIds]));
    }
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-display text-white">Users</h1>
        <p className="text-sm text-muted mt-0.5">Manage user accounts and plans</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name, username, or Telegram ID..."
          value={search}
          onChange={(e) => setFilter('q', e.target.value)}
          className="flex-1 min-w-48 bg-surface border border-border text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-accent placeholder-muted"
        />
        <button
          onClick={load}
          className="px-4 py-2 bg-surface2 border border-border text-sm text-white rounded-lg hover:bg-border transition-colors shrink-0"
        >
          Refresh
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-sm text-red-400 rounded-lg hover:bg-red-500/20 transition-colors shrink-0"
          >
            Delete {selected.size} user{selected.size > 1 ? 's' : ''}
          </button>
        )}
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
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        ref={(el) => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected; }}
                        onChange={toggleAll}
                        className="rounded border-border bg-surface2 text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer"
                      />
                    </th>
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
                    <tr
                      key={u.telegram_id}
                      className={`hover:bg-surface2 transition-colors ${selected.has(u.telegram_id) ? 'bg-surface2' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(u.telegram_id)}
                          onChange={() => toggleOne(u.telegram_id)}
                          className="rounded border-border bg-surface2 text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer"
                        />
                      </td>
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
                    onClick={() => setFilter('page', String(page - 1), true)}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs bg-surface2 border border-border text-white rounded hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilter('page', String(page + 1), true)}
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

      {confirmDelete && (
        <Modal title="Delete Users" onClose={() => setConfirmDelete(false)}>
          <div className="space-y-5">
            <p className="text-sm text-muted">
              Permanently delete{' '}
              <strong className="text-white">{selected.size} user{selected.size > 1 ? 's' : ''}</strong>?
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm bg-surface2 border border-border text-white rounded-lg hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Spinner size="sm" />}
                Delete {selected.size} User{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
