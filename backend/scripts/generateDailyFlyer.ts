// scripts/generateDailyFlyer.ts — generates a "Did You Know?" social flyer from a
// random fact in the did_you_know table (least-recently-used, same source as the
// in-app daily fact feature). Outputs a square (feed) and a story-ratio PNG.
//
// Text is rendered as glyph-outline paths via opentype.js rather than SVG <text> —
// same approach as shareCard.ts, needed because rasterization can happen on a host
// with no fonts installed and Pango/fontconfig can't shape <text> there.
//
// Usage:
//   npx ts-node scripts/generateDailyFlyer.ts

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as opentype from 'opentype.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BOT_LINK = 'https://t.me/ExamBuddieBot';
const INSTAGRAM = '@exambuddiebot';
const TIKTOK = '@exambuddiebot';
const X_HANDLE = '@exambuddiebot';

let regularFont: opentype.Font | null = null;
let boldFont: opentype.Font | null = null;

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
  // opentype.js occasionally emits a literal "NaN" control-point coordinate for a
  // particular glyph/size combination (a curve-flattening edge case, not specific to
  // any one word) — one bad token breaks librsvg's path parser for the rest of the
  // string, silently dropping everything after it. Sanitizing to 0 costs one glyph's
  // curve a pixel of shape; leaving it in costs the rest of the line.
  const d = p.toPathData(2).replace(/-?NaN/g, '0').replace(/-?Infinity/g, '0');
  return `<path d="${d}" fill="${fill}"/>`;
}

