import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, icon, accent = false }: StatCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div>
        <p className={`font-display text-2xl font-bold ${accent ? "text-accent" : "text-white"}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}
