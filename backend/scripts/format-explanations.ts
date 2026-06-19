// scripts/format-explanations.ts
// Pre-renders raw LaTeX explanations to clean readable text and stores back
// in the explanation column. Idempotent — skips pre-formatted HTML and
// explanations that don't change after processing.
//
// Usage: npm run format-explanations [-- --dry-run] [-- --limit N]

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1], 10) : Infinity; })();
const CONCURRENCY = 50;

// ─── Formatting pipeline (mirrors src/bot/formatter.ts) ────────────────────

const UNICODE_FRACS: Record<string, string> = {
  '1/2': '½', '1/3': '⅓', '2/3': '⅔',
  '1/4': '¼', '3/4': '¾',
  '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
  '1/6': '⅙', '5/6': '⅚',
  '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞',
};
const SUP_MAP: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾',
  'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','i':'ⁱ','j':'ʲ',
  'k':'ᵏ','l':'ˡ','m':'ᵐ','n':'ⁿ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ',
  'v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ',
};
const SUB_MAP: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','i':'ᵢ','o':'ₒ','u':'ᵤ','n':'ₙ','x':'ₓ',
};
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

function toSup(s: string): string {
  const mapped = [...s].map(c => SUP_MAP[c] || c).join('');
  return mapped === s ? `^${s}` : mapped;
}
function toSub(s: string): string {
  const mapped = [...s].map(c => SUB_MAP[c] || c).join('');
  return mapped === s ? `_${s}` : mapped;
}
function fracWrap(s: string): string {
  return (/\s/.test(s) || /[+]/.test(s) || /(?<!^)-/.test(s)) ? `(${s})` : s;
}
function toFracGlyph(n: string, d: string): string | null {
  if (!/^\d$/.test(n) || !/^\d$/.test(d)) return null;
  return `${SUP[parseInt(n)]}⁄${SUB_DIGITS[parseInt(d)]}`;
}

