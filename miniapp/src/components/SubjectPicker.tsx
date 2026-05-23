import { haptic } from '../telegram';

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Mathematics',
  english: 'English',
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
  geography: 'Geography',
  economics: 'Economics',
  government: 'Government',
  accounts: 'Accounting',
  commerce: 'Commerce',
  crk: 'CRK',
  irk: 'IRK',
  literature: 'Literature',
  agric: 'Agriculture',
  'further-math': 'Further Maths',
  'data-processing': 'Data Processing',
  computer: 'Computer Science',
  pe: 'Physical Education',
};

const SUBJECT_ICONS: Record<string, string> = {
  math: '📐', english: '📖', biology: '🧬', chemistry: '⚗️',
  physics: '⚡', geography: '🌍', economics: '📈', government: '🏛️',
  accounts: '🧮', commerce: '🛒', crk: '✝️', irk: '☪️',
  literature: '📜', agric: '🌱', 'further-math': '🔢', 'data-processing': '💾',
  computer: '💻', pe: '⚽',
};

interface Props {
  subjects: string[];
  onSelect: (subject: string) => void;
}

export default function SubjectPicker({ subjects, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {subjects.map(s => (
        <button
          key={s}
          onClick={() => { haptic('light'); onSelect(s); }}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-gray-200 bg-white/60 active:bg-gray-100 transition-colors text-sm font-medium text-[var(--tg-text)]"
        >
          <span className="text-3xl">{SUBJECT_ICONS[s] || '📚'}</span>
          <span className="text-center leading-tight">{SUBJECT_LABELS[s] || s}</span>
        </button>
      ))}
    </div>
  );
}

export { SUBJECT_LABELS, SUBJECT_ICONS };
