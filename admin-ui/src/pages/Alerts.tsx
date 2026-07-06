import React, { useState, useEffect, useCallback } from "react";
import { getAlerts, resolveAlert, invalidateCache } from "../api";
import type { SystemAlert } from "../types";
import Spinner from "../components/Spinner";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SEVERITY_STYLE: Record<SystemAlert["severity"], string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  info: "border-blue-500/20 bg-blue-500/10 text-blue-400",
};

interface AlertCardProps {
  alert: SystemAlert;
  onResolved: (id: number) => void;
}

function AlertCard({ alert, onResolved }: AlertCardProps) {
  const [resolving, setResolving] = useState(false);

  async function handleResolve() {
    setResolving(true);
    try {
      await resolveAlert(alert.id);
      onResolved(alert.id);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Failed to resolve");
      setResolving(false);
    }
  }

  return (
    <div className={`space-y-3 rounded-xl border bg-surface p-5 ${SEVERITY_STYLE[alert.severity]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${SEVERITY_STYLE[alert.severity]}`}>
            {alert.severity}
          </span>
          <span className="rounded border border-border bg-surface2 px-2 py-0.5 text-xs font-medium text-muted">
            {alert.source}
          </span>
        </div>
        <span className="text-xs text-muted">{formatDate(alert.created_at)}</span>
      </div>
      <p className="text-sm leading-relaxed text-white">{alert.message}</p>
      <div className="flex justify-end">
        <button
          onClick={handleResolve}
          disabled={resolving}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-white transition-colors hover:bg-border disabled:opacity-50"
        >
          {resolving && <Spinner size="sm" />}
          Resolve
        </button>
      </div>
    </div>
  );
}

interface AlertsProps {
  onAlertsResolved?: () => void;
}

export default function Alerts({ onAlertsResolved }: AlertsProps) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAlerts();
      setAlerts(data);
      setError(null);
      onAlertsResolved?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [onAlertsResolved]);

  const handleResolved = useCallback((id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    invalidateCache("/alerts");
    onAlertsResolved?.();
  }, [onAlertsResolved]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">System Alerts</h1>
          <p className="mt-0.5 text-sm text-muted">
            {alerts.length > 0
              ? `${alerts.length} unresolved alert${alerts.length === 1 ? "" : "s"}`
              : "All clear"}
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mb-3 text-4xl">✅</div>
          <p className="font-medium text-white">No active alerts</p>
          <p className="mt-1 text-sm text-muted">Crons and background jobs report failures here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onResolved={handleResolved} />
          ))}
        </div>
      )}
    </div>
  );
}
