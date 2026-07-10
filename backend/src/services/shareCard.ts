// src/services/shareCard.ts — renders a shareable progress card as a PNG image.
// Text-only share cards don't travel on visual platforms (IG/TikTok stories) — this
// gives users something worth reposting. SVG -> PNG via sharp (bundled libvips/librsvg,
// no external deps or headless browser needed).
//
// All text is converted to vector path outlines via opentype.js rather than left as
// <text> elements. sharp bundles its own libvips/librsvg, but text rendering inside
// librsvg goes through Pango + fontconfig, which needs a font *registered on the
// host* to shape glyphs — bundling the font as a base64 @font-face data URI still
// isn't enough, because Pango's font matching doesn't consult inline @font-face
// declarations the way a browser does. On a prod container with zero installed
// fonts, every <text> element renders as blank tofu boxes regardless. Converting
// each string to its own glyph outlines (the same category as the hand-drawn
// flame/medal/target icons below, which always rendered fine) sidesteps font
// resolution entirely — there's nothing left for Pango/fontconfig to get wrong.
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as opentype from 'opentype.js';
import { streakBadge } from '../bot/formatter';

let regularFont: opentype.Font | null = null;
let boldFont: opentype.Font | null = null;

// opentype.loadSync() silently returns undefined (deprecated) — read the file
// ourselves and parse the buffer instead.
function loadFont(file: string): opentype.Font {
  const dir = path.join(process.cwd(), 'assets/fonts');
  const buf = fs.readFileSync(path.join(dir, file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function getFonts(): { regular: opentype.Font; bold: opentype.Font } {
  if (!regularFont || !boldFont) {
    regularFont = loadFont('LiberationSans-Regular.ttf');
    boldFont = loadFont('LiberationSans-Bold.ttf');
  }
  return { regular: regularFont, bold: boldFont };
}

type Anchor = 'start' | 'middle' | 'end';

// Renders text as an SVG <path> of glyph outlines instead of a <text> element —
// no font lookup happens at rasterization time, so it can't fail on a fontless host.
function textPath(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fill: string,
  opts: { bold?: boolean; anchor?: Anchor } = {}
): string {
  const { regular, bold } = getFonts();
  const font = opts.bold ? bold : regular;
  const anchor = opts.anchor || 'start';
  const width = font.getAdvanceWidth(text, fontSize);
  const startX = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const p = font.getPath(text, startX, y, fontSize);
  return `<path d="${p.toPathData(2)}" fill="${fill}"/>`;
}

export interface ShareCardData {
  firstName: string;
  streak: number;
  totalAttempts: number;
  accuracy: number;
  rankLabel: string;
  examType: string | null;
  targetYear: number | null;
  bestSubject: { name: string; pct: number } | null;
  joinHandle: string;
}

// <50% red, 50-70% amber, >70% green — same thresholds as the landing page demo.
function accuracyColor(pct: number): string {
  if (pct < 50) return '#f87171';
  if (pct < 70) return '#fbbf24';
  return '#22c55e';
}

function flameIcon(cx: number, cy: number, size: number): string {
  const s = size / 100;
  return `
  <g transform="translate(${cx - size / 2}, ${cy - size / 2}) scale(${s})">
    <path d="M50 6 C33 24 26 40 30 58 C33 74 45 90 55 90 C74 90 88 76 88 58 C88 45 80 36 73 30 C76 42 69 48 64 46 C69 34 61 18 50 6 Z"
      fill="url(#flameGrad)"/>
    <path d="M50 40 C44 50 41 58 43 66 C45 74 51 80 56 80 C65 80 72 73 72 64 C72 58 68 53 64 50 C65 57 61 60 58 59 C61 52 57 45 50 40 Z"
      fill="url(#flameCore)"/>
  </g>`;
}

function medalIcon(cx: number, cy: number, size: number): string {
  const s = size / 100;
  return `
  <g transform="translate(${cx - size / 2}, ${cy - size / 2}) scale(${s})">
    <path d="M32 48 L14 92 L50 74 L86 92 L68 48 Z" fill="#15803d"/>
    <circle cx="50" cy="42" r="36" fill="url(#goldGrad)" stroke="#92400e" stroke-width="3"/>
    <path d="M50 20 L56.5 34 L72 34 L59.5 44 L64.5 60 L50 50.5 L35.5 60 L40.5 44 L28 34 L43.5 34 Z" fill="#fffbeb"/>
  </g>`;
}

function targetIcon(cx: number, cy: number, size: number): string {
  const r = size / 2;
  return `
  <g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ef4444"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.68}" fill="#fef2f2"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.38}" fill="#ef4444"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="#fef2f2"/>
  </g>`;
}

function statTile(x: number, w: number, value: string, label: string, valueColor: string): string {
  const cx = x + w / 2;
  return `
  <rect x="${x}" y="668" width="${w}" height="150" rx="20" fill="#0b1220" stroke="#1e293b" stroke-width="2"/>
  ${value ? textPath(value, cx, 740, 56, valueColor, { bold: true, anchor: 'middle' }) : ''}
  ${label ? textPath(label, cx, 782, 26, '#94a3b8', { anchor: 'middle' }) : ''}`;
}

// Gold/silver/bronze for the top 3, a neutral slate badge for everyone else — same rank
// gets the same treatment regardless of how many people played, so a 1st-place finish
// in a 2-player duel reads identically to a 1st-place finish in an 8-player room.
function rankBadge(cx: number, cy: number, size: number, rank: number): string {
  if (rank === 1) return medalIcon(cx, cy, size);
  const colors: Record<number, { fill: string; stroke: string; text: string }> = {
    2: { fill: 'url(#silverGrad)', stroke: '#64748b', text: '#0f172a' },
    3: { fill: 'url(#bronzeGrad)', stroke: '#92400e', text: '#fffbeb' },
  };
  const c = colors[rank] || { fill: '#1e293b', stroke: '#334155', text: '#f8fafc' };
  const r = size / 2;
  return `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="4"/>
  ${textPath(`#${rank}`, cx, cy + size * 0.14, size * 0.4, c.text, { bold: true, anchor: 'middle' })}`;
}

export interface ChallengeResultCardData {
  firstName: string;
  subject: string;
  numQuestions: number;
  rank: number;
  totalPlayers: number;
  correct: number;
  topPlayer: { firstName: string; correct: number } | null;
  joinHandle: string;
}

export async function renderChallengeResultCard(data: ChallengeResultCardData): Promise<Buffer> {
  const W = 1080;
  const H = 1350;
  const accuracy = Math.round((data.correct / data.numQuestions) * 100);
  const accColor = accuracyColor(accuracy);
  const isWinner = data.rank === 1;
  // Bragging line only makes sense when someone else set the bar — the winner's own
  // card shouldn't congratulate them on beating themselves.
  const topLine = !isWinner && data.topPlayer
    ? `Top score: ${data.topPlayer.firstName} — ${data.topPlayer.correct}/${data.numQuestions}`
    : '';

  const colW = 300;
  const gap = 30;
  const totalW = colW * 3 + gap * 2;
  const startX = (W - totalW) / 2;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111a2e"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="topBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#4ade80"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="silverGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f1f5f9"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <linearGradient id="bronzeGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fdba74"/>
      <stop offset="100%" stop-color="#9a3412"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="10" fill="url(#topBar)"/>

  ${textPath(`${data.firstName} · ExamBuddie`, 60, 110, 34, '#94a3b8', { bold: true })}

  ${rankBadge(W / 2, 340, 220, data.rank)}
  ${textPath(`${data.rank === 1 ? '1st' : data.rank === 2 ? '2nd' : data.rank === 3 ? '3rd' : data.rank + 'th'} place`, W / 2, 490, 46, '#f8fafc', { bold: true, anchor: 'middle' })}
  ${textPath(`out of ${data.totalPlayers} players`, W / 2, 540, 32, '#94a3b8', { anchor: 'middle' })}

  ${statTile(startX, colW, `${data.correct}/${data.numQuestions}`, 'Score', '#f8fafc')}
  ${statTile(startX + colW + gap, colW, `${accuracy}%`, 'Accuracy', accColor)}
  ${statTile(startX + (colW + gap) * 2, colW, '', 'Subject', '#f8fafc')}
  ${textPath(data.subject, startX + (colW + gap) * 2 + colW / 2, 740, 34, '#f8fafc', { bold: true, anchor: 'middle' })}

  <line x1="80" y1="870" x2="${W - 80}" y2="870" stroke="#1e293b" stroke-width="2"/>

  ${topLine ? textPath(topLine, W / 2, 960, 34, '#94a3b8', { anchor: 'middle' }) : ''}

  <rect x="0" y="1180" width="${W}" height="170" fill="#16a34a"/>
  ${textPath('Studying smarter for WAEC / JAMB / NECO', W / 2, 1250, 38, '#052e16', { bold: true, anchor: 'middle' })}
  ${textPath(`Join me → ${data.joinHandle}`, W / 2, 1310, 34, '#052e16', { anchor: 'middle' })}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderProgressCard(data: ShareCardData): Promise<Buffer> {
  const W = 1080;
  const H = 1350;
  // Strip streakBadge()'s leading emoji — it's outside DejaVu Sans's coverage (emoji
  // live in Unicode's supplementary planes, past what a plain text font includes), and
  // the flame icon already carries that visual weight.
  const badge = streakBadge(data.streak).replace(/^\S+\s*/, '');
  const accColor = accuracyColor(data.accuracy);
  const examLine = data.examType && data.targetYear ? `${data.examType} ${data.targetYear}` : '';
  const subjectLine = data.bestSubject ? `${data.bestSubject.name}: ${data.bestSubject.pct}% covered` : '';

  const colW = 300;
  const gap = 30;
  const totalW = colW * 3 + gap * 2;
  const startX = (W - totalW) / 2;
  const col3Cx = startX + (colW + gap) * 2 + colW / 2;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111a2e"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="topBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#4ade80"/>
    </linearGradient>
    <linearGradient id="flameGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <linearGradient id="flameCore" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="10" fill="url(#topBar)"/>

  ${textPath(`${data.firstName} · ExamBuddie`, 60, 110, 34, '#94a3b8', { bold: true })}

  ${flameIcon(400, 320, 200)}
  ${textPath(String(data.streak), 620, 360, 170, '#f8fafc', { bold: true, anchor: 'middle' })}
  ${textPath('day streak', W / 2, 440, 38, '#94a3b8', { anchor: 'middle' })}

  ${textPath(badge, W / 2, 520, 46, '#22c55e', { bold: true, anchor: 'middle' })}

  ${statTile(startX, colW, data.totalAttempts.toLocaleString(), 'Questions', '#f8fafc')}
  ${statTile(startX + colW + gap, colW, `${data.accuracy}%`, 'Accuracy', accColor)}
  ${statTile(startX + (colW + gap) * 2, colW, '', '', '#f8fafc')}
  ${medalIcon(col3Cx, 700, 90)}
  ${textPath(data.rankLabel, col3Cx, 782, 24, '#94a3b8', { anchor: 'middle' })}

  <line x1="80" y1="870" x2="${W - 80}" y2="870" stroke="#1e293b" stroke-width="2"/>

  ${examLine ? `${targetIcon(390, 942, 44)}${textPath(examLine, 425, 954, 42, '#f8fafc')}` : ''}
  ${subjectLine ? textPath(subjectLine, W / 2, 1020, 34, '#94a3b8', { anchor: 'middle' }) : ''}

  <rect x="0" y="1180" width="${W}" height="170" fill="#16a34a"/>
  ${textPath('Studying smarter for WAEC / JAMB / NECO', W / 2, 1250, 38, '#052e16', { bold: true, anchor: 'middle' })}
  ${textPath(`Join me → ${data.joinHandle}`, W / 2, 1310, 34, '#052e16', { anchor: 'middle' })}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
