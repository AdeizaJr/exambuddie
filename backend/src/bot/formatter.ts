// src/bot/formatter.ts — All message templates
import { Question, User } from '../types';
import { getPricing } from '../services/pricing';

const RANKS = [
  { tier: 'Rookie',    level: 'I',   min: 0    },
  { tier: 'Rookie',    level: 'II',  min: 50   },
  { tier: 'Rookie',    level: 'III', min: 120  },
  { tier: 'Rookie',    level: 'IV',  min: 200  },
  { tier: 'Rookie',    level: 'V',   min: 300  },
  { tier: 'Hustler',   level: 'I',   min: 420  },
  { tier: 'Hustler',   level: 'II',  min: 560  },
  { tier: 'Hustler',   level: 'III', min: 720  },
  { tier: 'Hustler',   level: 'IV',  min: 900  },
  { tier: 'Hustler',   level: 'V',   min: 1100 },
  { tier: 'Grinder',   level: 'I',   min: 1320 },
  { tier: 'Grinder',   level: 'II',  min: 1560 },
  { tier: 'Grinder',   level: 'III', min: 1820 },
  { tier: 'Grinder',   level: 'IV',  min: 2100 },
  { tier: 'Grinder',   level: 'V',   min: 2400 },
  { tier: 'Sharp Guy', level: 'I',   min: 2720 },
  { tier: 'Sharp Guy', level: 'II',  min: 3060 },
  { tier: 'Sharp Guy', level: 'III', min: 3420 },
  { tier: 'Sharp Guy', level: 'IV',  min: 3800 },
  { tier: 'Sharp Guy', level: 'V',   min: 4200 },
  { tier: 'Odogwu',    level: 'I',   min: 4620 },
  { tier: 'Odogwu',    level: 'II',  min: 5060 },
  { tier: 'Odogwu',    level: 'III', min: 5520 },
  { tier: 'Odogwu',    level: 'IV',  min: 6000 },
  { tier: 'Odogwu',    level: 'V',   min: 6500 },
  { tier: 'Legend',    level: 'I',   min: 7020 },
  { tier: 'Legend',    level: 'II',  min: 7560 },
  { tier: 'Legend',    level: 'III', min: 8120 },
  { tier: 'Legend',    level: 'IV',  min: 8700 },
  { tier: 'Legend',    level: 'V',   min: 9300 },
];

export function getRank(totalAnswered: number): { tier: string; level: string; label: string; next: number | null } {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (totalAnswered >= r.min) current = r;
    else break;
  }
  const idx = RANKS.indexOf(current);
  const next = RANKS[idx + 1] ?? null;
  return {
    tier: current.tier,
    level: current.level,
    label: `${current.tier} ${current.level}`,
    next: next ? next.min : null,
  };
}

// Nigeria is UTC+1 (WAT)
export function timeGreeting(): string {
  const hour = new Date(Date.now() + 60 * 60 * 1000).getUTCHours();
  if (hour >= 5 && hour < 12)  return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Hey, night owl 🦉';
}


const UNICODE_FRACS: Record<string, string> = {
  '1/2': '½',
  '1/3': '⅓', '2/3': '⅔',
  '1/4': '¼', '3/4': '¾',
  '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
  '1/6': '⅙', '5/6': '⅚',
  '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞',
};

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB = '₀₁₂₃₄₅₆₇₈₉';

// For single-digit fractions not in UNICODE_FRACS (e.g. 3/2, 4/3), build ³⁄₂ style
function toFracGlyph(n: string, d: string): string | null {
  if (!/^\d$/.test(n) || !/^\d$/.test(d)) return null;
  return `${SUP[parseInt(n)]}⁄${SUB[parseInt(d)]}`;
}

// Wrap in parens only if the string is multi-token (has space, binary +, or mid-string -)
function fracWrap(s: string): string {
  const needsParens = /\s/.test(s) || /[+]/.test(s) || /(?<!^)-/.test(s);
  return needsParens ? `(${s})` : s;
}

