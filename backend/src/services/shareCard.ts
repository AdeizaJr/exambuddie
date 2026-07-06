// src/services/shareCard.ts — renders a shareable progress card as a PNG image.
// Text-only share cards don't travel on visual platforms (IG/TikTok stories) — this
// gives users something worth reposting. SVG -> PNG via sharp (bundled libvips/librsvg,
// no external deps or headless browser needed).
//
// Flame/medal/target are drawn as vector paths rather than emoji glyphs, and the
// font is embedded straight into the SVG rather than referenced by family name.
// sharp bundles its own libvips/librsvg/fontconfig, but NOT any actual font files —
// those still have to exist on the host filesystem for fontconfig to find, and a
// stripped prod container may have none at all. When that happens every <text>
// element (not just emoji) renders as blank tofu boxes. Embedding the font as a
// base64 @font-face data URI makes this render identically regardless of what,
// if anything, is installed on the host.
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { streakBadge } from '../bot/formatter';

const FONT_FAMILY = 'EBCardSans';
let fontFaceCss: string | null = null;

function getFontFaceCss(): string {
  if (fontFaceCss) return fontFaceCss;
  const dir = path.join(process.cwd(), 'assets/fonts');
  const regular = fs.readFileSync(path.join(dir, 'DejaVuSans.ttf')).toString('base64');
  const bold = fs.readFileSync(path.join(dir, 'DejaVuSans-Bold.ttf')).toString('base64');
  fontFaceCss = `<style>
    @font-face { font-family: '${FONT_FAMILY}'; src: url(data:font/ttf;base64,${regular}) format('truetype'); }
    @font-face { font-family: '${FONT_FAMILY}'; font-weight: bold; src: url(data:font/ttf;base64,${bold}) format('truetype'); }
  </style>`;
  return fontFaceCss;
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

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  <text x="${cx}" y="740" font-family="EBCardSans" font-size="56" font-weight="700" fill="${valueColor}" text-anchor="middle">${value}</text>
  <text x="${cx}" y="782" font-family="EBCardSans" font-size="26" fill="#94a3b8" text-anchor="middle">${label}</text>`;
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
  const subjectLine = data.bestSubject ? `${esc(data.bestSubject.name)}: ${data.bestSubject.pct}% covered` : '';

  const colW = 300;
  const gap = 30;
  const totalW = colW * 3 + gap * 2;
  const startX = (W - totalW) / 2;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    ${getFontFaceCss()}
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

  <text x="60" y="110" font-family="EBCardSans" font-size="34" font-weight="600" fill="#94a3b8">${esc(data.firstName)} · ExamBuddie</text>

  ${flameIcon(400, 320, 200)}
  <text x="620" y="360" font-family="EBCardSans" font-size="170" font-weight="700" fill="#f8fafc" text-anchor="middle">${data.streak}</text>
  <text x="${W / 2}" y="440" font-family="EBCardSans" font-size="38" fill="#94a3b8" text-anchor="middle">day streak</text>

  <text x="${W / 2}" y="520" font-family="EBCardSans" font-size="46" font-weight="700" fill="#22c55e" text-anchor="middle">${esc(badge)}</text>

  ${statTile(startX, colW, data.totalAttempts.toLocaleString(), 'Questions', '#f8fafc')}
  ${statTile(startX + colW + gap, colW, `${data.accuracy}%`, 'Accuracy', accColor)}
  ${statTile(startX + (colW + gap) * 2, colW, '', '', '#f8fafc')}
  ${medalIcon(startX + (colW + gap) * 2 + colW / 2, 700, 90)}
  <text x="${startX + (colW + gap) * 2 + colW / 2}" y="782" font-family="EBCardSans" font-size="24" fill="#94a3b8" text-anchor="middle">${esc(data.rankLabel)}</text>

  <line x1="80" y1="870" x2="${W - 80}" y2="870" stroke="#1e293b" stroke-width="2"/>

  ${examLine ? `${targetIcon(390, 942, 44)}<text x="425" y="954" font-family="EBCardSans" font-size="42" fill="#f8fafc">${esc(examLine)}</text>` : ''}
  ${subjectLine ? `<text x="${W / 2}" y="1020" font-family="EBCardSans" font-size="34" fill="#94a3b8" text-anchor="middle">${subjectLine}</text>` : ''}

  <rect x="0" y="1180" width="${W}" height="170" fill="#16a34a"/>
  <text x="${W / 2}" y="1250" font-family="EBCardSans" font-size="38" font-weight="700" fill="#052e16" text-anchor="middle">Studying smarter for WAEC / JAMB / NECO</text>
  <text x="${W / 2}" y="1310" font-family="EBCardSans" font-size="34" fill="#052e16" text-anchor="middle">Join me → ${esc(data.joinHandle)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
