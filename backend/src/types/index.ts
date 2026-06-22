// src/types/index.ts

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string;
  exam_type: 'WAEC' | 'JAMB' | 'NECO' | 'ALL' | 'BOTH' | null;
  subjects: string[];
  target_year: number | null;
  plan: 'free' | 'premium';
  plan_expires_at: string | null;
  daily_count: number;
  daily_reset_at: string;
  streak: number;
  last_active_date: string | null;
  phone_number: string | null;
  notifications_enabled: boolean;
  referral_code: string | null;
  referred_by: number | null;
  referral_reward_granted: boolean;
  streak_freeze_used_at?: string | null;
  trial_used?: boolean;
  daily_reminder_hour?: number | null;
  source?: string | null;
  joined_at: string;
  updated_at: string;
}

export interface Question {
  id: number;
  exam_type: 'WAEC' | 'JAMB' | 'NECO';
  subject: string;
  year: number;
  topic: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  correct_option: 'A' | 'B' | 'C' | 'D' | 'E';
  explanation: string | null;
  explanation_reviewed: boolean;
  flag_count: number;
  source_id: string | null;
  image_url: string | null;
  created_at: string;
}

export interface AttemptLog {
  userId: number;
  questionId: number;
  selectedOption: string;
  isCorrect: boolean;
  sessionId: string;
  timeTakenMs?: number;
}

export interface UserStats {
  total_attempts: string | number;
  correct: string | number;
  accuracy: string | number;
}

export interface WeakTopic {
  topic: string;
  attempts: string | number;
  correct: string | number;
  accuracy: string | number;
}

export interface SubjectStat {
  subject: string;
  attempts: string | number;
  correct: string | number;
  accuracy: string | number;
}

export interface SessionState {
  step?: string;
  selectedSubjects?: string[];
  examType?: string;
  targetYear?: number | null;
  mode?: 'practice' | 'quiz' | 'drill';
  subject?: string;
  year?: number | null;
  topic?: string;
  sessionId?: string;
  qNum?: number;
  correct?: number;
  total?: number;
  currentQuestion?: Question;
  startTime?: number;
  usedIds?: number[];
  lastQuestionTime?: number;
  consecutiveCorrect?: number;
  awaitingNext?: boolean;
  lastAnswer?: string;
  questions?: number[];
  questionIndex?: number;
  questionTimerSecs?: number;
  questionDeadline?: number;
  pendingSubject?: string;
  pendingSubjects?: string[];
  pendingYear?: number | null;
  pendingExamType?: string;
}

export interface QuizAnswer {
  qId: number;
  selected: string;
  correct: string;
  isCorrect: boolean;
}

export interface QuizState {
  mode: 'quiz';
  subject: string;
  sessionId: string;
  questions: Question[];
  qIndex: number;
  correct: number;
  total: number;
  startTime: number;
  deadline: number;
  answers: QuizAnswer[];
  questionTimerSecs?: number;
  questionDeadline?: number;
}