// Convert LaTeX math notation to readable plain text for Telegram.
function convertLatex(text: string, subject?: string): string {
  const chemLike = subject === 'chemistry' || subject === 'biology';
  let out = text
    // normalize U+2212 (proper Unicode minus, common in AI-generated math text) to ASCII
    // hyphen FIRST — every sign check below (frac exponents, bare "^-3", unit exponents,
    // SUP_MAP) only recognizes ASCII "-", so "^{−\frac{1}{3}}" fell through all of them
    // untouched instead of becoming a negative fractional exponent.
    .replace(/−/g, '-')
    // fractional exponents FIRST — must run before \frac so ^{-\frac{1}{3}} → ^(-1/3)
    .replace(/\^\{(-?)\\?frac\{([^{}]+)\}\{([^{}]+)\}\}/g, (_, sign, n, d) => `^(${sign}${n.trim()}/${d.trim()})`)
    // frac(n)(d) — scraping artifact using parentheses instead of braces
    .replace(/\\?frac\(([^)]+)\)\(([^)]+)\)/g, (_, num, den) => {
      const n = num.trim(); const d = den.trim();
      const unicode = UNICODE_FRACS[`${n}/${d}`] ?? toFracGlyph(n, d);
      if (unicode) return unicode;
      return `${fracWrap(n)}/${fracWrap(d)}`;
    })
    // general fraction with Unicode shorthand for common ones (with or without backslash)
    .replace(/\\?frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, num, den) => {
      const n = num.trim(); const d = den.trim();
      const unicode = UNICODE_FRACS[`${n}/${d}`] ?? toFracGlyph(n, d);
      if (unicode) return unicode;
      return `${fracWrap(n)}/${fracWrap(d)}`;
    })
    // sqrt — single token: √5, multi-term: √(x + 1)
    .replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, inner) =>
      /^[0-9a-zA-Z]+$/.test(inner.trim()) ? `√${inner.trim()}` : `√(${inner.trim()})`
    )
    .replace(/\\sqrt\b/g, '√')
    // degree: ^{\circ} or \circ or \degree or 60o or (90)o pattern
    .replace(/\^\{\\circ\}/g, '°').replace(/\\circ/g, '°').replace(/\\degree/g, '°')
    .replace(/([0-9]+)o\b/g, '$1°')
    .replace(/\)o(?=\s|=|,|\.|$)/g, ')°')
    // scraping artifact: positive exponent fused "1.45x1023" / "8.0 x 106"
    // Require decimal coefficient to avoid false positives ("10 x 1024" = computer storage bytes)
    .replace(/(\d+\.\d+)\s*[x×]\s*10(?!\^)\s*(\d{1,3})(?=[^0-9]|$)/g, (_, c, e) => `${c} × 10^{${e}}`)
    // scraping artifact: negative exponent "8.8 x 10-1" / "1.95 × 10-2"
    .replace(/(\d+(?:\.\d+)?)\s*[x×]\s*10-(\d{1,3})(?=[^0-9]|$)/g, (_, c, e) => `${c} × 10^{-${e}}`)
    // scraping artifact: unit negative exponents "NC-1" → "NC⁻¹", "Nm-2" → "Nm⁻²"
    .replace(/\b([A-Z]{1,2}[a-z]{0,2})-(\d{1,2})\b/g, (_, u, e) => `${u}${toSup(`-${e}`)}`)
    // negative fractional exponent, braced or parenthesized ("^{-1/3}" / "^(-1/3)" — the
    // \frac-with-sign rule above emits the paren shape): match the existing bare
    // "y^1/3 → y¹⁄₃" convention below — numerator superscript, denominator SUBSCRIPT —
    // instead of falling through to the generic brace/paren rule, which would superscript
    // the denominator too and leave a full-height "/" sitting among tiny digits (Telegram
    // has no <sup>/<sub> tags, so this subscript-denominator pairing is the closest
    // Unicode gets to a matching size). Must run before the generic brace/paren rules.
    .replace(/\^\{(-?)(\d+)\/(\d+)\}/g, (_, sign, n, d) => `${sign ? '⁻' : ''}${toSup(n)}⁄${toSub(d)}`)
    .replace(/\^\((-?)(\d+)\/(\d+)\)/g, (_, sign, n, d) => `${sign ? '⁻' : ''}${toSup(n)}⁄${toSub(d)}`)
    // superscripts
    .replace(/\^\{([^}]+)\}/g, (_, e) => toSup(e))
    // parenthesized exponents: 2^(2 + n/3) → 2⁽² ⁺ ⁿ/³⁾
    .replace(/\^\(([^)]+)\)/g, (_, e) => toSup(`(${e})`))
    // negative/decimal unbraced exponents: y^-3 → y⁻³, x^-0.5 → x⁻⁰·⁵
    .replace(/\^(-\d+(?:\.\d+)?)/g, (_, e) => toSup(e))
    // bare charge superscripts: e^- → e⁻, e^+ → e⁺ (must run after digit patterns)
    .replace(/\^\-(?!\d)/g, '⁻').replace(/\^\+(?!\d)/g, '⁺')
    // fractional exponent WITH base (actual power): y^1/3 → y¹⁄₃
    .replace(/(?<=[a-zA-Z0-9])\^(\d+)\/(\d+)/g, (_, n, d) => `${toSup(n)}⁄${toSub(d)}`)
    // fraction coefficient with ^ prefix, NO base (scraper artifact): ^2/5x → ⅖x, ^3/4 → ¾
    .replace(/(?<![a-zA-Z0-9])\^(\d+)\/(\d+)/g, (_, n, d) => UNICODE_FRACS[`${n}/${d}`] ?? `${n}/${d}`)
    .replace(/\^(\w+)/g, (_, e) => toSup(e))
    // trig squared: sin2θ → sin²θ, cos2x → cos²x (digit is the power; allow letters after)
    .replace(/\b(sin|cos|tan|sec|csc|cot)([2-9])(?![0-9])/g, (_, fn, d) => fn + toSup(d))
    // log base: log2 → log₂, log10 → log₁₀
    .replace(/\blog([0-9]+)(?![0-9])/g, (_, d) => 'log' + toSub(d));

  if (chemLike) {
    out = out
      // chemistry two-letter elements: Na2 → Na₂, SO4 → SO₄ (two-letter symbols are unambiguous)
      .replace(/\b([A-Z][a-z])([0-9]+)/g, (_, sym, n) => sym + toSub(n))
      // chemistry: single-letter element before another element in formula: H in H2O, C in CH4.
      // (?<![a-zA-Z]) not \b: a leading coefficient with no space ("2H2O") is a digit-letter
      // transition with no \b, same gap fixed on the standalone-diatomic rule below.
      .replace(/(?<![a-zA-Z])([HCNOFPSBI])([0-9]+)(?=[A-Z])/g, (_, sym, n) => sym + toSub(n))
      // chemistry: element digit at end of formula, preceded by another element: O in CO2
      .replace(/(?<=[A-Za-z])([HCNOFPSBI])([0-9]+)(?![a-zA-Z])/g, (_, sym, n) => sym + toSub(n))
      // chemistry standalone diatomic/molecules: O2 → O₂, N2 → N₂ (also covers biology's F1/F2
      // filial-generation notation, since F ∈ this element set). A coefficient sits directly
      // against the formula with no space ("2H2 + O2 → 2H2O") — digit-then-letter has no \b,
      // so this used to fall through to the physics superscript rule below and render H2 as
      // H² instead of H₂. (?<![a-zA-Z]) allows a leading digit through, same permissive style
      // already used by the algebra/physics rules just below this one.
      // Gated to chemistry/biology only — elsewhere "N" is almost always Naira ("N800"),
      // and this rule doesn't know the difference between Nitrogen and currency. Even within
      // chemistry, a Naira mention can share a question with real formulas ("cost is N20.00");
      // no chemical formula ever has a decimal subscript ("N2.5"), so a digit run immediately
      // followed by ".digit" is a safe currency signal to exclude.
      .replace(/(?<![a-zA-Z])([HCNOFPSBI])([0-9]+)(?![a-zA-Z0-9]|\.\d)/g, (_, sym, n) => sym + toSub(n));
  }

  return out
    // algebra bare power: 4x2 → 4x², x2 → x² (not preceded by letter, not followed by alphanum)
    .replace(/(?<![a-zA-Z])([a-z])([2-9])(?![a-zA-Z0-9])/g, (_, l, d) => l + toSup(d))
    // physics/math uppercase variables: D2 R → D² R (D not in chemistry list; D2K stays — letter follows).
    // N excluded — in this corpus "N" immediately followed by digits is essentially always a
    // Naira amount ("N5,000"), never a bare algebra variable, so it collided with currency.
    .replace(/(?<![a-zA-Z])([A-MO-Z])([2-9])(?![a-zA-Z0-9])/g, (_, l, d) => l + toSup(d))
    // chemistry state symbols: Zn_(s) → Zn(s), H2O_(l) → H₂O(l)
    .replace(/_\(([slgaq]+)\)/gi, '($1)')
    // subscripts
    .replace(/_\{([^}]+)\}/g, (_, e) => toSub(e))
    .replace(/_(\w+)/g, (_, e) => toSub(e))
    // operators
    .replace(/\\times/g, '×').replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±').replace(/\\mp/g, '∓')
    .replace(/\\geq/g, '≥').replace(/\\leq/g, '≤')
    .replace(/\\neq/g, '≠').replace(/\\approx/g, '≈')
    .replace(/\\equiv/g, '≡').replace(/\\propto/g, '∝')
    .replace(/\\infty/g, '∞')
    .replace(/\\therefore/g, '∴').replace(/\\because/g, '∵')
    .replace(/\\cdot/g, '·').replace(/\\ldots/g, '…').replace(/\\dots/g, '…')
    // arrows
    .replace(/\\Rightarrow/g, '⇒').replace(/\\Leftarrow/g, '⇐')
    .replace(/\\rightarrow/g, '→').replace(/\\leftarrow/g, '←')
    .replace(/\\leftrightarrow/g, '↔').replace(/\\to/g, '→')
    // implication — without this, \implies is silently stripped by the generic
    // command-stripper below, merging two separate derivation steps into one run-on line.
    // Leading newline (not just inline arrow) so the result starts its own step — otherwise
    // the equation-chain splitter further down sees one long "a = b ⇒ c = d" line and slices
    // it at the wrong "=", breaking "⇒ c" away from "= d".
    .replace(/\s*\\implies\s*/g, '\n⇒ ').replace(/\s*\\iff\s*/g, '\n⇔ ')
    // geometry
    .replace(/\\angle/g, '∠').replace(/\\parallel/g, '∥').replace(/\\perp/g, '⊥')
    .replace(/\\triangle/g, '△').replace(/\\sim/g, '∼').replace(/\\cong/g, '≅')
    // calculus / advanced
    .replace(/\\sum/g, 'Σ').replace(/\\prod/g, 'Π')
    .replace(/\\int/g, '∫').replace(/\\partial/g, '∂').replace(/\\nabla/g, '∇')
    // sets
    .replace(/\\in\b/g, '∈').replace(/\\notin/g, '∉')
    .replace(/\\subset/g, '⊂').replace(/\\supset/g, '⊃')
    .replace(/\\cup/g, '∪').replace(/\\cap/g, '∩').replace(/\\emptyset/g, '∅')
    // Greek lowercase
    .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ').replace(/\\epsilon/g, 'ε').replace(/\\varepsilon/g, 'ε')
    .replace(/\\zeta/g, 'ζ').replace(/\\eta/g, 'η').replace(/\\theta/g, 'θ')
    .replace(/\\iota/g, 'ι').replace(/\\kappa/g, 'κ').replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ').replace(/\\nu/g, 'ν').replace(/\\xi/g, 'ξ')
    .replace(/\\pi/g, 'π').replace(/\\rho/g, 'ρ').replace(/\\sigma/g, 'σ')
    .replace(/\\tau/g, 'τ').replace(/\\upsilon/g, 'υ')
    .replace(/\\varphi/g, 'φ').replace(/\\phi/g, 'φ')
    .replace(/\\chi/g, 'χ').replace(/\\psi/g, 'ψ').replace(/\\omega/g, 'ω')
    // Greek uppercase
    .replace(/\\Gamma/g, 'Γ').replace(/\\Delta/g, 'Δ').replace(/\\Theta/g, 'Θ')
    .replace(/\\Lambda/g, 'Λ').replace(/\\Xi/g, 'Ξ').replace(/\\Pi/g, 'Π')
    .replace(/\\Sigma/g, 'Σ').replace(/\\Phi/g, 'Φ').replace(/\\Psi/g, 'Ψ')
    .replace(/\\Omega/g, 'Ω')
    // trig / log
    .replace(/\\arcsin/g, 'arcsin').replace(/\\arccos/g, 'arccos').replace(/\\arctan/g, 'arctan')
    .replace(/\\cot/g, 'cot').replace(/\\sec/g, 'sec').replace(/\\csc/g, 'csc')
    .replace(/\\log/g, 'log').replace(/\\ln/g, 'ln').replace(/\\lim/g, 'lim')
    .replace(/\\sin/g, 'sin').replace(/\\cos/g, 'cos').replace(/\\tan/g, 'tan')
    // arrays/tables
    .replace(/\\begin\{array\}[\s\S]*?\\end\{array\}/g, (m) =>
      m.replace(/\\begin\{array\}\{[^}]*\}|\\end\{array\}|\\hline|\\multicolumn\{[^}]+\}\{[^}]+\}/g, '')
       .replace(/&/g, ' | ')
       .replace(/\\\\/g, '\n')
    )
    // strip remaining LaTeX delimiters
    .replace(/\$\$/g, '').replace(/\$/g, '')
    .replace(/\\\(|\\\)/g, '').replace(/\\\[|\\\]/g, '')
    // strip remaining backslash commands (unwrap content from braces)
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    // space between digit and fraction glyph: 1⅞ → 1 ⅞
    .replace(/(\d)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2')
    // numeric fractions: denominator is digits-only so trailing vars aren't consumed (2/5x → ⅖x not ⅖ₓ)
    .replace(/(?<![a-zA-Z0-9\/:.])([a-zA-Z0-9]+)\/(\d+)(?![\/:])/g, (_, n, d) => {
      const key = `${n}/${d}`;
      return UNICODE_FRACS[key] ?? `${n}⁄${d}`;
    })
    // single-letter algebraic fractions: m/n → m⁄n (single chars only — prevents sin/cos → s⁄c etc.)
    .replace(/(?<![a-zA-Z0-9\/:.])([a-zA-Z])\/([a-zA-Z])(?![a-zA-Z\/:])/g, '$1⁄$2')
    // fraction wrapped in parens by fracWrap() still leaves a bare ASCII "/" touching the
    // parens (e.g. "(-2m - 5)/4"). The rules above only re-glyph a "/" with an alphanumeric
    // right before it, so this one is missed and reaches Telegram as literal "/4" — which
    // Telegram auto-links as a bot command (renders as a blue tappable "4"). Swap it for the
    // Unicode fraction slash, which looks the same but isn't a command trigger.
    .replace(/\)\/(?=\d)/g, ')⁄')
    .replace(/(?<=\d)\/\(/g, '⁄(')
    .replace(/ {2,}/g, ' ')
    .trim();
}

