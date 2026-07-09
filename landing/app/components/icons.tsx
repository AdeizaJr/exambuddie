// A small, consistent line-icon set — replaces the emoji used across the landing page.
// Emoji render differently per OS (Android/iOS/Windows all draw different glyphs) and
// can't be color-matched to the page, which is a big part of what makes a page read as
// templated rather than designed. One stroke weight, one corner style, one visual language.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function GraduationCapIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 9.5 12 5l10 4.5-10 4.5L2 9.5Z" />
      <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
      <path d="M21 9.5v5.5" />
    </svg>
  );
}

// Problem section — memorising without understanding
export function BrainIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4.5a2.5 2.5 0 0 0-2.5 2.5v.2A3 3 0 0 0 4 10a3 3 0 0 0 1.3 5.6A3 3 0 0 0 8 19a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 9 4.5Z" />
      <path d="M15 4.5a2.5 2.5 0 0 1 2.5 2.5v.2A3 3 0 0 1 20 10a3 3 0 0 1-1.3 5.6A3 3 0 0 1 16 19a2.5 2.5 0 0 1-2.5-2.5v-9A2.5 2.5 0 0 1 15 4.5Z" />
      <path d="M10.5 8.5h3M10.5 12h3M10.5 15.5h3" />
    </svg>
  );
}

// Problem section — don't know which topics are weak
export function TargetIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Problem section — repeats the same mistakes
export function RepeatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5" />
      <path d="M20 4.5v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5" />
      <path d="M4 19.5v-4h4" />
    </svg>
  );
}

// Problem section — no feedback loop / declining trend
export function TrendDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7l6 6 4-4 6 6" />
      <path d="M20 9v6h-6" />
    </svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5.5" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5L13 3Z" />
    </svg>
  );
}
