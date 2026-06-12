import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getSubscriptions } from "../api";
import type { Subscription } from "../types";
import Spinner from "../components/Spinner";
import Badge from "../components/Badge";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusVariant(status: string): "green" | "amber" | "red" | "gray" {
  if (status === "active") return "green";
  if (status === "pending") return "amber";
  if (status === "failed" || status === "cancelled") return "red";
  return "gray";
}

export default function Subscriptions() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive filter values from URL
  const statusFilter = searchParams.get("status") ?? "";

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function setFilter(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSubscriptions();
      setSubs(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Apply status filter client-side (all subs are loaded at once)
  const filtered = statusFilter ? subs.filter((s) => s.status === statusFilter) : subs;

  const totalRevenue = subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + Number(s.amount_ngn), 0);

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Subscriptions</h1>
          <p className="mt-0.5 text-sm text-muted">
            {filtered.length} subscription{filtered.length !== 1 ? "s" : ""}
            {statusFilter ? ` (${statusFilter})` : ""} · Active revenue:{" "}
            <span className="font-medium text-accent">₦{totalRevenue.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setFilter("status", e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={load}
            className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
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
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Expires
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Ref
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-surface2">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{s.first_name}</p>
                        <p className="text-xs text-muted">
                          {s.username ? `@${s.username}` : `ID: ${s.telegram_id}`}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted">{s.plan}</td>
                    <td className="px-4 py-3 font-medium text-accent">
                      ₦{Number(s.amount_ngn).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(s.started_at)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(s.expires_at)}</td>
                    <td
                      className="max-w-xs truncate px-4 py-3 font-mono text-xs text-muted"
                      title={s.flutterwave_tx_ref || ""}
                    >
                      {s.flutterwave_tx_ref || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-muted">No subscriptions found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
