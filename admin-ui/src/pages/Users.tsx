import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { getUsers, updateUserPlan, deleteUsers } from "../api";
import type { User, PaginatedResponse } from "../types";
import Spinner from "../components/Spinner";
import Badge from "../components/Badge";
import Modal from "../components/Modal";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

type Toast = { msg: string; type: "success" | "error" };

export default function Users() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const [result, setResult] = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantTarget, setGrantTarget] = useState<User | null>(null);
  const [months, setMonths] = useState(1);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  function showToast(msg: string, type: Toast["type"] = "success") {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  function setFilter(key: string, value: string, keepPage = false) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (!keepPage) next.delete("page");
        return next;
      },
      { replace: true }
    );
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers({ page, limit: 50, search: search || undefined });
      setResult(data);
      setError(null);
      setSelected(new Set());
      setSelectAllPages(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePlanChange(user: User, plan: "premium" | "free", m?: number) {
    setSaving(true);
    try {
      await updateUserPlan(user.telegram_id, plan, m);
      setGrantTarget(null);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      let result: { deleted: number };
      if (deleteTarget) {
        result = await deleteUsers({ ids: [deleteTarget.telegram_id] });
        showToast(`Deleted ${deleteTarget.first_name}`);
      } else if (selectAllPages) {
        result = await deleteUsers({ all: true, search: search || undefined });
        showToast(`Deleted ${result.deleted} users`);
      } else {
        result = await deleteUsers({ ids: Array.from(selected) });
        showToast(`Deleted ${result.deleted} user${result.deleted !== 1 ? "s" : ""}`);
      }
      setConfirmOpen(false);
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  const pageIds = result?.data.map((u) => u.telegram_id) ?? [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = pageIds.some((id) => selected.has(id));
  const hasMorePages = result ? result.total > result.data.length : false;

  function toggleAll() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
      setSelectAllPages(false);
    } else {
      setSelected((prev) => new Set([...prev, ...pageIds]));
    }
  }

  function toggleOne(id: number) {
    setSelectAllPages(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Names shown in confirm modal
  const pendingUsers: User[] = deleteTarget
    ? [deleteTarget]
    : (result?.data.filter((u) => selected.has(u.telegram_id)) ?? []);

  function deleteLabel() {
    if (deleteTarget) return deleteTarget.first_name;
    if (selectAllPages)
      return `all ${result?.total.toLocaleString()} users${search ? ` matching "${search}"` : ""}`;
    const count = selected.size;
    return `${count} user${count !== 1 ? "s" : ""}`;
  }

  function confirmBodyNames() {
    if (selectAllPages) return null;
    const names = pendingUsers.slice(0, 3).map((u) => u.first_name);
    const extra = pendingUsers.length - names.length;
    return names.join(", ") + (extra > 0 ? `, and ${extra} more` : "");
  }

  const bulkCount = selectAllPages ? (result?.total ?? 0) : selected.size;

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Users</h1>
        <p className="mt-0.5 text-sm text-muted">Manage user accounts and plans</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name, username, or Telegram ID..."
          value={search}
          onChange={(e) => setFilter("q", e.target.value)}
          className="min-w-48 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
        />
        <button
          onClick={load}
          className="shrink-0 rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
        >
          Refresh
        </button>
        {(selected.size > 0 || selectAllPages) && (
          <button
            onClick={() => {
              setDeleteTarget(null);
              setConfirmOpen(true);
            }}
            className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20"
          >
            Delete {selectAllPages ? `all ${result?.total.toLocaleString()}` : bulkCount} user
            {bulkCount !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {/* Select-all-pages banner */}
        {allOnPageSelected && hasMorePages && !selectAllPages && (
          <div className="border-b border-accent/20 bg-accent/10 px-4 py-2.5 text-center text-sm">
            <span className="text-muted">All {pageIds.length} users on this page selected. </span>
            <button
              onClick={() => setSelectAllPages(true)}
              className="font-medium text-accent hover:underline"
            >
              Select all {result?.total.toLocaleString()} users
            </button>
          </div>
        )}
        {selectAllPages && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2.5 text-center text-sm">
            <span className="text-red-300">
              All {result?.total.toLocaleString()} users selected.{" "}
            </span>
            <button
              onClick={() => {
                setSelectAllPages(false);
                setSelected(new Set(pageIds));
              }}
              className="font-medium text-red-400 hover:underline"
            >
              Undo
            </button>
          </div>
        )}

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
                    <th className="w-8 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                        }}
                        onChange={toggleAll}
                        className="cursor-pointer rounded border-border bg-surface2 text-accent focus:ring-accent focus:ring-offset-0"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Username
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Telegram ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Exam
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Subjects
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Streak
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Last Active
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Joined
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result?.data.map((u) => (
                    <tr
                      key={u.telegram_id}
                      className={`transition-colors hover:bg-surface2 ${selected.has(u.telegram_id) ? "bg-surface2" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(u.telegram_id)}
                          onChange={() => toggleOne(u.telegram_id)}
                          className="cursor-pointer rounded border-border bg-surface2 text-accent focus:ring-accent focus:ring-offset-0"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{u.first_name}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {u.username ? `@${u.username}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{u.telegram_id}</td>
                      <td className="px-4 py-3 text-muted">{u.exam_type || "—"}</td>
                      <td
                        className="max-w-xs truncate px-4 py-3 text-xs text-muted"
                        title={u.subjects?.join(", ")}
                      >
                        {u.subjects?.length ? u.subjects.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <Badge variant={u.plan === "premium" ? "green" : "gray"}>{u.plan}</Badge>
                          {u.plan === "premium" && u.plan_expires_at && (
                            <p className="mt-1 text-xs text-muted">
                              exp. {formatDate(u.plan_expires_at)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{u.streak} 🔥</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {formatDate(u.last_active_date)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{formatDate(u.joined_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.plan === "free" ? (
                            <button
                              onClick={() => {
                                setGrantTarget(u);
                                setMonths(1);
                              }}
                              className="whitespace-nowrap rounded border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/20"
                            >
                              Grant Premium
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePlanChange(u, "free")}
                              className="rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/20"
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDeleteTarget(u);
                              setConfirmOpen(true);
                            }}
                            className="rounded p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                            title="Delete user"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result?.data.length === 0 && (
                <div className="py-10 text-center text-sm text-muted">No users found</div>
              )}
            </div>

            {result && result.pages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-muted">
                  {result.total.toLocaleString()} users · page {result.page} of {result.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilter("page", String(page - 1), true)}
                    disabled={page === 1}
                    className="rounded border border-border bg-surface2 px-3 py-1.5 text-xs text-white transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilter("page", String(page + 1), true)}
                    disabled={page === result.pages}
                    className="rounded border border-border bg-surface2 px-3 py-1.5 text-xs text-white transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Grant Premium modal */}
      {grantTarget && (
        <Modal
          title={`Grant Premium — ${grantTarget.first_name}`}
          onClose={() => setGrantTarget(null)}
        >
          <div className="space-y-5">
            <p className="text-sm text-muted">
              Select how many months of premium to grant to{" "}
              <strong className="text-white">{grantTarget.first_name}</strong>
              {grantTarget.username ? ` (@${grantTarget.username})` : ""}.
            </p>
            <div>
              <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted">
                Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                      months === m
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-border bg-surface2 text-muted hover:border-muted"
                    }`}
                  >
                    {m} mo{m > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setGrantTarget(null)}
                className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePlanChange(grantTarget, "premium", months)}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
              >
                {saving && <Spinner size="sm" />}
                Grant {months} Month{months > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {confirmOpen && (
        <Modal
          title="Delete Users"
          onClose={() => {
            setConfirmOpen(false);
            setDeleteTarget(null);
          }}
        >
          <div className="space-y-5">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-300">
                Permanently delete {deleteLabel()}?
              </p>
              {!selectAllPages && confirmBodyNames() && (
                <p className="mt-1 text-xs text-red-400/70">{confirmBodyNames()}</p>
              )}
              {selectAllPages && search && (
                <p className="mt-1 text-xs text-red-400/70">Filtered by: "{search}"</p>
              )}
            </div>
            <p className="text-xs text-muted">
              This cannot be undone. All practice history, stats, and session data for these users
              will be lost.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setDeleteTarget(null);
                }}
                className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Spinner size="sm" />}
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