const SUP_MAP: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','/':'⁄',
  'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','i':'ⁱ','j':'ʲ',
  'k':'ᵏ','l':'ˡ','m':'ᵐ','n':'ⁿ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ',
  'v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ',
};
const SUB_MAP: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','i':'ᵢ','o':'ₒ','u':'ᵤ','n':'ₙ','x':'ₓ',
};
function toSup(s: string): string {
  const mapped = [...s].map(c => SUP_MAP[c] || c).join('');
  return mapped === s ? `^${s}` : mapped;
}
function toSub(s: string): string {
  const mapped = [...s].map(c => SUB_MAP[c] || c).join('');
  return mapped === s ? `_${s}` : mapped;
}

// Plain HTML-escape for dynamic strings that must NOT go through convertLatex/markup
// (names, topic labels) — without this, a first name or topic containing "<", ">", or a
// bare "&" (e.g. "Lexis & Structure", "Acids, Bases & Salts") breaks Telegram's strict
// HTML parser and the whole message fails to send.
export function escHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// HTML-escape dynamic DB content, render LaTeX math, and convert *word* markup to <u>word</u>.
function md(text: string | null | undefined, subject?: string): string {
  if (!text) return '';
  const mathConverted = convertLatex(text, subject);
  return mathConverted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\n]+)\*/g, '<u>$1</u>')
    // Wrap IP addresses in <code> so Telegram doesn't auto-link them
    .replace(/\b(\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?)\b/g, '<code>$1</code>');
}

export const SUBJECT_MAP: Record<string, string> = {
  english:          'English Language',
  math:             'Mathematics',
  biology:          'Biology',
  chemistry:        'Chemistry',
  physics:          'Physics',
  economics:        'Economics',
  government:       'Government',
  literature:       'Literature In English',
  geography:        'Geography',
  accounts:         'Accounts',
  crk:              'Christian Religious Knowledge',
  commerce:         'Commerce',
  agric:            'Agricultural Science',
  irk:              'Islamic Religious Knowledge',
  computer:         'Computer Studies',
  history:          'History',
  'further-math':   'Further Mathematics',
  'civic-education':'Civic Education',
  yoruba:           'Yoruba',
  marketing:        'Marketing',
  'data-processing':'Data Processing',
  hausa:            'Hausa',
  'home-economics': 'Home Economics',
  catering:         'Catering Craft Practice',
  pe:               'Physical Education',
  'animal-husbandry':'Animal Husbandry',
  igbo:             'Igbo',
  french:           'French',
  'office-practice':'Office Practice',
  insurance:        'Insurance',
  'fine-arts':      'Fine Arts',
  music:            'Music',
  arabic:           'Arabic',
  'book-keeping':   'Book Keeping',
};

export const SUBJECT_EMOJI: Record<string, string> = {
  english:          '📝',
  math:             '🔢',
  biology:          '🧬',
  chemistry:        '⚗️',
  physics:          '⚡',
  economics:        '📊',
  government:       '🏛️',
  literature:       '📚',
  geography:        '🌍',
  accounts:         '💰',
  crk:              '✝️',
  commerce:         '🏪',
  agric:            '🌾',
  irk:              '☪️',
  computer:         '💻',
  history:          '📜',
  'further-math':   '📐',
  'civic-education':'🗳️',
  yoruba:           '🗣️',
  marketing:        '📈',
  'data-processing':'🖥️',
  hausa:            '🗣️',
  'home-economics': '🏠',
  catering:         '🍳',
  pe:               '⚽',
  'animal-husbandry':'🐄',
  igbo:             '🗣️',
  french:           '🇫🇷',
  'office-practice':'📋',
  insurance:        '🛡️',
  'fine-arts':      '🎨',
  music:            '🎵',
  arabic:           '🕌',
  'book-keeping':   '📒',
};

export function consentPrompt(firstName: string): string {
  return `🎓 <b>Welcome to ExamBuddie, ${escHtml(firstName)}!</b>

I'll give you 41,000+ real WAEC, JAMB &amp; NECO past questions, explain every answer, and track your progress.

Before we start, please review our <a href="https://exambuddie.app/terms">Terms of Use</a> and <a href="https://exambuddie.app/privacy">Privacy Policy</a> — they cover what data we collect (your Telegram ID, exam preferences, quiz history) and how we use it.

Tap below to agree and continue.`;
}

export function consentKeyboard() {
  return {
    inline_keyboard: [[{ text: '✅ I Agree, Continue', callback_data: 'onboard:consent:agree' }]],
  };
}

export function welcome(): string {
  return `Let's set up your profile in 3 quick steps so I can tailor questions to your exam.

📅 <b>Step 1 of 3:</b> Which exam year do you want to practice?`;
}

function buildYearKeyboard(prefix: string, backButton?: { text: string; callback_data: string }) {
  const rows: any[][] = [
    [{ text: '📅 Any Year', callback_data: `${prefix}:any` }],
  ];
  const years: number[] = [];
  for (let y = 2025; y >= 2010; y--) years.push(y);
  for (let i = 0; i < years.length; i += 4) {
    rows.push(years.slice(i, i + 4).map(y => ({
      text: `${y}`,
      callback_data: `${prefix}:${y}`,
    })));
  }
  if (backButton) rows.push([backButton]);
  return { inline_keyboard: rows };
}

export function questionTypeKeyboard(subject: string) {
  return {
    inline_keyboard: [
      [
        { text: '📝 Objective (MCQ)', callback_data: `practice:type:obj:${subject}` },
        { text: '✍️ Theory', callback_data: `practice:type:theory:${subject}` },
      ],
    ],
  };
}

export function onboardYearKeyboard() {
  return buildYearKeyboard('onboard:year');
}

export function settingsYearKeyboard() {
  return buildYearKeyboard('settings:year', { text: '← Back to Settings', callback_data: 'settings:back' });
}

export function askExamType(year: number | null): string {
  const yearLabel = year ? `📅 Year: <b>${year}</b>` : `📅 Year: <b>Any</b>`;
  return `✅ ${yearLabel}

📋 <b>Step 2 of 3:</b> Which exam are you preparing for?`;
}

export function askSubjects(examType: string): string {
  return `✅ <b>${examType} selected!</b>

📚 <b>Step 3 of 3:</b> Choose your subjects. You can pick multiple — I'll prepare questions for each one.`;
}

export function profileComplete(user: User): string {
  const subjects = user.subjects.map(s => SUBJECT_MAP[s] || s).join(', ');
  const yearLabel = user.target_year ? `<b>${user.target_year}</b>` : '<b>Any Year</b>';
  return `🎉 <b>${timeGreeting()}, ${escHtml(user.first_name)}! You're all set.</b>

📋 <b>Your Profile:</b>
• 📅 Exam Year: ${yearLabel}
• 📋 Exam: <b>${user.exam_type || 'Not set'}</b>
• 📚 Subjects: ${subjects}

What would you like to do?`;
}

export function mainMenuKeyboard(plan?: string) {
  const isPremium = plan === 'premium';
  return {
    inline_keyboard: [
      [
        { text: '📚 Practice',   callback_data: 'practice:pick' },
        { text: '📋 CBT Mode',   callback_data: 'quiz:pick' },
      ],
      [
        { text: '📊 My Stats',   callback_data: 'stats:show' },
        ...(isPremium ? [] : [{ text: '💎 Subscribe', callback_data: 'menu:subscribe' }]),
      ],
    ],
  };
}

export function persistentMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '📚 Practice' }, { text: '📋 CBT' }],
      [{ text: '🎯 Challenge' }, { text: '🏆 Leaderboard' }],
      [{ text: '📖 Review' }, { text: '🎓 Mock Exam' }],
      [{ text: '🏅 Badges' }, { text: '📊 My Stats' }],
      [{ text: '📐 Formulas' }, { text: '⚙️ Settings' }],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

