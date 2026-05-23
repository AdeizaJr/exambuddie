interface Props {
  secs: number;
  total: number;
  label?: string;
  size?: 'sm' | 'lg';
}

export default function Timer({ secs, total, label, size = 'sm' }: Props) {
  const pct = Math.max(0, secs / total);
  const urgent = secs <= 10;
  const color = urgent ? '#ef4444' : secs <= 20 ? '#f97316' : 'var(--tg-button)';

  if (size === 'lg') {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return (
      <div className="text-center">
        {label && <p className="text-xs text-[var(--tg-hint)] mb-1">{label}</p>}
        <p className={`text-2xl font-bold tabular-nums ${urgent ? 'text-red-500' : 'text-[var(--tg-text)]'}`}>
          {mins}:{s.toString().padStart(2, '0')}
        </p>
        <div className="mt-1 h-1 rounded-full bg-gray-200 overflow-hidden w-24 mx-auto">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct * 100}%`, background: color }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-[var(--tg-hint)]">{label}</span>}
      <span className={`text-sm font-bold tabular-nums ${urgent ? 'text-red-500' : 'text-[var(--tg-text)]'}`}>
        {secs}s
      </span>
      <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden min-w-[40px]">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}
