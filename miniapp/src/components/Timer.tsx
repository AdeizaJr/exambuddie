import { useEffect, useRef, useState, memo } from 'react';

interface Props {
  totalSecs: number;
  onExpire: () => void;
  label?: string;
  size?: 'sm' | 'lg';
}

function Timer({ totalSecs, onExpire, label, size = 'sm' }: Props) {
  const [secs, setSecs] = useState(totalSecs);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setSecs(totalSecs);
    const id = setInterval(() => {
      setSecs(prev => {
        if (prev <= 1) { clearInterval(id); onExpireRef.current(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [totalSecs]);

  const pct = Math.max(0, secs / totalSecs);
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

export default memo(Timer);
