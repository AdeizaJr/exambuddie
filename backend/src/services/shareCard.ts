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
import { glyphPathData } from './svgPath';
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
  // opentype.js's curve-flattening occasionally corrupts a single glyph's outline for a
  // particular glyph/size/position combination — sometimes as a literal "NaN" control
  // point that breaks the whole combined path string, sometimes as a self-intersecting
  // shape with ordinary in-range numbers that just renders as a stray line slicing
  // across the text. Requesting one Path per glyph (font.getPaths) and validating each
  // one's own bounding box against its font size, rather than one Path for the whole
  // string, catches both: a glyph whose outline balloons past a plausible size for a
  // single character gets dropped instead of rendered — a small gap rather than a
  // corrupted card going out to a user who shares it publicly.
  const glyphPaths = font.getPaths(text, startX, y, fontSize);
  const parts: string[] = [];
  for (const gp of glyphPaths) {
    const bbox = gp.getBoundingBox();
    const w = bbox.x2 - bbox.x1;
    const h = bbox.y2 - bbox.y1;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w > fontSize * 2 || h > fontSize * 2) continue;
    const d = glyphPathData(gp);
    if (d.includes('NaN') || d.includes('Infinity')) continue;
    parts.push(d);
  }
  return `<path d="${parts.join(' ')}" fill="${fill}"/>`;
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

// ── Mock exam result card ─────────────────────────────────────────────────────

export interface MockSubjectResult {
  name: string;
  correct: number;
  total: number;
}

export interface MockResultCardData {
  firstName: string;
  examType: string;
  correct: number;
  total: number;
  subjects: MockSubjectResult[];
  joinHandle: string;
}

// Per-subject accent colours, in order. Distinct hues so the dot, the score and the
// bar of one subject read as a set against the next row.
const SUBJECT_COLORS = ['#2dd4bf', '#facc15', '#f472b6', '#4ade80', '#60a5fa', '#fb923c', '#a78bfa'];

function textWidth(text: string, fontSize: number, bold = false): number {
  const { regular, bold: b } = getFonts();
  return (bold ? b : regular).getAdvanceWidth(text, fontSize);
}

