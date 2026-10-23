import katex from "katex";
import "katex/dist/katex.min.css";

// Mirrors renderMath in miniapp/src/components/QuestionCard.tsx so the admin view
// shows questions and options exactly the way students see them. Keep the two in sync.

function tryKatex(expr: string, display: boolean): string {
  try {
    return katex.renderToString(expr.trim(), { displayMode: display, throwOnError: false, strict: false });
  } catch {
    return expr;
  }
}

// Regex that matches bare LaTeX math sequences (no delimiters)
const BARE_LATEX = /(?:\\(?:frac|sqrt|sum|prod|int|partial|lim|infty|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|times|div|pm|geq|leq|neq|approx|equiv|cdot|angle|parallel|perp|rightarrow|leftarrow|sin|cos|tan|log|ln|vec|hat|overline)(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?)+(?:\s*[+\-=/()[\]a-zA-Z0-9.,]*(?:\\[a-zA-Z]+(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?|(?:\^|_)(?:\{[^{}]+\}|[a-zA-Z0-9]))*)*/g;

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const FRAC_GLYPHS: Record<string, string> = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾",
  "1/5": "⅕", "2/5": "⅖", "3/5": "⅗", "4/5": "⅘",
  "1/6": "⅙", "5/6": "⅚", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
};

// Pre-process plain-text math notation that KaTeX won't handle
function preMath(text: string): string {
  return text
    .replace(/(?<![a-zA-Z0-9])\^(\d+)\/(\d+)/g, (_, n, d) => FRAC_GLYPHS[`${n}/${d}`] ?? `${n}/${d}`)
    .replace(/(\d)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, "$1 $2")
    .replace(/(?<![a-zA-Z0-9/:.])(\d+)\/(\d+)/g, (_, n, d) => FRAC_GLYPHS[`${n}/${d}`] ?? `${n}⁄${d}`)
    .replace(/\b(sin|cos|tan|sec|csc|cot)([2-9])(?![0-9])/g, (_, fn, d) => fn + SUP[parseInt(d)])
    .replace(/\blog([0-9]+)(?![0-9])/g, (_, d) => "log" + [...d].map((c) => SUB[parseInt(c)]).join(""))
    .replace(/(?<![a-zA-Z])([a-z])([2-9])(?![a-zA-Z0-9])/g, (_, l, d) => l + SUP[parseInt(d)]);
}

export function renderMath(text: string): string {
  let result = preMath(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  result = result
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, e) => tryKatex(e, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, e) => tryKatex(e, true));

  result = result
    .replace(/\$([^$\n]+?)\$/g, (_, e) => tryKatex(e, false))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, e) => tryKatex(e, false));

  result = result.replace(BARE_LATEX, (match) => tryKatex(match, false));

  result = result
    .replace(/\^\{([^}]+)\}/g, (_, e) => tryKatex(`^{${e}}`, false))
    .replace(/_\{([^}]+)\}/g, (_, e) => tryKatex(`_{${e}}`, false));

  result = result.replace(/\*([^*\n]+)\*/g, "<u>$1</u>");
  return result;
}

// Server-formatted explanation HTML: allow only bare <b>/<i>/<u>/<code>, escape any other "<".
// Same rule as miniapp/src/components/Explanation.tsx.
export function sanitizeExplanationHtml(html: string): string {
  return html.replace(/<(?!\/?(?:b|i|u|code)>)/g, "&lt;");
}

export default function MathText({ text, className = "" }: { text: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />;
}