// Detect scraped two-column tables (header\nvals...\n\nheader\nvals...)
// and rebuild them as aligned monospace tables wrapped in <code>.
function tryFormatColumnTable(rawText: string): string | null {
  const lines = rawText.split('\n').map(l => l.trim());
  const isNum = (s: string) => /^-?[\d.]+$/.test(s);
  const isBlank = (s: string) => s === '';
  const isShortLabel = (s: string) => s.length > 0 && !isNum(s) && s.split(' ').length <= 4;

  let i = 0;
  while (i < lines.length && isBlank(lines[i])) i++;
  if (i >= lines.length || !isShortLabel(lines[i])) return null;
  const h1 = lines[i++];

  const col1: string[] = [];
  while (i < lines.length && (isNum(lines[i]) || isBlank(lines[i]))) {
    if (isNum(lines[i])) col1.push(lines[i]);
    i++;
  }
  if (col1.length < 2) return null;

  while (i < lines.length && isBlank(lines[i])) i++;
  if (i >= lines.length || !isShortLabel(lines[i])) return null;
  const h2 = lines[i++];

  const col2: string[] = [];
  while (i < lines.length && (isNum(lines[i]) || isBlank(lines[i]))) {
    if (isNum(lines[i])) col2.push(lines[i]);
    i++;
  }
  if (col2.length !== col1.length) return null;

  const w1 = Math.max(h1.length, ...col1.map(v => v.length));
  const w2 = Math.max(h2.length, ...col2.map(v => v.length));
  const sep = '  │  ';
  const tableLines = [
    h1.padEnd(w1) + sep + h2,
    '─'.repeat(w1) + '──┼──' + '─'.repeat(w2),
    ...col1.map((v, idx) => v.padEnd(w1) + sep + col2[idx]),
  ];
  const tableHtml = tableLines.join('\n')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  while (i < lines.length && isBlank(lines[i])) i++;
  const rest = lines.slice(i).join('\n').trim();
  return `<code>${tableHtml}</code>${rest ? '\n\n' + md(rest) : ''}`;
}

export function formatQuestion(q: Question, number: number, total: number | string, mode?: string, personalized?: boolean): string {
  const modeTag = mode === 'quiz'
    ? `📋 <b>Question ${number}/${total}</b>`
    : mode === 'drill'
    ? `🎯 <b>Topic Drill: ${escHtml(q.topic) || 'Mixed'}</b>`
    : mode === 'challenge'
    ? `🎯 <b>Question ${number}/${total}</b>`
    : mode === 'sr_review'
    ? `📖 <b>Review Card ${number}/${total}</b>`
    : mode === 'quiz_review'
    ? `📖 <b>Wrong Answer ${number}/${total}</b>`
    : mode === 'qotd'
    ? `📅 <b>Question of the Day</b>${personalized ? ': Your Weak Spot' : ''}`
    : `📚 <b>Practice Mode</b>`;

  let questionText = q.question_text || '';

  if (questionText.trimStart().startsWith('From the novel;')) {
    // Inject topic/novel name when missing from question text
    if (q.topic && !questionText.toLowerCase().includes(q.topic.toLowerCase())) {
      questionText = questionText.replace(/From the novel;/, `From the novel: ${q.topic};`);
    }
    // Trim indentation and collapse excessive blank lines
    questionText = questionText
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  return `${modeTag}
<i>${q.exam_type} ${q.subject.charAt(0).toUpperCase() + q.subject.slice(1)} ${q.year}</i>

${tryFormatColumnTable(questionText) ?? md(questionText, q.subject)}`;
}

export function answerKeyboard(hasOptionE = false) {
  const rows: any[][] = [
    [
      { text: 'A', callback_data: 'answer:A' },
      { text: 'B', callback_data: 'answer:B' },
    ],
    [
      { text: 'C', callback_data: 'answer:C' },
      { text: 'D', callback_data: 'answer:D' },
    ],
  ];
  if (hasOptionE) rows.push([{ text: 'E', callback_data: 'answer:E' }]);
  return { inline_keyboard: rows };
}

export function answerOptions(q: Question): string {
  let text = `\n\n<b>A.</b> ${md(q.option_a, q.subject)}\n<b>B.</b> ${md(q.option_b, q.subject)}\n<b>C.</b> ${md(q.option_c, q.subject)}\n<b>D.</b> ${md(q.option_d, q.subject)}`;
  if (q.option_e) text += `\n<b>E.</b> ${md(q.option_e, q.subject)}`;
  return text;
}

export function formatExplanation(rawText: string, subject?: string): string {
  // Scraped/OCR'd explanations routinely use "º" (U+00BA, masculine ordinal indicator) where
  // they mean the degree sign "°" (U+00B0) — visually near-identical, but every degree-based
  // splitting rule below matches literal U+00B0, so content using the wrong codepoint sailed
  // through none of them and rendered as one unbroken wall of text.
  // Strip a stray leading quote mark — a scraping artifact on some explanations (the
  // source data occasionally wraps just the opening of the text in a curly or straight
  // quote with no matching close), not real formatting.
  const text = rawText.replace(/º/g, '°').replace(/^[“”‘’"']\s*/, '');
  // Pre-formatted HTML explanations (stored with <b>/<code> tags) bypass the regex chain.
  // Still sanitize any bare < or & that aren't part of a valid Telegram tag/entity — otherwise
  // Telegram's HTML parser rejects the whole message and the send throws.
  if (/<(?:b|i|code)>/.test(text)) {
    return text
      .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;')
      .replace(/<(?!\/?(?:b|i|u|code)\b)/g, '&lt;');
  }
  // General pre-formatting — works across all subjects. Escape raw HTML metacharacters up
  // front: math/economics explanations routinely contain literal "<"/">" as inequality
  // operators (e.g. "-1/2 < x < 3"), and sending that unescaped with parse_mode HTML makes
  // Telegram reject the entire message ("can't parse entities") — which surfaced as QOTD
  // and practice results silently falling through to the generic bot-error handler. None of
  // the regexes below key off literal <, >, or & in the source text, so escaping first is safe.
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const preFormatted = escaped
    // Bare-digit exponents with no markup at all — "πr2h", "(5)2", "cm2" meaning πr²h,
    // (5)², cm². Deliberately narrow rather than a general letter-digit-letter rule: that
    // would also match H2O/CO2-style chemistry subscripts, which look identical but mean
    // the opposite thing (atom count, not a power). π never appears in a chemical formula,
    // and a bare digit stuck right after a closing paren or a cm/m/km/mm unit is a safe,
    // unambiguous exponent signal in this domain.
    .replace(/(π\s*[a-zA-Z])([23])(?=[a-zA-Z]|\b)/g, (_, base, exp) => base + (exp === '2' ? '²' : '³'))
    .replace(/\)([23])(?=[\s).,]|$)/g, (_, exp) => ')' + (exp === '2' ? '²' : '³'))
    // (?<![a-zA-Z]) not \b on the left: the number right before the unit ("314cm2") is a
    // digit-letter transition with no \b, same gap as the chemistry rule above.
    .replace(/(?<![a-zA-Z])(cm|km|mm|m)([23])(?![a-zA-Z0-9])/g, (_, unit, exp) => unit + (exp === '2' ? '²' : '³'))
    // Back-to-back LaTeX groups "\(...\) \(...\)" with nothing but whitespace between them
    // are separate derivation steps (common in AI-generated math/physics explanations).
    // Must run before convertLatex strips the \( \) delimiters, or the step boundary is lost
    // and later heuristics mangle the run-on line (e.g. "L = 2λ 4m = 2λ ⇒ λ = 4m⁄2 =2m").
    // A literal "=" or prose between the groups means it's glue/continuation, not a new step —
    // \s* only matches whitespace so those cases correctly fall through untouched.
    .replace(/\\\)\s*\\\(/g, '\\)\n\\(')
    // A LaTeX group closing directly into a capitalized word is math handing off to prose
    // (e.g. "...\(2m\) Recall, ..."). Break it into its own paragraph so the glued math on
    // the previous line doesn't drag trailing prose into the equation-chain splitter below.
    .replace(/\\\)\s+(?=[A-Z])/g, '\\)\n\n')
    // Bold section headers: "Given:", "Find:", "Solution:", "Step N:", "Where:", "Note:"
    .replace(/\b(Given|Find|Solution|Where|Note|Step\s*\d+)\s*:/gi, '\n\n<b>$1:</b>')
    // Comma-separated variable assignments: ", WORD(optional) = value" → new line
    // e.g. "C = 0.25mol/dm3, volume = ?" → "C = 0.25mol/dm3\nvolume = ?"
    // Excludes phrases starting with an article/relative ("the frequency f =", "where v =") —
    // those are prose ("Recall, the frequency f = v/λ where...") not a list of variable
    // assignments, and splitting on the comma there rips the lead-in word off its sentence.
    .replace(/,\s*(?!(?:the|a|an|is|was|were|where)\s)([A-Za-z][A-Za-z ]{1,20}(?:\([^)]{1,10}\))?\s*=\s*[^,\n]{1,40})/g, '\n$1')
    // After a numeric value/unit, a new word phrase leading to "=" = new fact
    // Require first part to contain a digit so "number of" doesn't match
    // e.g. "0.25mol/dm3 volume =" → "0.25mol/dm3\nvolume ="
    .replace(/(\b\d[\d./]*[a-z³²]*)\s+([a-z][a-z ]{2,20}(?:\([^)]{1,10}\))?\s*=)/g, '$1\n$2')
    // "and WORD_PHRASE =" starting a new clause mid-sentence
    // e.g. "and number of mole(n) =" → new line
    .replace(/\s+and\s+([a-z][a-z ]{2,20}(?:\([^)]{1,10}\))?\s*=)/g, '\n\nand $1')
    // Closing paren/bracket followed by a new multi-word noun phrase leading to "="
    // e.g. "volume(dm³) molar concentration(C) =" → break before "molar"
    .replace(/\)\s+([a-z][a-z ]{2,25}(?:\([^)]{1,15}\))?\s*=)/g, ')\n$1')
    // "( where X = " → on its own line
    .replace(/\(\s*where\b/gi, '\n(where')
    .trim();
  const converted = convertLatex(preFormatted, subject);
  return converted
    // "= 0" then the next equation step begins (chain of steps ending in = 0) — this must
    // run BEFORE the equation-chain collapser below, and its lookahead must include digits
    // and "-". AI-generated derivations often glue distinct equations with just a space and
    // no punctuation (e.g. "...- 3 = 0 2x(x - 3) + 1(x - 3) = 0..."). Previously this rule
    // only recognized a following letter/paren, so a digit-led next step (very common —
    // "2x2 - 6x", "2x(x - 3)") never got split here, and the whole run-on blob fell through
    // to the chain-collapser as if it were one giant "a = b = c" chain, shredding it into
    // nonsense fragments instead of clean per-equation lines.
    .replace(/=\s*0\s+(?=[a-zA-Zα-ωΑ-Ω0-9(\-])/g, '= 0\n\n')
    // equation step chains: "n = a = b = c" → one step per line
    // skip if any segment between = signs contains ≥2 English words (prose, not math)
    .replace(/^.+=.+=.+$/gm, (line) => {
      const eqIdx = line.indexOf(' = ');
      if (eqIdx === -1) return line;
      const lhs = line.slice(0, eqIdx + 3);
      const rest = line.slice(eqIdx + 3);
      const parts = rest.split(' = ');
      const looksEnglish = (s: string) => (s.match(/\b[a-zA-Z]{4,}\b/g) || []).length >= 2;
      if (parts.some(looksEnglish)) return line;
      return lhs + parts.join('\n= ');
    })
    // inverse trig: cos-1 / sin-1 / tan-1 → cos⁻¹ / sin⁻¹ / tan⁻¹
    .replace(/\b(sin|cos|tan)-1\b/g, '$1⁻¹')
    // packed equations: "0.5 0.8660" → "0.5\n0.8660" (two decimals with no operator)
    .replace(/(\d\.\d+) (\d)/g, '$1\n$2')
    // curly braces used as algebraic grouping → regular parens
    .replace(/\{/g, '(').replace(/\}/g, ')')
    // sentence breaks: ". Capital"
    .replace(/\.\s+([A-Z])/g, '.\n\n$1')
    // sentence breaks after ". lowercase transition word"
    .replace(/\.\s+(divide|multiply|substitut|simplif|cross|rearrang|expand|collect|factor|compar|from\s+the|since|recall|this\s+give|let\s+)/gi, '.\n\n$1')
    // colon used as step separator: "= expr : x = value" → "\n∴ x = value"
    .replace(/\s*:\s*([a-zA-Z])\s*=/g, '\n∴ $1 =')
    // arrow results on their own line: "... → expression"
    .replace(/\s+→\s+/g, '\n→ ')
    // factorization step chain: ") = NUMBER (" → break between steps
    // [ \t]* (not \s*) so this can't reach across a paragraph break already inserted by an
    // earlier rule (e.g. the "= 0" step-break above) and re-collapse two separated steps —
    // \s* matches newlines too, which was silently undoing that earlier split.
    .replace(/\)[ \t]*=[ \t]*(\d+)[ \t]*\(/g, ')\n= $1 (')
    // equation chain: ") = (" including ASCII/superscript exponents e.g. ")2 = (" or ")² = ("
    .replace(/\)([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ0-9]?)[ \t]*=[ \t]*\(/g, ')$1\n= (')
    // arithmetic chain at end of line: "= EXPR = SINGLE_NUMBER"
    .replace(/= ([^=\n]+) = (\d+)\s*$/gm, '= $1\n= $2')
    // substitution step: ") -4 =" or ") 3 =" — numeric value starting new equation after closing paren
    .replace(/\)\s+(-?\.?\d+(?:\.\d+)?)\s*=/g, ')\n\n$1 =')
    // cross-multiplying/cross multiply on its own line with result below
    .replace(/\s+(cross[\s-]multipl\w*)/gi, '\n\n$1\n')
    // "comparing/from the/since" following a math result mid-sentence
    .replace(/\s+([Cc]omparing|[Ff]rom the table|[Ff]rom the diagram|[Ff]rom the graph)\b/g, '\n\n$1')
    // end of parenthetical reason ) followed by new math step
    .replace(/\)\s+([∠∴A-Z0-9])/g, ')\n\n$1')
    // ) followed by lowercase variable + math operator
    .replace(/\)\s+([a-z])(?=\s*[+\-=×÷°^])/g, ')\n\n$1')
    // degree/unit result followed immediately by another angle/equation step
    .replace(/°\s+(∠|∴)/g, '°\n\n$1')
    // degree followed by variable starting a new equation
    .replace(/°\s+([a-z])(?=\s*[+\-=×÷°^])/g, '°\n\n$1')
    // plain number followed by variable+equals (e.g. "75 y = 105°")
    .replace(/([\d,.]+)\s+([a-z])(?=\s*=)/g, '$1\n\n$2')
    // numeric/unit result followed by a capital word starting a new clause
    .replace(/((?:°|%|[\d,.]+))\s+([A-Z][a-z]{2,})/g, '$1\n\n$2')
    // ) or ° followed by trig/log function starting a new step
    .replace(/([)°])\s+(sin|cos|tan|log|ln)\b/g, '$1\n\n$2')
    // ° followed by a digit starting a new equation
    .replace(/°\s+(\d)/g, '°\n\n$1')
    // common math-step transition words (case-insensitive, optional trailing comma)
    .replace(/\s+(hence|therefore|thus|note:|substituting|now|solving|dividing|multiplying|expanding|factoring|rearranging),?\s/gi, '\n\n$1 ')
    // Escape bare < that are not valid Telegram HTML tags (e.g. angle notation <POQ, <ABC)
    .replace(/<(?!\/?(?:b|i|u|code)\b)/g, '&lt;')
    .trim();
}

