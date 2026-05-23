import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, icon, accent = false }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted uppercase tracking-wider font-medium">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div>
        <p className={`text-2xl font-bold font-display ${accent ? 'text-accent' : 'text-white'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
      </div>
    </div>
  );
}
