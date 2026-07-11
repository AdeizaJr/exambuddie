import { memo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { Question } from '../types';

function tryKatex(expr: string, display: boolean): string {
  try {
    return katex.renderToString(expr.trim(), { displayMode: display, throwOnError: false, strict: false });
  } catch {
    return expr;
  }
}

// Regex that matches bare LaTeX math sequences (no delimiters)
const BARE_LATEX = /(?:\\(?:frac|sqrt|sum|prod|int|partial|lim|infty|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|times|div|pm|geq|leq|neq|approx|equiv|cdot|angle|parallel|perp|rightarrow|leftarrow|sin|cos|tan|log|ln|vec|hat|overline)(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?)+(?:\s*[+\-=\/()\[\]a-zA-Z0-9.,]*(?:\\[a-zA-Z]+(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?|(?:\^|_)(?:\{[^{}]+\}|[a-zA-Z0-9]))*)*/g;

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const FRAC_GLYPHS: Record<string, string> = {
  '1/2':'½','1/3':'⅓','2/3':'⅔','1/4':'¼','3/4':'¾',
  '1/5':'⅕','2/5':'⅖','3/5':'⅗','4/5':'⅘',
  '1/6':'⅙','5/6':'⅚','1/8':'⅛','3/8':'⅜','5/8':'⅝','7/8':'⅞',
};

// Pre-process plain-text math notation that KaTeX won't handle
function preMath(text: string): string {
  return text
    // fraction coefficient with ^ prefix (no base): ^2/5x → ⅖x
    .replace(/(?<![a-zA-Z0-9])\^(\d+)\/(\d+)/g, (_, n, d) => FRAC_GLYPHS[`${n}/${d}`] ?? `${n}/${d}`)
    // space between digit and fraction glyph: 1⅞ → 1 ⅞
    .replace(/(\d)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2')
    // plain numeric fractions (digits only denominator): 15/16 → 15⁄16, 2/5x → ⅖x
    .replace(/(?<![a-zA-Z0-9\/:.])(\d+)\/(\d+)/g, (_, n, d) => FRAC_GLYPHS[`${n}/${d}`] ?? `${n}⁄${d}`)
    // trig squared: sin2θ → sin²θ
    .replace(/\b(sin|cos|tan|sec|csc|cot)([2-9])(?![0-9])/g, (_, fn, d) => fn + SUP[parseInt(d)])
    // log base: log2 → log₂
    .replace(/\blog([0-9]+)(?![0-9])/g, (_, d) => 'log' + [...d].map(c => SUB[parseInt(c)]).join(''))
    // algebra bare power: x2 → x²
    .replace(/(?<![a-zA-Z])([a-z])([2-9])(?![a-zA-Z0-9])/g, (_, l, d) => l + SUP[parseInt(d)]);
}

function renderMath(text: string): string {
  // Pre-process plain-text notation before HTML escaping
  const preprocessed = preMath(text);

  // Escape HTML
  let result = preprocessed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Display mode: $$...$$ and \[...\]
  result = result
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, e) => tryKatex(e, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, e) => tryKatex(e, true));

  // Inline mode: $...$ and \(...\)
  result = result
    .replace(/\$([^\$\n]+?)\$/g, (_, e) => tryKatex(e, false))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, e) => tryKatex(e, false));

  // Bare LaTeX commands (e.g. \frac{1}{2} without delimiters)
  result = result.replace(BARE_LATEX, (match) => tryKatex(match, false));

  // Superscripts/subscripts outside KaTeX context
  result = result
    .replace(/\^\{([^}]+)\}/g, (_, e) => tryKatex(`^{${e}}`, false))
    .replace(/_\{([^}]+)\}/g, (_, e) => tryKatex(`_{${e}}`, false));

  // *text* → underline
  result = result.replace(/\*([^*\n]+)\*/g, '<u>$1</u>');
  return result;
}

interface Props {
  question: Question;
  qNum: number;
  total: number | string;
  selected?: string;
  revealed?: boolean;
  onSelect?: (option: string) => void;
  disabled?: boolean;
}

const OPTIONS = ['A', 'B', 'C', 'D', 'E'] as const;

const OPTION_COLORS: Record<string, { bg: string; text: string; border: string; lightBg: string }> = {
  A: { bg: '#3B82F6', text: '#fff', border: '#3B82F6', lightBg: '#EFF6FF' },
  B: { bg: '#8B5CF6', text: '#fff', border: '#8B5CF6', lightBg: '#F5F3FF' },
  C: { bg: '#10B981', text: '#fff', border: '#10B981', lightBg: '#ECFDF5' },
  D: { bg: '#F59E0B', text: '#fff', border: '#F59E0B', lightBg: '#FFFBEB' },
  E: { bg: '#EF4444', text: '#fff', border: '#EF4444', lightBg: '#FEF2F2' },
};