export function correctAnswer(q: Question, selected: string): string {
  const wasCorrect = selected === q.correct_option;
  const emoji = wasCorrect ? '✅' : '❌';
  const header = wasCorrect
    ? `${emoji} <b>Correct! Well done.</b>`
    : `${emoji} <b>Wrong. The correct answer is ${q.correct_option}.</b>`;

  const optionText: Record<string, string | null> = {
    A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e,
  };

  const correctText = md(optionText[q.correct_option] ?? '', q.subject);
  const explanation = q.explanation ? formatExplanation(q.explanation, q.subject) : '<i>Explanation not yet available.</i>';

  return `${header}

✔️ <b>Answer ${q.correct_option}:</b> ${correctText}

━━━━━━━━━━━━━━
💡 <b>Explanation</b>
━━━━━━━━━━━━━━

${explanation}`;
}

export const FLAG_REASONS: Record<string, string> = {
  wrong_answer: '❌ Wrong answer marked correct',
  wrong_explanation: '💡 Explanation is wrong/unclear',
  confusing_question: '❓ Question text is confusing',
  bad_image: '🖼 Image/diagram missing or wrong',
  other: '🤷 Other',
};

export function flagReasonKeyboard() {
  return {
    inline_keyboard: [
      ...Object.entries(FLAG_REASONS).map(([code, label]) => [
        { text: label, callback_data: `flag:reason:${code}` },
      ]),
      [{ text: '« Cancel', callback_data: 'flag:cancel' }],
    ],
  };
}

export function afterAnswerKeyboard(mode?: string, hasUnderline = false, questionId?: number, hasExplanation = false) {
  if (mode === 'quiz') {
    const rows: any[] = [
      [
        { text: '➡️  Next Question', callback_data: 'quiz:next' },
        { text: '🚩 Flag', callback_data: 'flag:question' },
      ],
      [{ text: '⏹ End CBT', callback_data: 'quiz:stop' }],
    ];
    if (hasUnderline) rows.splice(1, 0, [{ text: '🔤 Wrong Underline?', callback_data: 'flag:underline' }]);
    if (questionId) rows.push([{ text: '⭐ Save Question', callback_data: `bookmark:toggle:${questionId}` }]);
    if (hasExplanation && questionId) rows.push([
      { text: '👍 Good explanation', callback_data: `feedback:good:${questionId}` },
      { text: '👎 Poor explanation', callback_data: `feedback:bad:${questionId}` },
    ]);
    return { inline_keyboard: rows };
  }
  const rows: any[] = [
    [
      { text: '➡️  Next Question', callback_data: 'practice:next' },
      { text: '🚩 Flag', callback_data: 'flag:question' },
    ],
    [
      { text: '📚 Change Subject', callback_data: 'practice:change_subject' },
      { text: '⏹  Stop', callback_data: 'practice:stop' },
    ],
  ];
  if (hasUnderline) rows.splice(1, 0, [{ text: '🔤 Wrong Underline?', callback_data: 'flag:underline' }]);
  if (questionId) rows.push([{ text: '⭐ Save Question', callback_data: `bookmark:toggle:${questionId}` }]);
  if (hasExplanation && questionId) rows.push([
    { text: '👍 Good explanation', callback_data: `feedback:good:${questionId}` },
    { text: '👎 Poor explanation', callback_data: `feedback:bad:${questionId}` },
  ]);
  return { inline_keyboard: rows };
}