function convertLatex(text: string): string {
  return text
    .replace(/\^\{(-?)\\frac\{([^{}]+)\}\{([^{}]+)\}\}/g, (_, sign, n, d) => `^(${sign}${n.trim()}/${d.trim()})`)
    .replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, num, den) => {
      const n = num.trim(), d = den.trim();
      const unicode = UNICODE_FRACS[`${n}/${d}`] ?? toFracGlyph(n, d);
      if (unicode) return unicode;
      return `${fracWrap(n)}/${fracWrap(d)}`;
    })
    .replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, inner) =>
      /^[0-9a-zA-Z]+$/.test(inner.trim()) ? `√${inner.trim()}` : `√(${inner.trim()})`
    )
    .replace(/\\sqrt\b/g, '√')
    .replace(/\^\{\\circ\}/g, '°').replace(/\\circ/g, '°').replace(/\\degree/g, '°')
    .replace(/([0-9]+)o\b/g, '$1°').replace(/\)o(?=\s|=|,|\.|$)/g, ')°')
    .replace(/\^\{([^}]+)\}/g, (_, e) => toSup(e))
    .replace(/\^(\w)/g, (_, e) => toSup(e))
    .replace(/_\{([^}]+)\}/g, (_, e) => toSub(e))
    .replace(/_(\w)/g, (_, e) => toSub(e))
    .replace(/\\times/g, '×').replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±').replace(/\\mp/g, '∓')
    .replace(/\\geq/g, '≥').replace(/\\leq/g, '≤')
    .replace(/\\neq/g, '≠').replace(/\\approx/g, '≈')
    .replace(/\\equiv/g, '≡').replace(/\\propto/g, '∝')
    .replace(/\\infty/g, '∞')
    .replace(/\\therefore/g, '∴').replace(/\\because/g, '∵')
    .replace(/\\cdot/g, '·').replace(/\\ldots/g, '…').replace(/\\dots/g, '…')
    .replace(/\\Rightarrow/g, '⇒').replace(/\\Leftarrow/g, '⇐')
    .replace(/\\rightarrow/g, '→').replace(/\\leftarrow/g, '←')
    .replace(/\\leftrightarrow/g, '↔').replace(/\\to/g, '→')
    .replace(/\\angle/g, '∠').replace(/\\parallel/g, '∥').replace(/\\perp/g, '⊥')
    .replace(/\\triangle/g, '△').replace(/\\sim/g, '∼').replace(/\\cong/g, '≅')
    .replace(/\\sum/g, 'Σ').replace(/\\prod/g, 'Π')
    .replace(/\\int/g, '∫').replace(/\\partial/g, '∂').replace(/\\nabla/g, '∇')
    .replace(/\\in\b/g, '∈').replace(/\\notin/g, '∉')
    .replace(/\\subset/g, '⊂').replace(/\\supset/g, '⊃')
    .replace(/\\cup/g, '∪').replace(/\\cap/g, '∩').replace(/\\emptyset/g, '∅')
    .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ').replace(/\\epsilon/g, 'ε').replace(/\\varepsilon/g, 'ε')
    .replace(/\\zeta/g, 'ζ').replace(/\\eta/g, 'η').replace(/\\theta/g, 'θ')
    .replace(/\\iota/g, 'ι').replace(/\\kappa/g, 'κ').replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ').replace(/\\nu/g, 'ν').replace(/\\xi/g, 'ξ')
    .replace(/\\pi/g, 'π').replace(/\\rho/g, 'ρ').replace(/\\sigma/g, 'σ')
    .replace(/\\tau/g, 'τ').replace(/\\upsilon/g, 'υ')
    .replace(/\\varphi/g, 'φ').replace(/\\phi/g, 'φ')
    .replace(/\\chi/g, 'χ').replace(/\\psi/g, 'ψ').replace(/\\omega/g, 'ω')
    .replace(/\\Gamma/g, 'Γ').replace(/\\Delta/g, 'Δ').replace(/\\Theta/g, 'Θ')
    .replace(/\\Lambda/g, 'Λ').replace(/\\Xi/g, 'Ξ').replace(/\\Pi/g, 'Π')
    .replace(/\\Sigma/g, 'Σ').replace(/\\Phi/g, 'Φ').replace(/\\Psi/g, 'Ψ').replace(/\\Omega/g, 'Ω')
    .replace(/\\arcsin/g, 'arcsin').replace(/\\arccos/g, 'arccos').replace(/\\arctan/g, 'arctan')
    .replace(/\\cot/g, 'cot').replace(/\\sec/g, 'sec').replace(/\\csc/g, 'csc')
    .replace(/\\log/g, 'log').replace(/\\ln/g, 'ln').replace(/\\lim/g, 'lim')
    .replace(/\\sin/g, 'sin').replace(/\\cos/g, 'cos').replace(/\\tan/g, 'tan')
    .replace(/\\begin\{array\}[\s\S]*?\\end\{array\}/g, m =>
      m.replace(/\\begin\{array\}\{[^}]*\}|\\end\{array\}|\\hline|\\multicolumn\{[^}]+\}\{[^}]+\}/g, '')
       .replace(/&/g, ' | ').replace(/\\\\/g, '\n')
    )
    .replace(/\$\$/g, '').replace(/\$/g, '')
    .replace(/\\\(|\\\)/g, '').replace(/\\\[|\\\]/g, '')
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function formatExpl(raw: string): string {
  // Skip already-formatted HTML
  if (/<(?:b|i|code)>/.test(raw)) return raw;

  const text = convertLatex(raw);

  return text
    .replace(/\b(sin|cos|tan)-1\b/g, '$1⁻¹')
    .replace(/(\d\.\d+) (\d)/g, '$1\n$2')
    .replace(/\{/g, '(').replace(/\}/g, ')')
    .replace(/\.\s+([A-Z])/g, '.\n\n$1')
    .replace(/\.\s+(divide|multiply|substitut|simplif|cross|rearrang|expand|collect|factor|compar|from\s+the|since|recall|this\s+give|let\s+)/gi, '.\n\n$1')
    .replace(/\s*:\s*([a-zA-Z])\s*=/g, '\n∴ $1 =')
    .replace(/\s+→\s+/g, '\n→ ')
    .replace(/=\s*0\s+(?=[a-zA-Zα-ωΑ-Ω(])/g, '= 0\n\n')
    .replace(/\)\s*=\s*(\d+)\s*\(/g, ')\n= $1 (')
    .replace(/\)([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ0-9]?)\s*=\s*\(/g, ')$1\n= (')
    .replace(/= ([^=\n]+) = (\d+)\s*$/gm, '= $1\n= $2')
    .replace(/\)\s+(-?\.?\d+(?:\.\d+)?)\s*=/g, ')\n\n$1 =')
    .replace(/\s+(cross[\s-]multipl\w*)/gi, '\n\n$1\n')
    .replace(/\s+([Cc]omparing|[Ff]rom the table|[Ff]rom the diagram|[Ff]rom the graph)\b/g, '\n\n$1')
    .replace(/\)\s+([∠∴A-Z0-9])/g, ')\n\n$1')
    .replace(/\)\s+([a-z])(?=\s*[+\-=×÷°^])/g, ')\n\n$1')
    .replace(/°\s+(∠|∴)/g, '°\n\n$1')
    .replace(/°\s+([a-z])(?=\s*[+\-=×÷°^])/g, '°\n\n$1')
    .replace(/([\d,.]+)\s+([a-z])(?=\s*=)/g, '$1\n\n$2')
    .replace(/((?:°|%|[\d,.]+))\s+([A-Z][a-z]{2,})/g, '$1\n\n$2')
    .replace(/([)°])\s+(sin|cos|tan|log|ln)\b/g, '$1\n\n$2')
    .replace(/°\s+(\d)/g, '°\n\n$1')
    .replace(/\s+(hence|therefore|thus|note:|substituting|now|solving|dividing|multiplying|expanding|factoring|rearranging),?\s/gi, '\n\n$1 ')
    .trim();
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const limitClause = isFinite(LIMIT) ? `LIMIT ${LIMIT}` : '';
  const { rows } = await pool.query<{ id: number; explanation: string }>(`
    SELECT id, explanation
    FROM questions
    WHERE explanation IS NOT NULL
      AND explanation NOT LIKE '<%'
      AND (
        explanation LIKE '%\\\\(%'
        OR explanation LIKE '%\\\\frac%'
        OR explanation LIKE '%\\\\sqrt%'
        OR explanation LIKE '%\\\\theta%'
        OR explanation LIKE '%\\\\log%'
        OR explanation LIKE '%\\\\sin%'
        OR explanation LIKE '%\\\\cos%'
        OR explanation LIKE '%\\\\tan%'
        OR explanation LIKE '%\\\\pi%'
        OR explanation LIKE '%\\\\times%'
        OR LENGTH(explanation) < 300
      )
    ORDER BY id
    ${limitClause}
  `);

  if (rows.length === 0) {
    console.log('Nothing to process.');
    await pool.end();
    return;
  }

  console.log(`Processing ${rows.length} explanations (concurrency=${CONCURRENCY}, dry-run=${DRY_RUN})...`);
  let done = 0, changed = 0, failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (row) => {
      try {
        const formatted = formatExpl(row.explanation);
        if (formatted !== row.explanation) {
          if (!DRY_RUN) {
            await pool.query(
              'UPDATE questions SET explanation = $1 WHERE id = $2',
              [formatted, row.id]
            );
          }
          changed++;
        }
        done++;
      } catch (err: any) {
        failed++;
        console.error(`\n  ✗ id ${row.id}: ${err.message}`);
      }
      if ((done + failed) % 200 === 0 || done + failed === rows.length) {
        const pct = Math.round(((done + failed) / rows.length) * 100);
        process.stdout.write(`\r  ${done + failed}/${rows.length} (${pct}%) — ${changed} updated, ${failed} failed`);
      }
    }));
  }

  console.log(`\n\nDone. ${changed} updated, ${failed} failed.`);
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
