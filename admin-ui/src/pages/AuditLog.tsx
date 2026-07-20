import React, { useState, useEffect, useCallback } from "react";
import { getAuditLogs } from "../api";
import type { AuditLogEntry } from "../types";
import Spinner from "../components/Spinner";
import Badge from "../components/Badge";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actionVariant(action: string): "green" | "amber" | "red" | "blue" | "gray" {
  if (action.endsWith("login_failed")) return "red";
  if (action.endsWith("delete")) return "red";
  if (action.endsWith("login") || action.endsWith("password_change")) return "blue";
  if (action.includes("plan_change") || action.includes("pricing")) return "amber";
  return "gray";
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const load = useCallback(async (o: number) => {
    setLoading(true);
    try {
      const data = await getAuditLogs(limit, o);
      setLogs(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(offset);
  }, [load, offset]);

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Audit Log</h1>
          <p className="mt-0.5 text-sm text-muted">
            Every admin action, append-only — this list can't be edited or deleted, even from here.
          </p>
        </div>
        <button
          onClick={() => load(offset)}
          className="shrink-0 rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
        >
          Refresh
        </button>
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
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-surface2">
                    <td className="px-4 py-3 font-medium text-white">{log.admin_username}</td>
                    <td className="px-4 py-3">
                      <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {log.target_type ? `${log.target_type} #${log.target_id}` : "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-muted" title={log.details ? JSON.stringify(log.details) : ""}>
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{log.ip_address || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="py-10 text-center text-sm text-muted">No audit log entries yet</div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setOffset((o) => Math.max(0, o - limit))}
          disabled={offset === 0 || loading}
          className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border disabled:opacity-40"
        >
          Newer
        </button>
        <button
          onClick={() => setOffset((o) => o + limit)}
          disabled={logs.length < limit || loading}
          className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border disabled:opacity-40"
        >
          Older
        </button>
      </div>
    </div>
  );
}