export function sessionSummary({
  correct,
  total,
  subject,
  subjects,
  mode,
  durationSecs,
}: {
  correct: number;
  total: number;
  subject?: string;
  subjects?: string[];
  mode: string;
  durationSecs?: number;
}): string {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const grade = accuracy >= 70 ? '🌟 Excellent!' : accuracy >= 50 ? '👍 Good effort!' : '💪 Keep practising!';
  const minutes = durationSecs ? Math.round(durationSecs / 60) : null;

  const subjectList = subjects && subjects.length > 0 ? subjects : (subject ? [subject] : []);
  const subjectLabel = subjectList.length > 1
    ? subjectList.map(s => SUBJECT_MAP[s] || s).join(', ')
    : SUBJECT_MAP[subjectList[0] || ''] || subjectList[0] || '';

  return `📊 <b>Session Summary</b>

${grade}

📌 Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}
📚 Subject${subjectList.length > 1 ? 's' : ''}: ${subjectLabel}
✅ Correct: ${correct}/${total}
🎯 Accuracy: ${accuracy}%${minutes ? `\n⏱️ Time: ${minutes} min` : ''}

${accuracy < 50 ? '💡 <i>Tip: Try /drill to focus on specific weak topics.</i>' : ''}
${accuracy >= 70 ? '🔥 Keep it up! Consistency is key.' : ''}

What next?`;
}

export function sessionKeyboard(subject: string, year?: number | null) {
  const yearSuffix = year ? `:${year}` : ':any';
  return {
    inline_keyboard: [
      [
        { text: '🔄 Practice Again', callback_data: `practice:start:${subject}${yearSuffix}` },
        { text: '🎯 Drill Weak Topics', callback_data: `drill:auto:${subject}` },
      ],
      [
        { text: '📅 Change Year', callback_data: `practice:year:${subject}` },
        { text: '📚 Change Subject', callback_data: 'practice:change_subject' },
      ],
      [
        { text: '📊 My Stats', callback_data: 'stats:show' },
        { text: '🏠 Main Menu', callback_data: 'menu:main' },
      ],
    ],
  };
}

export function examTypePickerKeyboard(mode: 'practice' | 'quiz') {
  return {
    inline_keyboard: [
      [
        { text: 'WAEC', callback_data: `${mode}:examtype:WAEC` },
        { text: 'NECO', callback_data: `${mode}:examtype:NECO` },
      ],
      [
        { text: 'JAMB', callback_data: `${mode}:examtype:JAMB` },
        { text: 'All Exams', callback_data: `${mode}:examtype:ALL` },
      ],
    ],
  };
}

export function timerPickerKeyboard(mode: 'practice' | 'quiz') {
  return {
    inline_keyboard: [
      [
        { text: '⏱️ 30 seconds', callback_data: `${mode}:timer:30` },
        { text: '⏱️ 45 seconds', callback_data: `${mode}:timer:45` },
      ],
      [
        { text: '⏱️ 50 seconds (WAEC pace)', callback_data: `${mode}:timer:50` },
        { text: '▶️ No Timer',               callback_data: `${mode}:timer:0`  },
      ],
    ],
  };
}

export function statsFilterKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'WAEC', callback_data: 'stats:filter:WAEC' },
        { text: 'NECO', callback_data: 'stats:filter:NECO' },
        { text: 'JAMB', callback_data: 'stats:filter:JAMB' },
      ],
      [{ text: 'All Exams', callback_data: 'stats:filter:all' }],
      [{ text: '📜 CBT History', callback_data: 'quiz:history' }],
    ],
  };
}

export function statsMessage(user: User, stats: any, weakTopics?: any[], examType?: string, subjectStats?: any[], mistakePattern?: string | null): string {
  const plan = user.plan === 'premium'
    ? `⭐ Premium (expires ${user.plan_expires_at ? new Date(user.plan_expires_at).toLocaleDateString('en-NG') : 'N/A'})`
    : '🆓 Free (5 questions/day)';

  const weakSection = weakTopics && weakTopics.length > 0
    ? '\n⚠️ <b>Weak Topics (focus here!):</b>\n' +
      weakTopics.map(t => `  • ${escHtml(t.topic)}: ${t.accuracy}% accuracy (${t.attempts} attempts)`).join('\n')
    : '';

  const worstTopic = weakTopics && weakTopics.length > 0 ? weakTopics[0] : null;
  const drillTip = worstTopic
    ? `\n\n💡 <b>Score Tip:</b> Drilling <i>${escHtml(worstTopic.topic)}</i> (${worstTopic.accuracy}%) could meaningfully boost your score. Use /drill to target it now.`
    : '';

  const mistakeTip = mistakePattern ? `\n\n🔍 <b>Mistake Pattern:</b> ${mistakePattern}` : '';

  const examLabel = examType && examType !== 'all' ? examType : 'Overall';

  let subjectSection = '';
  if (subjectStats && subjectStats.length > 0) {
    const strong = subjectStats.filter(s => Number(s.accuracy) >= 60);
    const weak = subjectStats.filter(s => Number(s.accuracy) < 60);

    if (strong.length > 0) {
      subjectSection += '\n✅ <b>Strong Subjects:</b>\n' +
        strong.map(s => `  • ${s.subject}: ${s.accuracy}% (${s.attempts} attempts)`).join('\n');
    }
    if (weak.length > 0) {
      subjectSection += '\n❌ <b>Needs Work:</b>\n' +
        weak.map(s => `  • ${s.subject}: ${s.accuracy}% (${s.attempts} attempts)`).join('\n');
    }
  }

  const countdown = examCountdown(user.exam_type || null, user.target_year || null);
  const dailyTarget = 10;
  const dailyProgress = `📅 Today: ${user.daily_count || 0}/${dailyTarget} questions · 🔥 ${user.streak || 0} day streak`;
  const totalAnswered = Number(stats.total_attempts || 0);
  const rank = getRank(totalAnswered);
  const rankLine = rank.next
    ? `🏅 Rank: <b>${rank.label}</b> · ${rank.next - totalAnswered} questions to next rank`
    : `🏅 Rank: <b>${rank.label}</b> · 👑 Max rank reached!`;
  return `📈 <b>Your ${examLabel} Stats</b>

👤 ${escHtml(user.first_name)}
📋 Exam: ${user.exam_type || 'Not set'}
🗓️ Joined: ${new Date(user.joined_at).toLocaleDateString('en-NG')}${countdown ? `\n${countdown}` : ''}

📊 <b>${examLabel} Performance:</b>
• Total Attempts: ${stats.total_attempts || 0}
• Correct Answers: ${stats.correct || 0}
• Accuracy: ${stats.accuracy || 0}%
• 🔥 Streak: ${user.streak || 0} days
• ${rankLine}
• ${dailyProgress}

💳 <b>Plan:</b> ${plan}
${subjectSection}${weakSection}${drillTip}${mistakeTip}`;
}

export function freeLimitMessage(remaining: number, limit: number): string | null {
  if (remaining === 0) {
    const p = getPricing();
    return `⏰ <b>Daily limit reached!</b>

You've used all ${limit} free questions for today. Come back tomorrow, or upgrade to Premium for <b>unlimited access</b>.

💎 <b>ExamBuddie Premium:</b>
• Unlimited questions, every day
• Quiz mode &amp; Topic drills
• Progress tracking &amp; weak-topic detection
• From ₦${p.monthly_ngn.toLocaleString()}/month · ₦${p.term_ngn.toLocaleString()} for 3 months · ₦${p.yearly_ngn.toLocaleString()}/year

👇 Tap to upgrade:`;
  }
  return null; // no message needed
}

export function upgradeMessage(): string {
  const p = getPricing();
  const termSavings = p.monthly_ngn * 3 - p.term_ngn;
  const yearlySavings = p.monthly_ngn * 12 - p.yearly_ngn;
  return `💎 <b>Upgrade to ExamBuddie Premium</b>

Unlock everything you need to ace your exams:

✅ Unlimited questions (no daily cap)
✅ CBT mode — timed mock exam (50 questions, 60 mins)
✅ Topic drill (target weak areas)
✅ Progress tracking &amp; stats
✅ Weak topic detection
✅ Priority support

💰 <b>Pricing:</b>
• Monthly: ₦${p.monthly_ngn.toLocaleString()}/month
• Term (3 months): ₦${p.term_ngn.toLocaleString()} <b>(save ₦${termSavings.toLocaleString()})</b>
• Yearly: ₦${p.yearly_ngn.toLocaleString()} <b>(save ₦${yearlySavings.toLocaleString()})</b>

<i>If your card supports it, Premium auto-renews each cycle so you're never interrupted — cancel anytime with /billing.</i>

Choose your plan:`;
}

export function subscribeKeyboard() {
  const p = getPricing();
  return {
    inline_keyboard: [
      [{ text: `📅 Monthly — ₦${p.monthly_ngn.toLocaleString()}`, callback_data: 'subscribe:monthly' }],
      [{ text: `📆 Term (3 months) — ₦${p.term_ngn.toLocaleString()}`, callback_data: 'subscribe:term' }],
      [{ text: `🗓️ Yearly — ₦${p.yearly_ngn.toLocaleString()} (Best Value)`, callback_data: 'subscribe:yearly' }],
      [{ text: '❌ Maybe Later', callback_data: 'menu:main' }],
    ],
  };
}

