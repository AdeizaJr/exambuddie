import React, { useState } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

// Fixed order, checked for colour-blind separation against the card surface (#161B22)
export const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
export const NEUTRAL_COLOR = "#6E7681";

const SURFACE = "#161B22";
const SIZE = 140;
const CENTER = SIZE / 2;
const OUTER = 66;
const INNER = 44;

// Keeps the biggest `max` items and rolls the rest (plus `extraOther`) into one grey "Other" slice
export function foldSlices(
  items: { label: string; value: number }[],
  max = SERIES_COLORS.length,
  extraOther = 0
): DonutSlice[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, max).map((i, idx) => ({ ...i, color: SERIES_COLORS[idx] }));
  const rest = sorted.slice(max).reduce((sum, i) => sum + i.value, 0) + Math.max(extraOther, 0);
  return rest > 0 ? [...top, { label: "Other", value: rest, color: NEUTRAL_COLOR }] : top;
}

function point(radius: number, angle: number): string {
  return `${CENTER + radius * Math.cos(angle)} ${CENTER + radius * Math.sin(angle)}`;
}

function arcPath(start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${point(OUTER, start)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end)}`,
    `L ${point(INNER, end)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)}`,
    "Z",
  ].join(" ");
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** Word shown under the total in the middle, e.g. "users" */
  centerLabel: string;
  /** Hide the built-in legend when the surrounding card already lists the slices */
  legend?: boolean;
}

export default function DonutChart({ slices, centerLabel, legend = true }: DonutChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const visible = slices.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className="py-4 text-center text-xs text-muted">No data yet</p>;
  }

  // "<1" so a small but real slice never reads as zero
  const pct = (value: number) => {
    const rounded = Math.round((value / total) * 100);
    return rounded === 0 ? "<1" : String(rounded);
  };

  let cursor = -Math.PI / 2;
  const arcs = visible.map((s) => {
    const start = cursor;
    // A full circle has the same start and end point, so stop just short of it
    const sweep = Math.min((s.value / total) * Math.PI * 2, Math.PI * 2 - 0.0001);
    cursor += sweep;
    return arcPath(start, start + sweep);
  });

  const focused = active !== null ? visible[active] : null;
  const summary = visible.map((s) => `${s.label} ${pct(s.value)}%`).join(", ");

  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${centerLabel}: ${summary}`}>
          {visible.map((s, i) => (
            <path
              key={s.label}
              d={arcs[i]}
              fill={s.color}
              stroke={SURFACE}
              strokeWidth={visible.length > 1 ? 2 : 0}
              strokeLinejoin="round"
              opacity={active === null || active === i ? 1 : 0.3}
              className="cursor-default transition-opacity"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${s.label}: ${s.value.toLocaleString()} (${pct(s.value)}%)`}</title>
            </path>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="font-display text-xl font-bold leading-tight text-white">
            {focused ? `${pct(focused.value)}%` : total.toLocaleString()}
          </span>
          <span className="w-full truncate text-[10px] uppercase tracking-wider text-muted">
            {focused ? focused.label : centerLabel}
          </span>
        </div>
      </div>

      {legend && (
        <ul className="min-w-[10rem] flex-1 space-y-1.5">
          {visible.map((s, i) => (
            <li
              key={s.label}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-2 text-xs transition-opacity ${active === null || active === i ? "" : "opacity-40"}`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate text-white">{s.label}</span>
              <span className="shrink-0 text-muted">
                {s.value.toLocaleString()} ({pct(s.value)}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
