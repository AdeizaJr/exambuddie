import type { Question } from '../types';

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

  function getOptionStyle(opt: string): string {
    const base = 'w-full text-left px-4 py-3 rounded-xl text-sm font-medium border transition-all mb-2';
    if (!revealed) {
      if (selected === opt)
        return `${base} border-[var(--tg-button)] bg-[var(--tg-button)] text-[var(--tg-button-text)]`;
      return `${base} border-gray-200 bg-white/60 text-[var(--tg-text)]`;
    }
    if (opt === question.correct_option)
      return `${base} border-green-500 bg-green-50 text-green-800`;
    if (selected === opt && opt !== question.correct_option)
      return `${base} border-red-400 bg-red-50 text-red-700`;
    return `${base} border-gray-200 bg-white/40 text-[var(--tg-hint)]`;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-[var(--tg-hint)]">
        <span>Question {qNum} of {total}</span>
        {question.year && <span>{question.exam_type} {question.year}</span>}
      </div>

      {/* Question text */}
      <div className="bg-white/70 rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="question-text text-sm font-medium text-[var(--tg-text)] leading-relaxed whitespace-pre-wrap">
          {question.question_text}
        </p>
      </div>

      {/* Options */}
      <div>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => !disabled && onSelect?.(opt)}
            disabled={disabled}
            className={getOptionStyle(opt)}
          >
            <span className="font-bold mr-2">{opt}.</span>
            {optionText(question, opt)}
          </button>
        ))}
      </div>

      {/* Explanation */}
      {revealed && question.explanation && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
          <span className="font-semibold">💡 Explanation: </span>
          {question.explanation}
        </div>
      )}
    </div>
  );
}