function optionText(q: Question, opt: string): string {
  switch (opt) {
    case 'A': return q.option_a;
    case 'B': return q.option_b;
    case 'C': return q.option_c;
    case 'D': return q.option_d;
    case 'E': return q.option_e || '';
    default: return '';
  }
}

function QuestionCard({ question, qNum, total, selected, revealed, onSelect, disabled }: Props) {
  const options = OPTIONS.filter(o => optionText(question, o) !== '');

  function getOptionStyle(opt: string): React.CSSProperties {
    const col = OPTION_COLORS[opt];

    if (!revealed) {
      if (selected === opt) {
        return {
          background: col.lightBg,
          border: `2px solid ${col.border}`,
          color: 'var(--tg-text)',
        };
      }
      return {
        background: 'var(--tg-bg)',
        border: '1.5px solid rgba(0,0,0,0.1)',
        color: 'var(--tg-text)',
      };
    }

    if (opt === question.correct_option) {
      return { background: '#ECFDF5', border: '2px solid #10B981', color: '#065F46' };
    }
    if (selected === opt) {
      return { background: '#FEF2F2', border: '2px solid #EF4444', color: '#991B1B' };
    }
    // No opacity multiplier here — --tg-hint alone already reads as de-emphasized next
    // to the correct/selected colors above; stacking 60% opacity on top of it drops
    // effective contrast to ~2.3:1 against the card background, failing WCAG 1.4.3 on
    // exactly the screen where the user reviews what they got wrong.
    return {
      background: 'var(--tg-bg)',
      border: '1.5px solid rgba(0,0,0,0.07)',
      color: 'var(--tg-hint)',
    };
  }

  function getBadgeStyle(opt: string): React.CSSProperties {
    const col = OPTION_COLORS[opt];

    if (!revealed) {
      if (selected === opt) return { background: col.bg, color: col.text };
      return { background: 'rgba(0,0,0,0.06)', color: 'var(--tg-hint)' };
    }

    if (opt === question.correct_option) return { background: '#10B981', color: '#fff' };
    if (selected === opt) return { background: '#EF4444', color: '#fff' };
    return { background: 'rgba(0,0,0,0.06)', color: 'var(--tg-hint)' };
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--tg-hint)]">
          Question {qNum} of {total}
        </span>
        {question.year && (
          <span className="text-[10px] font-semibold text-[var(--tg-hint)] bg-gray-100 px-2 py-0.5 rounded-full">
            {question.exam_type} {question.year}
          </span>
        )}
      </div>

      {/* Question text */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)',
          border: '1px solid rgba(99,102,241,0.12)',
        }}
      >
        <div className="overflow-x-auto">
          <p
            className="question-text text-sm font-medium text-[var(--tg-text)] leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderMath(question.question_text) }}
          />
        </div>
        {question.image_url && (
          <img
            src={question.image_url}
            // Per-image descriptive alt text isn't generated anywhere in this pipeline —
            // this at least tells a screen-reader user there's a diagram referenced by
            // the question above, instead of the content-free "diagram".
            alt="Diagram referenced in the question above"
            className="mt-3 max-h-52 w-full rounded-xl object-contain bg-white"
          />
        )}
        {question.has_diagram && !question.image_url && (
          <p className="mt-2 text-xs text-amber-600 italic">⚠️ This question has a diagram not yet available.</p>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => !disabled && onSelect?.(opt)}
            disabled={disabled}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all active:scale-[0.98]"
            style={getOptionStyle(opt)}
          >
            <span
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold"
              style={getBadgeStyle(opt)}
            >
              {opt}
            </span>
            <span
              className="text-sm font-medium flex-1 min-w-0 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: renderMath(optionText(question, opt)) }}
            />
            {revealed && opt === question.correct_option && (
              <span className="text-green-600 text-base flex-shrink-0">✓</span>
            )}
            {revealed && selected === opt && opt !== question.correct_option && (
              <span className="text-red-500 text-base flex-shrink-0">✗</span>
            )}
          </button>
        ))}
      </div>

      {/* Explanation */}
      {revealed && question.explanation && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
        >
          <p className="font-bold text-green-800 mb-1">💡 Explanation</p>
          <span
            className="block overflow-x-auto text-green-900 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMath(question.explanation || '') }}
          />
        </div>
      )}
    </div>
  );
}

export default memo(QuestionCard);