// Greedy word-wrap measured against actual glyph advance widths, not a char-count
// guess — fact_text length varies a lot and a guess either clips or wastes space.
function wrapText(text: string, fontSize: number, maxWidth: number, bold = false): string[] {
  const { regular, bold: boldFont } = getFonts();
  const font = bold ? boldFont : regular;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && font.getAdvanceWidth(test, fontSize) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function multilineTextPath(
  lines: string[],
  cx: number,
  startY: number,
  fontSize: number,
  lineHeight: number,
  fill: string
): string {
  return lines.map((line, i) => textPath(line, cx, startY + i * lineHeight, fontSize, fill, { anchor: 'middle' })).join('\n');
}

function bulbIcon(cx: number, cy: number, size: number): string {
  const s = size / 100;
  return `
  <circle cx="${cx}" cy="${cy}" r="${size * 0.85}" fill="url(#bulbGlow)"/>
  <g transform="translate(${cx - size / 2}, ${cy - size / 2}) scale(${s})">
    <circle cx="50" cy="42" r="32" fill="url(#bulbGrad)"/>
    <path d="M36 68 L36 78 Q36 84 42 84 L58 84 Q64 84 64 78 L64 68 Z" fill="#cbd5e1"/>
    <rect x="38" y="86" width="24" height="8" rx="3" fill="#94a3b8"/>
    <path d="M50 24 L50 54 M38 40 L44 46 M62 40 L56 46" stroke="#b45309" stroke-width="4" stroke-linecap="round" fill="none"/>
    <g stroke="#fbbf24" stroke-width="5" stroke-linecap="round">
      <line x1="50" y1="0" x2="50" y2="10"/>
      <line x1="16" y1="18" x2="24" y2="24"/>
      <line x1="84" y1="18" x2="76" y2="24"/>
    </g>
  </g>`;
}

// Small rounded-square monogram badge — used for social handles instead of a plain
// text wall, so the footer scans as icon+handle pairs rather than one dense line.
function monogramBadge(x: number, cy: number, size: number, mono: string, fill: string, textColor: string): string {
  const r = size * 0.28;
  return `
  <rect x="${x}" y="${cy - size / 2}" width="${size}" height="${size}" rx="${r}" fill="${fill}"/>
  ${textPath(mono, x + size / 2, cy + size * 0.15, size * 0.42, textColor, { bold: true, anchor: 'middle' })}`;
}

interface SocialHandle {
  mono: string;
  handle: string;
}

// Lays out [badge][handle]   [badge][handle]   ... centered as one row, measuring
// actual glyph widths so spacing stays even regardless of handle length.
function socialRow(handles: SocialHandle[], cx: number, cy: number, badgeSize: number, fontSize: number, fill: string, badgeFill: string, badgeText: string): string {
  const { regular } = getFonts();
  const gap = badgeSize * 0.35;
  const groupGap = badgeSize * 1.1;
  const widths = handles.map(h => badgeSize + gap + regular.getAdvanceWidth(h.handle, fontSize));
  const totalWidth = widths.reduce((a, b) => a + b, 0) + groupGap * (handles.length - 1);
  let x = cx - totalWidth / 2;
  const parts: string[] = [];
  handles.forEach((h, i) => {
    parts.push(monogramBadge(x, cy, badgeSize, h.mono, badgeFill, badgeText));
    parts.push(textPath(h.handle, x + badgeSize + gap, cy + fontSize * 0.35, fontSize, fill, { anchor: 'start' }));
    x += widths[i] + groupGap;
  });
  return parts.join('\n');
}

function buildFlyerSVG(fact: { subject: string; topic: string | null; fact_text: string }, W: number, H: number): string {
  const margin = 100;
  const maxTextWidth = W - margin * 2;

  // Story format has a lot more vertical room than square — scale the whole content
  // block up so it doesn't sit as a small clump with dead space below it.
  const scale = H > 1300 ? 1.3 : 1;
  const bulbSize = 190 * scale;

  // Pill must fit its text — long subject+topic combos (e.g. Islamic Religious
  // Knowledge · Eschatology & Unseen) would overflow a fixed-width box, so fall back
  // to subject-only and finally shrink the font until it fits maxTextWidth.
  const { bold: boldFontForTag } = getFonts();
  let tagFontSize = 24 * scale;
  let tag = fact.topic ? `${fact.subject.toUpperCase()} · ${fact.topic.toUpperCase()}` : fact.subject.toUpperCase();
  const tagPad = 60 * scale;
  if (boldFontForTag.getAdvanceWidth(tag, tagFontSize) + tagPad > maxTextWidth) {
    tag = fact.subject.toUpperCase();
  }
  while (boldFontForTag.getAdvanceWidth(tag, tagFontSize) + tagPad > maxTextWidth && tagFontSize > 16) {
    tagFontSize -= 1;
  }
  const tagWidth = boldFontForTag.getAdvanceWidth(tag, tagFontSize) + tagPad;

  const footerH = 340;
  const footerY = H - footerH;
  const availableTop = 170;
  const availableBottom = footerY - 30;

  // Fact font starts near its converged size (an 880px-wide box only fits ~5-6 words
  // per line at 44px, so a naive "44px unless long" guess forces many shrink-loop
  // iterations, or worse, bottoms out before the card actually fits — the fact card
  // then silently runs under the opaque footer rect, which paints over it since the
  // footer is drawn after the card in document order). Starting closer to the right
  // size keeps the loop below at 1-2 iterations for typical facts.
  const words = fact.fact_text.split(/\s+/).length;
  let factFontSize = (words > 40 ? 24 : words > 25 ? 28 : words > 15 ? 32 : 36) * scale;
  const { regular: regularFontForMeasure } = getFonts();
  const cardPadX = 50 * scale;
  const cardPadY = 40 * scale;

  let lineHeight = 0;
  let factLines: string[] = [];
  let cardWidth = 0;
  let cardHeight = 0;
  let headlineY0 = 0;
  let tagY0 = 0;
  let cardTop0 = 0;
  let factStartY0 = 0;
  let contentTop0 = 0;
  let contentBottom0 = 0;

  while (true) {
    lineHeight = factFontSize * 1.45;
    factLines = wrapText(fact.fact_text, factFontSize, maxTextWidth);
    const longestLineWidth = Math.max(...factLines.map(l => regularFontForMeasure.getAdvanceWidth(l, factFontSize)));
    cardWidth = Math.min(longestLineWidth + cardPadX * 2, W - margin * 2 + 40);
    cardHeight = (factLines.length - 1) * lineHeight + factFontSize * 1.15 + cardPadY * 2;

    headlineY0 = bulbSize * 0.75 + 165 * scale;
    tagY0 = headlineY0 + 60 * scale;
    cardTop0 = tagY0 + 50 * scale;
    factStartY0 = cardTop0 + cardPadY + factFontSize * 0.85;
    contentTop0 = headlineY0 - bulbSize - 25 * scale;
    contentBottom0 = cardTop0 + cardHeight;

    const fits = contentBottom0 - contentTop0 <= availableBottom - availableTop;
    if (fits || factFontSize <= 16) break;
    factFontSize -= 1;
  }

  const offsetY = availableTop + Math.max(0, (availableBottom - availableTop - (contentBottom0 - contentTop0)) / 2) - contentTop0;

  const bulbCy = headlineY0 - 165 * scale + offsetY;
  const headlineY = headlineY0 + offsetY;
  const tagY = tagY0 + offsetY;
  const cardTop = cardTop0 + offsetY;
  const factStartY = factStartY0 + offsetY;

  const botLinkLabel = BOT_LINK.replace('https://', '');
  const { bold: boldFontForMeasure } = getFonts();
  const ctaFontSize = 40;
  const ctaPadX = 50;
  const ctaWidth = boldFontForMeasure.getAdvanceWidth(botLinkLabel, ctaFontSize) + ctaPadX * 2;

  const socials: SocialHandle[] = [
    { mono: 'IG', handle: INSTAGRAM },
    { mono: 'TT', handle: TIKTOK },
    { mono: 'X', handle: X_HANDLE },
  ];

  return `
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
    <linearGradient id="bulbGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
    <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
    <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cornerGlowGreen" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="contentClip">
      <rect x="0" y="0" width="${W}" height="${footerY}"/>
    </clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W + 80}" cy="-40" r="420" fill="url(#cornerGlowGreen)"/>
  <circle cx="-100" cy="${H * 0.55}" r="360" fill="url(#cornerGlowGreen)"/>
  <rect width="${W}" height="10" fill="url(#topBar)"/>

  <rect x="60" y="54" width="52" height="52" rx="14" fill="url(#logoGrad)"/>
  ${textPath('EB', 86, 90, 26, '#052e16', { bold: true, anchor: 'middle' })}
  ${textPath('EXAMBUDDIE', 128, 90, 28, '#f8fafc', { bold: true })}

  ${bulbIcon(W / 2, bulbCy, bulbSize)}
  ${textPath('DID YOU KNOW?', W / 2, headlineY, 62 * scale, '#f8fafc', { bold: true, anchor: 'middle' })}

  <rect x="${W / 2 - tagWidth / 2}" y="${tagY - 34 * scale}" width="${tagWidth}" height="${50 * scale}" rx="${25 * scale}" fill="#0b1220" stroke="#22c55e" stroke-width="2"/>
  ${textPath(tag, W / 2, tagY, tagFontSize, '#4ade80', { bold: true, anchor: 'middle' })}

  <g clip-path="url(#contentClip)">
    <rect x="${W / 2 - cardWidth / 2}" y="${cardTop}" width="${cardWidth}" height="${cardHeight}" rx="24" fill="#0b1220" stroke="#1e293b" stroke-width="2"/>
    ${multilineTextPath(factLines, W / 2, factStartY, factFontSize, lineHeight, '#e2e8f0')}
  </g>

  <rect x="0" y="${footerY}" width="${W}" height="${footerH}" fill="#16a34a"/>
  ${textPath('Get free daily practice on Telegram', W / 2, footerY + 55, 30, '#052e16', { anchor: 'middle' })}

  <rect x="${W / 2 - ctaWidth / 2}" y="${footerY + 80}" width="${ctaWidth}" height="66" rx="33" fill="#052e16"/>
  ${textPath(botLinkLabel, W / 2, footerY + 124, ctaFontSize, '#4ade80', { bold: true, anchor: 'middle' })}

  <line x1="${W / 2 - 220}" y1="${footerY + 190}" x2="${W / 2 + 220}" y2="${footerY + 190}" stroke="#052e16" stroke-width="1" opacity="0.25"/>

  ${socialRow(socials, W / 2, footerY + 235, 36, 26, '#052e16', '#052e16', '#4ade80')}

  ${textPath('Studying smarter for WAEC / JAMB / NECO', W / 2, footerY + 300, 24, '#0d3b21', { anchor: 'middle' })}
</svg>`;
}

// One subject per day, English first — cron needs no daily edits, it just advances
// automatically. Order mixes core WAEC/JAMB subjects early, rest fill out the cycle.
const ROTATION: string[] = [
  'english', 'math', 'biology', 'chemistry', 'physics', 'government',
  'economics', 'geography', 'agric', 'commerce', 'crk', 'irk',
  'civic-education', 'computer', 'history', 'literature', 'accounts',
  'further-math', 'fine-arts', 'pe',
];
const ROTATION_ANCHOR = Date.UTC(2026, 7, 18); // 2026-08-18 = day 0 = english

function subjectForToday(): string {
  const daysSinceAnchor = Math.floor((Date.now() - ROTATION_ANCHOR) / 86400000);
  const idx = ((daysSinceAnchor % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return ROTATION[idx];
}

async function main() {
  const subjectArgIdx = process.argv.indexOf('--subject');
  const subjectCode = subjectArgIdx !== -1 ? process.argv[subjectArgIdx + 1] : subjectForToday();

  console.log(`Subject: ${subjectCode}`);

  const fact = await pool.query(
    `SELECT id, external_id, subject, subject_code, topic, fact_text, difficulty
     FROM did_you_know
     WHERE subject_code = $1
     ORDER BY last_used_at NULLS FIRST, sent_count ASC, RANDOM()
     LIMIT 1`,
    [subjectCode]
  );
  const row = fact.rows[0];
  if (!row) {
    console.error('No facts in did_you_know table.');
    await pool.end();
    process.exit(1);
  }

  console.log(`Fact: [${row.subject}${row.topic ? ' · ' + row.topic : ''}] ${row.fact_text}`);

  const outDir = path.join(process.cwd(), 'generated-flyers');
  fs.mkdirSync(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);

  const squareSVG = buildFlyerSVG(row, 1080, 1080);
  const storySVG = buildFlyerSVG(row, 1080, 1920);

  const squarePath = path.join(outDir, `${date}-square.png`);
  const storyPath = path.join(outDir, `${date}-story.png`);

  await sharp(Buffer.from(squareSVG)).png().toFile(squarePath);
  await sharp(Buffer.from(storySVG)).png().toFile(storyPath);

  await pool.query('UPDATE did_you_know SET sent_count = sent_count + 1, last_used_at = NOW() WHERE id = $1', [row.id]);

  console.log(`Square: ${squarePath}`);
  console.log(`Story:  ${storyPath}`);

  await pool.end();
}

main().catch(async e => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
