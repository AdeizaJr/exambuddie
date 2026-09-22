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

// Bookmark Questions
export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

// Progress Stats, Accounts subject
export function ChartBarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

// Formula Sheets, Mathematics subject
export function RulerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m3.5 15.5 6-6M9.5 9.5l9 9M6.5 6.5l1.5 1.5M10 3l11 11-4 4L6 7l4-4Z" />
      <path d="m11.5 8.5 1.5 1.5M14 6l1.5 1.5" />
    </svg>
  );
}

// Exam Timetable, Daily Question
export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

// Multi-Subject
export function LayersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

// Study Streaks
export function FlameIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 22c4.4 0 7-2.8 7-6.6 0-3-1.8-4.9-3-6.6-.3 1.6-1.2 2.6-2 2.6-1.2 0-1-2-1-3.4 0-2-1-4-3-5-.2 2-1 3.5-2.4 5C6 9.8 5 12 5 14.5 5 19 7.6 22 12 22Z" />
    </svg>
  );
}

// Achievements & Ranks
export function MedalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="15" r="6" />
      <path d="m9 10-3-7M15 10l3-7M8.5 3h7l-2 6.5h-3L8.5 3Z" />
      <path d="M12 12.5 12.9 14.3 15 14.6 13.5 16 13.9 18 12 17 10.1 18 10.5 16 9 14.6 11.1 14.3 12 12.5Z" />
    </svg>
  );
}

// Shareable Results
export function ShareIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
    </svg>
  );
}

// Refer & Earn
export function LinkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 15 15 9" />
      <path d="M10.5 6.5 12 5a4 4 0 0 1 5.66 5.66l-1.5 1.5" />
      <path d="M13.5 17.5 12 19a4 4 0 0 1-5.66-5.66l1.5-1.5" />
    </svg>
  );
}

// Works in Telegram, Zero setup
export function BoltIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />
    </svg>
  );
}

// No download needed
export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

// Works on any device
export function DevicesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4" width="13" height="9" rx="1.5" />
      <path d="M6.5 20.5h5" />
      <path d="M9 13v3.5" />
      <rect x="16.5" y="9.5" width="6" height="10" rx="1.5" />
    </svg>
  );
}

// Progress always synced
export function SyncIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12a8 8 0 0 1 14.5-4.7M20 12a8 8 0 0 1-14.5 4.7" />
      <path d="M18 3v4.5h-4.5M6 21v-4.5h4.5" />
    </svg>
  );
}

// Biology subject
export function DnaIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3c0 6 10 12 10 18M17 3c0 6-10 12-10 18" />
      <path d="M8 8h8M6.5 13h11M8 18h8" />
    </svg>
  );
}

// Chemistry subject
export function FlaskIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 2.5h4M9.5 3v6L4.8 18a2 2 0 0 0 1.8 3h10.8a2 2 0 0 0 1.8-3L14.5 9V3" />
      <path d="M7.5 15h9" />
    </svg>
  );
}

// Physics subject
export function AtomIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" />
    </svg>
  );
}

// English Language subject
export function BookOpenIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6.5c-1.5-1.3-3.8-2-6.5-2-.8 0-1.5.7-1.5 1.5v11c0 .8.7 1.5 1.5 1.5 2.7 0 5 .7 6.5 2 1.5-1.3 3.8-2 6.5-2 .8 0 1.5-.7 1.5-1.5v-11c0-.8-.7-1.5-1.5-1.5-2.7 0-5 .7-6.5 2Z" />
      <path d="M12 6.5V20" />
    </svg>
  );
}

// Geography subject
export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

// History subject
export function ScrollIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h11a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H8" />
      <path d="M6 3.5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h2a2 2 0 0 1-2-2V3.5Z" />
      <path d="M9 8h7M9 12h7" />
    </svg>
  );
}

// Economics subject
export function CoinsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="9" cy="7" rx="6" ry="3.2" />
      <path d="M3 7v5c0 1.8 2.7 3.2 6 3.2s6-1.4 6-3.2V7" />
      <path d="M3 12v5c0 1.8 2.7 3.2 6 3.2 2.1 0 3.9-.5 5-1.3" />
      <path d="M15 10.3c3 .2 6 1.5 6 3.2s-2.7 3.2-6 3.2c-1 0-1.9-.1-2.7-.4" />
      <path d="M18 16.7V19c0 1.4-2 2.5-4.5 2.7" />
    </svg>
  );
}

// Religious studies subject (CRK / IRK)
export function BookHeartIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" />
      <path d="M5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2" />
      <path d="M12 8.8c-.5-.9-1.4-1.3-2.2-1-1 .4-1.4 1.6-.8 2.6.5.9 3 2.8 3 2.8s2.5-1.9 3-2.8c.6-1 .2-2.2-.8-2.6-.8-.3-1.7.1-2.2 1Z" />
    </svg>
  );
}

// Agricultural Science subject
export function LeafIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 4C10 4 4 10 4 18v2h2c8 0 14-6 14-16Z" />
      <path d="M7 21c2-4 6-9 13-15" />
    </svg>
  );
}

// Government subject
export function ColumnsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21h16M4 9l8-5 8 5M5.5 9v9M18.5 9v9M9.5 9v9M14.5 9v9" />
    </svg>
  );
}

