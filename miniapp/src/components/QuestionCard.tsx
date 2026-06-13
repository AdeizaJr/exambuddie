import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { Question } from '../types';

function renderMath(text: string): string {
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
    } catch { return expr; }
  });

  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
    } catch { return expr; }
  });

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

export default function QuestionCard({ question, qNum, total, selected, revealed, onSelect, disabled }: Props) {
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
    return {
      background: 'var(--tg-bg)',
      border: '1.5px solid rgba(0,0,0,0.07)',
      color: 'var(--tg-hint)',
      opacity: 0.6,
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
        <p
          className="question-text text-sm font-medium text-[var(--tg-text)] leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: renderMath(question.question_text) }}
        />
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
              className="text-sm font-medium flex-1"
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
            className="text-green-900 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMath(question.explanation || '') }}
          />
        </div>
      )}
    </div>
  );
}