export function paymentLinkMessage(link: string, planLabel: string, txRef: string): string {
  return `🔗 <b>Your Secure Payment Link</b>

Plan: ${planLabel}

👉 <a href="${link}">Click here to pay securely</a>

<i>Payment powered by Paystack. Your access will be activated instantly after payment.</i>

Reference: <code>${txRef}</code>

<i>If your card supports it, this will auto-renew each cycle — manage or cancel anytime with /billing. By paying, you agree to our <a href="https://exambuddie.app/refunds">Refund Policy</a>. Subscriptions are non-refundable once activated except in cases of prolonged service outage.</i>`;
}

const PLAN_NAME: Record<string, string> = {
  monthly: 'Monthly',
  term: 'Term (3mo)',
  yearly: 'Yearly',
};

const BILLING_STATUS_ICON: Record<string, string> = {
  active: '✅',
  failed: '❌',
  expired: '⌛',
};

export function billingHistoryMessage(
  history: { plan: string; amount_ngn: number; status: string; started_at: string | null; is_recurring: boolean; cancelled_at: string | null }[]
): string {
  if (history.length === 0) {
    return '💳 <b>Billing History</b>\n\nNo billing history yet — use /subscribe to go Premium.';
  }

  const lines = history.map((h) => {
    const date = h.started_at
      ? new Date(h.started_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const planName = PLAN_NAME[h.plan] || h.plan;
    const icon = BILLING_STATUS_ICON[h.status] || 'ℹ️';
    const tag = h.cancelled_at ? ' (cancelled)' : h.is_recurring ? ' (auto-renew)' : '';
    return `${icon} ${date} — ${planName} — ₦${Number(h.amount_ngn).toLocaleString()}${tag}`;
  });

  return `💳 <b>Billing History</b>\n\n${lines.join('\n')}`;
}

const CONSECUTIVE_HYPE: Record<number, string> = {
  3:  '🔥 3 in a row! You\'re on a roll — keep it up!',
  5:  '🔥🔥 5 correct in a row! You\'re on fire!',
  10: '🏆 10 in a row! Absolute genius energy — don\'t stop now!',
};

const TOTAL_MILESTONE: Record<number, string> = {
  10:   '🚀 10 questions answered! The journey has begun.',
  25:   '💪 25 questions done! You\'re building real momentum.',
  50:   '🎯 50 questions! Halfway to your first century.',
  100:  '🏆 100 questions answered! You\'re dead serious about this.',
  250:  '💎 250 questions! You\'re in the top tier now.',
  500:  '🎓 500 questions! Exam-ready energy.',
  1000: '🌟 1,000 questions! You\'ve reached legend status.',
};

export function consecutiveHype(count: number): string | null {
  return CONSECUTIVE_HYPE[count] ?? null;
}

export function totalMilestone(total: number): string | null {
  return TOTAL_MILESTONE[total] ?? null;
}

export function helpMessage(): string {
  return `📖 <b>ExamBuddie Help</b>

<b>📚 Practice Mode</b>
/practice — Answer questions one at a time, pick subject and year
<i>Best for daily revision and building topic confidence</i>

<b>📋 CBT Mode</b>
/quiz — 50-question timed CBT exam (60 mins), scored at the end
/mock — Full timed mock exam across your subjects (Premium)
<i>Best for simulating real exam conditions</i>

<b>🎯 Drill Mode</b>
/drill — Focus on a specific weak topic
/review — Spaced-repetition review deck (Premium)
<i>Best for fixing gaps after you see your stats</i>

<b>📊 Account</b>
/stats — Your accuracy, streak, and subject breakdown
/progress — Full progress report, sharable as an image
/timetable — Countdown to your exam dates
/settings — Change exam type, subjects, or target year
/subscribe — Unlock unlimited questions with Premium
/billing — Manage or cancel auto-renewing Premium

<b>🏆 Social</b>
/leaderboard — See how you rank against other users
/challenge — Race friends in a live quiz room
/invite — Get 3 days Premium free for 2 confirmed referrals
/badges — Your achievements

<b>🛠 Extras</b>
/revision — Quick-fire revision of past questions
/bookmarks — Questions you've saved for later
/formula — Look up a subject's key formulas
/app — Open the ExamBuddie web app

<b>⏹ Other</b>
/stop — End your current session
/support — Report a bug, delete your account, or request your data
/help — Show this message

<b>During a session:</b>
• Tap <b>A / B / C / D</b> to answer
• Tap <b>➡️ Next</b> after seeing the explanation
• Tap <b>🚩 Flag</b> if an explanation looks wrong

Need help? Use /support`;
}

export function examTypeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📘 WAEC', callback_data: 'onboard:exam:WAEC' }],
      [{ text: '📗 JAMB (UTME)', callback_data: 'onboard:exam:JAMB' }],
      [{ text: '📙 NECO', callback_data: 'onboard:exam:NECO' }],
      [{ text: '📚 All (WAEC, NECO & JAMB)', callback_data: 'onboard:exam:ALL' }],
    ],
  };
}

export const MAX_SUBJECTS = 5;    // including English
export const SUBJECT_Q_LIMIT = 5; // questions per subject per 6-hour window
export const SUBJECT_WINDOW_HRS = 6;

export function subjectKeyboard(selectedSubjects: string[] = [], allowedSubjects?: string[]) {
  const subjects = Object.entries(SUBJECT_MAP)
    .filter(([code]) => !allowedSubjects || allowedSubjects.includes(code))
    .map(([code, name]) => ({ code, label: `${SUBJECT_EMOJI[code] || '📖'} ${name}`, name }))
    .sort((a, b) => {
      if (a.code === 'english') return -1;
      if (b.code === 'english') return 1;
      return a.name.localeCompare(b.name);
    });

  const buttons = subjects.map(s => {
    const isEnglish = s.code === 'english';
    const isSelected = selectedSubjects.includes(s.code);
    return {
      // English shown as locked — tick + lock so user knows it can't be removed
      text: isEnglish
        ? `✅🔒 ${s.label}`
        : isSelected ? `✅ ${s.label}` : s.label,
      callback_data: `onboard:subject:${s.code}`,
    };
  });

  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  // Show done button as soon as english is selected (always)
  rows.push([{
    text: `✅ Done (${selectedSubjects.length} selected, ${MAX_SUBJECTS - selectedSubjects.length} slots left)`,
    callback_data: 'onboard:subjects:done',
  }]);
  return { inline_keyboard: rows };
}

export function subjectLimitMessage(subjectName: string, msLeft: number): string {
  const hrs = Math.floor(msLeft / 3600000);
  const mins = Math.ceil((msLeft % 3600000) / 60000);
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} min`;
  return `⏰ <b>Subject limit reached!</b>

You've used all ${SUBJECT_Q_LIMIT} free questions for <b>${subjectName}</b> in this ${SUBJECT_WINDOW_HRS}-hour window.

Resets in <b>${timeStr}</b>.