// Cuts a label down with an ellipsis until it fits the given width.
function fitText(text: string, fontSize: number, maxW: number, bold = false): string {
  if (textWidth(text, fontSize, bold) <= maxW) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}…`, fontSize, bold) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export function mockGrade(pct: number): string {
  return pct >= 80 ? 'Outstanding' : pct >= 65 ? 'Excellent' : pct >= 50 ? 'Good effort' : 'Keep practising';
}

// JAMB scores each subject out of 100 and adds them up (4 subjects = /400). Each
// subject's share is its own accuracy, so a subject with fewer questions served
// still counts for a full 100 like in the real exam.
export function jambEstimate(subjects: MockSubjectResult[]): { score: number; max: number } {
  const scored = subjects.filter(s => s.total > 0);
  const score = Math.round(scored.reduce((sum, s) => sum + (s.correct / s.total) * 100, 0));
  return { score, max: scored.length * 100 };
}

export async function renderMockResultCard(data: MockResultCardData): Promise<Buffer> {
  const W = 1080;
  const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
  const accColor = accuracyColor(pct);
  const isJamb = data.examType === 'JAMB' && data.subjects.length > 1;
  const est = jambEstimate(data.subjects);
  const ringValue = isJamb ? String(est.score) : `${pct}%`;
  const ringSub = isJamb ? `/ ${est.max}` : 'score';
  const ringFrac = isJamb ? (est.max > 0 ? est.score / est.max : 0) : pct / 100;

  // Ring
  const ringCx = W / 2;
  const ringCy = 330;
  const ringR = 160;
  const circ = 2 * Math.PI * ringR;
  const arc = ringFrac > 0
    ? `<circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="none" stroke="${accColor}" stroke-width="22"
        stroke-linecap="round" stroke-dasharray="${(circ * ringFrac).toFixed(1)} ${circ.toFixed(1)}"
        transform="rotate(-90 ${ringCx} ${ringCy})"/>`
    : '';

  // Grade pill
  const grade = mockGrade(pct);
  const pillW = textWidth(grade, 32, true) + 64;
  const pillY = 680;

  // Subject rows
  const rowX = 60;
  const rowW = W - 120;
  const rowH = 160;
  const rowGap = 24;
  const rowsTop = 920;
  const rows = data.subjects.map((s, i) => {
    const y = rowsTop + i * (rowH + rowGap);
    const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
    const sPct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
    const scoreText = `${s.correct}/${s.total}`;
    const scoreW = textWidth(scoreText, 40, true);
    const name = fitText(s.name, 38, rowW - 80 - scoreW - 60, true);
    const barX = rowX + 40;
    const barW = rowW - 80;
    const fillW = Math.max(0, Math.min(barW, barW * (sPct / 100)));
    return `
  <rect x="${rowX}" y="${y}" width="${rowW}" height="${rowH}" rx="28" fill="#0f1a33" stroke="#1e2b4a" stroke-width="2"/>
  <circle cx="${rowX + 52}" cy="${y + 52}" r="11" fill="${color}"/>
  ${textPath(name, rowX + 80, y + 65, 38, '#f8fafc', { bold: true })}
  ${textPath(scoreText, rowX + rowW - 40, y + 65, 40, color, { bold: true, anchor: 'end' })}
  <rect x="${barX}" y="${y + 92}" width="${barW}" height="14" rx="7" fill="#1e2b4a"/>
  ${fillW > 0 ? `<rect x="${barX}" y="${y + 92}" width="${fillW.toFixed(1)}" height="14" rx="7" fill="${color}"/>` : ''}
  ${textPath(`${sPct}% correct`, barX, y + 142, 28, '#94a3b8')}`;
  }).join('');

  const rowsBottom = rowsTop + data.subjects.length * (rowH + rowGap) - rowGap;
  const footerY = rowsBottom + 70;
  const H = footerY + 170;

  const subLine = `${data.correct} / ${data.total} correct  ·  ${pct}%`;
  const tagline = isJamb ? 'Estimated JAMB score from this mock.' : `${data.examType} mock exam result.`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1630"/>
      <stop offset="100%" stop-color="#050a1a"/>
    </linearGradient>
    <linearGradient id="topBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2678b6"/>
      <stop offset="100%" stop-color="#60a5fa"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="10" fill="url(#topBar)"/>

  ${textPath(`${data.firstName} · ExamBuddie`, 60, 100, 32, '#94a3b8', { bold: true })}
  ${textPath(`${data.examType} Mock`, W - 60, 100, 32, '#60a5fa', { bold: true, anchor: 'end' })}

  <circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="none" stroke="#1e2b4a" stroke-width="22"/>
  ${arc}
  ${textPath(ringValue, ringCx, ringCy + 30, 104, accColor, { bold: true, anchor: 'middle' })}
  ${textPath(ringSub, ringCx, ringCy + 90, 36, '#94a3b8', { anchor: 'middle' })}

  ${textPath('Mock Exam Complete', W / 2, 590, 60, '#f8fafc', { bold: true, anchor: 'middle' })}
  ${textPath(subLine, W / 2, 645, 34, '#94a3b8', { anchor: 'middle' })}

  <rect x="${(W - pillW) / 2}" y="${pillY}" width="${pillW}" height="60" rx="30" fill="${accColor}" fill-opacity="0.14" stroke="${accColor}" stroke-opacity="0.6" stroke-width="2"/>
  ${textPath(grade, W / 2, pillY + 41, 32, accColor, { bold: true, anchor: 'middle' })}

  ${textPath(tagline, W / 2, 790, 30, '#94a3b8', { anchor: 'middle' })}

  ${textPath('Subject Breakdown', rowX, rowsTop - 30, 40, '#f8fafc', { bold: true })}
  ${rows}

  <rect x="0" y="${footerY}" width="${W}" height="170" fill="#2678b6"/>
  ${textPath('Studying smarter for WAEC / JAMB / NECO', W / 2, footerY + 72, 38, '#ffffff', { bold: true, anchor: 'middle' })}
  ${textPath(`Join me → ${data.joinHandle}`, W / 2, footerY + 128, 34, '#dbeafe', { anchor: 'middle' })}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
