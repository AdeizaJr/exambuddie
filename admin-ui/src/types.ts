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
  phone_number: string | null;
  last_qotd_sent_at: string | null;
  last_dyk_sent_at: string | null;
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
  has_diagram: boolean;
  image_url?: string;
  is_active: boolean;
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
  user_first_name: string | null;
  user_telegram_id: number | null;
}

export interface SystemAlert {
  id: number;
  severity: "info" | "warning" | "critical";
  source: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

export interface BugReport {
  id: number;
  telegram_id: string;
  name: string | null;
  message: string;
  photo_count: number;
  resolved: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  admin_username: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface Subscription {
  id: number;
  plan: string;
  amount_ngn: number;
  status: string;
  started_at: string;
  expires_at: string | null;
  paystack_tx_ref: string | null;
  flutterwave_tx_ref: string | null;
  is_recurring: boolean;
  cancelled_at: string | null;
  first_name: string;
  username: string | null;
  telegram_id: number;
}

export interface Stats {
  total_users: number;
  premium_users: number;
  blocked_users?: number;
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

export interface WeakTopicData {
  subject: string;
  topic: string;
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
  weakTopics: WeakTopicData[];
  engagement: {
    dau: number;
    wau: number;
    mau: number;
  };
}

export interface UserActivitySummary {
  total_attempts: number;
  correct: number;
  accuracy: number;
}

export interface UserActivitySubject {
  subject: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface UserActivityAttempt {
  question_id: number;
  is_correct: boolean;
  selected_option: string;
  attempted_at: string;
  subject: string;
  year: number;
  exam_type: string;
}

export interface UserWeakTopic {
  subject: string;
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface UserActivity {
  summary: UserActivitySummary;
  subjects: UserActivitySubject[];
  recent: UserActivityAttempt[];
  weakTopics: UserWeakTopic[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface GrowthData {
  date: string;
  new_users: number;
  new_premium: number;
}

export interface RevenueData {
  date: string;
  subs: number;
  revenue_ngn: number;
}

export interface ExamBreakdown {
  exam_type: string;
  users: number;
  premium: number;
}

export interface GrowthAnalytics {
  userGrowth: GrowthData[];
  revenueGrowth: RevenueData[];
  examBreakdown: ExamBreakdown[];
}

export interface RetentionData {
  total_users: number;
  d1: number;
  d7: number;
  d30: number;
  d1_rate: number;
  d7_rate: number;
  d30_rate: number;
}

export interface FunnelData {
  total_users: number;
  premium_users: number;
  active_free: number;
  active_subs: number;
  churned_30d: number;
  mrr: number;
}

export interface PageViewAnalytics {
  totalViews: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number }[];
  topSources: { source: string; views: number }[];
  daily: { date: string; views: number; uniques: number }[];
}

export interface BroadcastLog {
  id: number;
  message: string;
  target: string;
  sent: number;
  failed: number;
  total: number;
  sent_at: string;
}

export interface BulkImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export interface PricingSettings {
  monthly_ngn: number;
  term_ngn: number;
  yearly_ngn: number;
  free_daily_limit: number;
}

export interface PricingHistoryEntry {
  key: string;
  old_value: string | null;
  new_value: string;
  updated_by: string | null;
  updated_at: string;
}
