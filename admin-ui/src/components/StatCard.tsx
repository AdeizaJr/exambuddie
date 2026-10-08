import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
  trend?: "up" | "down" | "neutral";
}

export default function StatCard({ label, value, sub, icon, accent = false, trend }: StatCardProps) {
  const trendColor =
    trend === "up" ? "text-success" : trend === "down" ? "text-red-400" : "text-muted";
  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "";

  return (
    <div className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-surface p-5 transition-colors hover:border-surface3">
      {/* Subtle top-right glow for accent cards */}
      {accent && (
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />
      )}

      <div className="flex items-start justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            accent ? "bg-accent/15 text-accent" : "bg-surface2 text-muted"
          }`}
        >
          {icon}
        </span>
      </div>

      <div>
        <p className={`font-display text-3xl font-bold tracking-tight ${accent ? "text-accent-light" : "text-white"}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && (
          <p className={`mt-1.5 text-xs font-medium ${trendArrow ? trendColor : "text-muted"}`}>
            {trendArrow && <span className="mr-0.5">{trendArrow}</span>}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