Switch to another subject or upgrade to Premium for unlimited access 👇`;
}

export function subjectLimitKeyboard(plan?: string) {
  const isPremium = plan === 'premium';
  return {
    inline_keyboard: [
      [{ text: '📚 Switch Subject', callback_data: 'practice:change_subject' }],
      ...(isPremium ? [] : [[{ text: '💎 Upgrade to Premium', callback_data: 'menu:subscribe' }]]),
    ],
  };
}

export function practiceSubjectKeyboard(subjects: string[], counts: Record<string, number> = {}) {
  const sorted = [...subjects].sort((a, b) => {
    if (a === 'english') return -1;
    if (b === 'english') return 1;
    return (SUBJECT_MAP[a] || a).localeCompare(SUBJECT_MAP[b] || b);
  });
  const buttons = sorted.map(s => {
    const label = SUBJECT_MAP[s] || s.charAt(0).toUpperCase() + s.slice(1);
    const count = counts[s];
    const countStr = count !== undefined ? ` (${count.toLocaleString()})` : '';
    return { text: `${SUBJECT_EMOJI[s] || '📖'} ${label}${countStr}`, callback_data: `practice:subject:${s}` };
  });
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([
    { text: '➕ Add / Remove Subjects', callback_data: 'practice:add_subject' },
    { text: '🔄 Change Exam Type', callback_data: 'practice:change_exam' },
  ]);
  return { inline_keyboard: rows };
}

export function practiceMultiSubjectKeyboard(allSubjects: string[], selected: string[]) {
  const sorted = [...allSubjects].sort((a, b) => {
    if (a === 'english') return -1;
    if (b === 'english') return 1;
    return (SUBJECT_MAP[a] || a).localeCompare(SUBJECT_MAP[b] || b);
  });
  const buttons = sorted.map(s => {
    const isSelected = selected.includes(s);
    return {
      text: `${isSelected ? '✅ ' : ''}${SUBJECT_EMOJI[s] || '📖'} ${SUBJECT_MAP[s] || s}`,
      callback_data: `practice:multisubject:toggle:${s}`,
    };
  });
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([{
    text: selected.length > 0
      ? `▶️ Start Practice (${selected.length} subject${selected.length > 1 ? 's' : ''})`
      : '⚠️ Select at least one subject',
    callback_data: 'practice:multisubject:start',
  }]);
  return { inline_keyboard: rows };
}


export function flowYearKeyboard(mode: 'practice' | 'quiz') {
  const rows: any[][] = [
    [{ text: '📅 Any Year', callback_data: `${mode}:flow_year:any` }],
  ];
  const years: number[] = [];
  for (let y = 2025; y >= 2010; y--) years.push(y);
  for (let i = 0; i < years.length; i += 4) {
    rows.push(years.slice(i, i + 4).map(y => ({
      text: `${y}`,
      callback_data: `${mode}:flow_year:${y}`,
    })));
  }
  return { inline_keyboard: rows };
}

export function quizSubjectKeyboard(subjects: string[], counts: Record<string, number> = {}) {
  const sorted = [...subjects].sort((a, b) => {
    if (a === 'english') return -1;
    if (b === 'english') return 1;
    return (SUBJECT_MAP[a] || a).localeCompare(SUBJECT_MAP[b] || b);
  });
  const buttons = sorted.map(s => {
    const label = SUBJECT_MAP[s] || s.charAt(0).toUpperCase() + s.slice(1);
    const count = counts[s];
    const countStr = count !== undefined ? ` (${count.toLocaleString()})` : '';
    return { text: `${SUBJECT_EMOJI[s] || '📖'} ${label}${countStr}`, callback_data: `quiz:subject:${s}` };
  });
  const rows: any[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([
    { text: '➕ Add / Remove Subjects', callback_data: 'practice:add_subject' },
    { text: '🔄 Change Exam Type', callback_data: 'practice:change_exam' },
  ]);
  return { inline_keyboard: rows };
}

export function topicKeyboard(topics: string[]) {
  const rows: any[][] = [
    [{ text: '📚 All Topics', callback_data: 'practice:topic:__all__' }],
  ];
  for (let i = 0; i < topics.length; i += 2) {
    rows.push(topics.slice(i, i + 2).map(t => ({
      text: t,
      callback_data: `practice:topic:${t}`,
    })));
  }
  return { inline_keyboard: rows };
}

export function subjectAvailabilityKeyboard(
  subject: string,
  availability: { examType: string; years: number[] }[],
  mode: 'quiz' | 'practice'
) {
  const rows: any[][] = [];
  for (const { examType, years } of availability) {
    for (const year of years) {
      rows.push([{ text: `${examType} — ${year}`, callback_data: `${mode}:avail:${subject}:${examType}:${year}` }]);
    }
  }
  rows.push([
    { text: '📚 Pick Another Subject', callback_data: `${mode}:pick` },
    { text: '🏠 Main Menu', callback_data: 'menu:main' },
  ]);
  return { inline_keyboard: rows };
}

export function yearPickerKeyboard(subject: string) {
  const rows: any[][] = [
    [{ text: '📅 Any Year', callback_data: `practice:start:${subject}:any` }],
  ];
  const years: number[] = [];
  for (let y = 2025; y >= 2010; y--) years.push(y);
  for (let i = 0; i < years.length; i += 4) {
    rows.push(years.slice(i, i + 4).map(y => ({
      text: `${y}`,
      callback_data: `practice:start:${subject}:${y}`,
    })));
  }
  rows.push([{ text: '← Back to Subjects', callback_data: 'practice:pick' }]);
  return { inline_keyboard: rows };
}

export function examCountdown(examType: string | null, targetYear: number | null): string | null {
  if (!targetYear) return null;
  const now = new Date();
  if (targetYear < now.getFullYear()) return null;
  let month: number, day: number;
  if (examType === 'JAMB') { month = 3; day = 15; }
  else if (examType === 'NECO') { month = 7; day = 1; }
  else { month = 5; day = 15; } // WAEC default
  const examDate = new Date(targetYear, month - 1, day);
  const daysLeft = Math.ceil((examDate.getTime() - now.getTime()) / 86400000);
  if (daysLeft <= 0) return null;
  if (daysLeft === 1) return '⏰ 1 day until your exam!';
  if (daysLeft < 7) return `⏰ ${daysLeft} days until your exam!`;
  if (daysLeft < 30) return `📅 ${Math.floor(daysLeft / 7)} week${Math.floor(daysLeft / 7) > 1 ? 's' : ''} until your exam`;
  return `📅 ~${Math.floor(daysLeft / 30)} month${Math.floor(daysLeft / 30) > 1 ? 's' : ''} until your exam`;
}

export function progressMessage(
  user: User,
  totalAttempts: number,
  accuracy: number,
  subjectCoverage: { subject: string; seen: number; total: number }[]
): string {
  const plan = user.plan === 'premium'
    ? `💎 Premium${user.plan_expires_at ? ` (until ${new Date(user.plan_expires_at).toLocaleDateString('en-NG')})` : ''}`
    : '🆓 Free';
  const countdown = examCountdown(user.exam_type || null, user.target_year || null);
  const coverageLines = subjectCoverage
    .filter(c => user.subjects?.includes(c.subject))
    .map(c => {
      const pct = Math.round((c.seen / c.total) * 100);
      const filled = Math.round(pct / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      const emoji = SUBJECT_EMOJI[c.subject] || '📖';
      return `  ${emoji} ${SUBJECT_MAP[c.subject] || c.subject}\n  <code>${bar}</code> ${pct}% (${c.seen}/${c.total})`;
    }).join('\n');

  const dailyTarget = 10;
  return `⚡ <b>Your Progress</b>

🔥 Streak: ${user.streak || 0} days
📅 Today: ${user.daily_count || 0}/${dailyTarget} questions
📝 Questions: ${totalAttempts.toLocaleString()} answered
🎯 Accuracy: ${accuracy}%${countdown ? `\n${countdown}` : ''}${coverageLines ? `\n\n📈 <b>Coverage:</b>\n${coverageLines}` : ''}

💳 Plan: ${plan}`;
}

export function streakBadge(streak: number): string {
  if (streak >= 90) return '🏆 LEGEND';
  if (streak >= 60) return '🥇 EXAM READY';
  if (streak >= 30) return '🥈 MONTHLY GRINDER';
  if (streak >= 7)  return '🥉 WEEK WARRIOR';
  return '📖 IN TRAINING';
}

export function shareableProgressCard(
  user: User,
  totalAttempts: number,
  accuracy: number,
  botUsername: string,
  subjectCoverage?: { subject: string; seen: number; total: number }[]
): string {
  const streak = user.streak || 0;
  const badge = streakBadge(streak);
  const examLine = user.exam_type && user.target_year ? `🎯 ${user.exam_type} ${user.target_year}` : '';

  // Best covered subject
  let coverageLine = '';
  if (subjectCoverage && subjectCoverage.length > 0) {
    const best = subjectCoverage
      .filter(c => user.subjects?.includes(c.subject) && c.total > 0)
      .sort((a, b) => (b.seen / b.total) - (a.seen / a.total))[0];
    if (best) {
      const pct = Math.round((best.seen / best.total) * 100);
      coverageLine = `📈 ${SUBJECT_MAP[best.subject] || best.subject}: ${pct}% covered`;
    }
  }

  const link = user.referral_code
    ? `https://t.me/${botUsername}?start=ref_${user.referral_code}`
    : `https://t.me/${botUsername}`;

  const rank = getRank(totalAttempts);

  const lines = [
    badge,
    '━━━━━━━━━━━━━━━━',
    `${user.first_name} · ExamBuddie`,
    `🏅 ${rank.label}`,
    `🔥 ${streak}-day streak`,
    `✅ ${totalAttempts.toLocaleString()} questions answered`,
    `🎯 ${accuracy}% accuracy`,
    examLine,
    coverageLine,
    '',
    'Studying smarter for WAEC/JAMB/NECO 📖',
    `Join me → ${link}`,
  ].filter(Boolean);

  return lines.join('\n');
}

export function onboardingGuide(): string {
  return `🎓 <b>Here's what you can do:</b>

📚 /practice — Answer past questions one at a time
📋 /quiz — 40-question timed mock exam
🎯 /drill — Focus on a weak topic
📊 /stats — See your accuracy &amp; streaks
🏆 /leaderboard — Weekly ranking
🔗 /invite — Earn Premium by referring friends
⚙️ /settings — Update your profile

💡 <i>Practise daily to build your streak!</i>`;
}

export function formatStreakCard(streak: number, weekActivity: boolean[]): string {
  const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  // Determine today's index in the week (0=Mon ... 6=Sun) using WAT (UTC+1)
  const watDay = new Date(Date.now() + 60 * 60 * 1000).getUTCDay(); // 0=Sun
  const todayIdx = watDay === 0 ? 6 : watDay - 1;

  const icons = weekActivity.map((active, i) => {
    if (active) return '🟠';
    if (i < todayIdx) return '❌'; // past day, not practiced
    return '⬜'; // today (if not yet done) or future
  });

  const streakLine = streak === 1
    ? '🔥 <b>1 day streak!</b> You\'re just getting started!'
    : streak >= 30
    ? `🔥 <b>${streak} day streak!</b> You're on fire! 🏆`
    : streak >= 7
    ? `🔥 <b>${streak} day streak!</b> Keep it going!`
    : `🔥 <b>${streak} day streak!</b>`;

  return `${streakLine}

<code>${days.join('  ')}
${icons.join('  ')}</code>`;
}
