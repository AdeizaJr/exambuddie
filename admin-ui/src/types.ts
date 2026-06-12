export interface User {
  telegram_id: number;
  first_name: string;
  username: string | null;
  exam_type: "WAEC" | "JAMB" | "NECO" | "ALL" | "BOTH" | null;
  subjects: string[];
  plan: "free" | "premium";
  plan_expires_at: string | null;
  streak: number;
  joined_at: string;
  daily_count: number;
  last_active_date: string | null;
}

export interface Question {
  id: number;
  exam_type: "WAEC" | "JAMB" | "NECO";
  subject: string;
  year: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  correct_option: "A" | "B" | "C" | "D" | "E";
  explanation: string | null;
  explanation_reviewed: boolean;
  flag_count: number;
  source_id: string | null;
  created_at: string;
}

export interface Flag {
  id: number;
  flagged_at: string;
  reason: string;
  resolved: boolean;
  question_id: number;
  subject: string;
  question_text: string;
  correct_option: string;
  explanation: string | null;
  flag_count: number;
}

export interface Subscription {
  id: number;
  plan: string;
  amount_ngn: number;
  status: string;
  started_at: string;
  expires_at: string | null;
  flutterwave_tx_ref: string | null;
  first_name: string;
  username: string | null;
  telegram_id: number;
}

export interface Stats {
  total_users: number;
  premium_users: number;
  new_today: number;
  attempts_today: number;
  total_attempts: number;
  total_questions: number;
  pending_flags: number;
  total_revenue_ngn: number;
}

export interface DailyData {
  date: string;
  attempts: number;
  correct: number;
}

export interface SubjectData {
  subject: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface Analytics {
  daily: DailyData[];
  subjects: SubjectData[];
  contentHealth: {
    missing_explanations: number;
    flagged_questions: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
