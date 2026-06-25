export interface User {
  telegram_id: number;
  first_name: string;
  username?: string;
  exam_type: string;
  subjects: string[];
  plan: 'free' | 'premium';
  plan_expires_at?: string;
  streak: number;
  daily_count: number;
}

export interface Question {
  id: number;
  exam_type: string;
  subject: string;
  year?: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string;
  correct_option: string;
  explanation?: string;
  has_diagram?: boolean;
  image_url?: string;
}

export interface SubjectStat {
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface Stats {
  total: number;
  correct: number;
  accuracy: number;
  streak: number;
  subjectStats: SubjectStat[];
  weakTopics: { topic: string; accuracy: number }[];
}

export interface QuizResult {
  sessionId: string;
  correct: number;
  total: number;
  accuracy: number;
  durationSecs: number;
  answers: { qId: number; selected: string; correct: string; isCorrect: boolean }[];
}

export type ExamType = 'WAEC' | 'JAMB' | 'NECO';
