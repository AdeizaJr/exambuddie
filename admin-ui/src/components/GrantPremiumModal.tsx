import React, { useState } from "react";
import { updateUserPlan } from "../api";
import type { User } from "../types";
import Spinner from "./Spinner";
import Modal from "./Modal";

type Unit = "week" | "month";

const AMOUNTS: Record<Unit, number[]> = {
  week: [1, 2, 3, 4],
  month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

function plural(n: number, unit: Unit): string {
  return `${n} ${unit === "week" ? "Week" : "Month"}${n > 1 ? "s" : ""}`;
}

// Mirrors the server: grants stack on top of unexpired Premium, otherwise start today.
function currentEnd(user: User): Date | null {
  if (user.plan !== "premium" || !user.plan_expires_at) return null;
  const end = new Date(user.plan_expires_at);
  return end.getTime() > Date.now() ? end : null;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function endDate(from: Date | null, n: number, unit: Unit): string {
  const d = from ? new Date(from) : new Date();
  if (unit === "week") d.setDate(d.getDate() + n * 7);
  else d.setMonth(d.getMonth() + n);
  return fmt(d);
}

const selectCls =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none";

// Grant Premium for N weeks or N months. Shared by the Users and Overview pages.
export default function GrantPremiumModal({
  user,
  onClose,
  onGranted,
}: {
  user: User;
  onClose: () => void;
  onGranted: (message: string, ok: boolean) => void;
}) {
  const [unit, setUnit] = useState<Unit>("month");
  const [amount, setAmount] = useState(1);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = currentEnd(user);
  const verb = existing ? "Extend" : "Grant";

  async function grant() {
    setSaving(true);
    setError(null);
    try {
      const r = await updateUserPlan(user.telegram_id, "premium", amount, unit, notify);
      if (r.notified === false) {
        onGranted(`Premium granted to ${user.first_name}, but the Telegram message failed (they may have blocked the bot)`, false);
      } else {
        onGranted(`Premium granted to ${user.first_name}${r.notified ? " and they've been notified" : ""}`, true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`${verb} Premium — ${user.first_name}`} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-muted">
          {existing ? "Choose how much Premium to add for " : "Choose how long "}
          <strong className="text-white">{user.first_name}</strong>
          {user.username ? ` (@${user.username})` : ""}
          {existing ? "" : " gets Premium"}.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Length</span>
            <select
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className={selectCls}
            >
              {AMOUNTS[unit].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Unit</span>
            <select
              value={unit}
              onChange={(e) => {
                const u = e.target.value as Unit;
                setUnit(u);
                if (!AMOUNTS[u].includes(amount)) setAmount(1);
              }}
              className={selectCls}
            >
              <option value="week">Weeks</option>
              <option value="month">Months</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted">
          {existing && (
            <>Currently ends <span className="text-white">{fmt(existing)}</span>. </>
          )}
          Premium will end on <span className="text-white">{endDate(existing, amount, unit)}</span>.
        </p>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="mt-0.5 cursor-pointer rounded border-border bg-surface2 text-accent focus:ring-accent focus:ring-offset-0"
          />
          <span className="text-sm text-white">
            Notify them on Telegram
            <span className="mt-0.5 block text-xs text-muted">
              Tells them about the gift and that every friend they invite earns 1 more Premium day.
            </span>
          </span>
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
          >
            Cancel
          </button>
          <button
            onClick={grant}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-accent-dark px-4 py-2 text-sm text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
          >
            {saving && <Spinner size="sm" />}
            {existing ? "Add" : "Grant"} {plural(amount, unit)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
