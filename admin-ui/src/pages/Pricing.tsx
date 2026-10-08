import React, { useState, useEffect, useCallback } from "react";
import { getPricing, updatePricing, getPricingHistory } from "../api";
import type { PricingSettings, PricingHistoryEntry } from "../types";
import Spinner from "../components/Spinner";

const FIELDS: { key: keyof PricingSettings; label: string; hint: string; prefix?: string }[] = [
  { key: "monthly_ngn", label: "Monthly", hint: "Price per month", prefix: "₦" },
  { key: "term_ngn", label: "Term (3 months)", hint: "Exam-season bundle", prefix: "₦" },
  { key: "yearly_ngn", label: "Yearly", hint: "Best-value annual plan", prefix: "₦" },
  { key: "free_daily_limit", label: "Free daily limit", hint: "Questions/day on the free plan" },
];

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const KEY_LABEL: Record<string, string> = {
  monthly_ngn: "Monthly price",
  term_ngn: "Term price",
  yearly_ngn: "Yearly price",
  free_daily_limit: "Free daily limit",
};

export default function Pricing() {
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<PricingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, h] = await Promise.all([getPricing(), getPricingHistory()]);
      setPricing(p);
      setForm(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])));
      setHistory(h);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty =
    pricing !== null &&
    FIELDS.some((f) => form[f.key] !== "" && Number(form[f.key]) !== pricing[f.key]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pricing) return;
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const changes: Partial<PricingSettings> = {};
      for (const f of FIELDS) {
        const n = Number(form[f.key]);
        if (!Number.isInteger(n) || n <= 0) {
          throw new Error(`${f.label} must be a positive whole number`);
        }
        if (n !== pricing[f.key]) changes[f.key] = n;
      }
      if (Object.keys(changes).length === 0) return;
      const updated = await updatePricing(changes);
      setPricing(updated);
      setForm(Object.fromEntries(Object.entries(updated).map(([k, v]) => [k, String(v)])));
      const h = await getPricingHistory();
      setHistory(h);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update pricing");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Pricing</h1>
        <p className="mt-0.5 text-sm text-muted">
          Changes take effect immediately across the bot, payment links, and landing site.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-border bg-surface p-6 sm:grid-cols-2"
      >
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
              {f.label}
            </label>
            <div className="relative">
              {f.prefix && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  {f.prefix}
                </span>
              )}
              <input
                type="number"
                min={1}
                step={1}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className={`w-full rounded-lg border border-border bg-bg py-2.5 text-sm text-white placeholder-muted focus:border-accent focus:outline-none ${
                  f.prefix ? "pl-7 pr-3" : "px-3"
                }`}
              />
            </div>
            <p className="mt-1 text-xs text-muted">{f.hint}</p>
          </div>
        ))}

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 sm:col-span-2">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success sm:col-span-2">
            Pricing updated.
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={!dirty || saving}
            className="rounded-lg bg-gradient-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Change History</h2>
        </div>
        {history.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">No changes yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Field</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">From</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h, i) => (
                  <tr key={i} className="transition-colors hover:bg-surface2">
                    <td className="px-4 py-3 text-white">{KEY_LABEL[h.key] ?? h.key}</td>
                    <td className="px-4 py-3 text-muted">{h.old_value ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-success">{h.new_value}</td>
                    <td className="px-4 py-3 text-muted">{h.updated_by ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDateTime(h.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
