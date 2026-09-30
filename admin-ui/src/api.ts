import type {
  Stats,
  Flag,
  SystemAlert,
  BugReport,
  Question,
  User,
  UserActivity,
  Subscription,
  Analytics,
  PaginatedResponse,
  GrowthAnalytics,
  RetentionData,
  FunnelData,
  BroadcastLog,
  BulkImportResult,
  PricingSettings,
  PricingHistoryEntry,
  PageViewAnalytics,
  AuditLogEntry,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api/admin";

function getToken(): string {
  return localStorage.getItem("admin_token") || "";
}

// Simple in-memory TTL cache for GET requests — avoids re-fetching unchanged data on navigate
const _cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 60_000; // 1 minute

function cacheGet<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data as T;
  _cache.delete(key);
  return null;
}

function cacheSet(key: string, data: unknown, ttl = CACHE_TTL) {
  _cache.set(key, { data, expires: Date.now() + ttl });
}

export function invalidateCache(key?: string) {
  if (key) _cache.delete(key);
  else _cache.clear();
}

async function cachedReq<T>(path: string, params?: Record<string, string | number | undefined>, ttl?: number): Promise<T> {
  const sp = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const key = path + (sp.toString() ? "?" + sp.toString() : "");
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const data = await req<T>("GET", path, undefined, params);
  cacheSet(key, data, ttl);
  return data;
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  let url = BASE + path;
  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += "?" + qs;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function loginAdmin(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch(BASE + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>("PUT", "/password", { currentPassword, newPassword });
}

export async function getStats(): Promise<Stats> {
  return cachedReq<Stats>("/stats");
}

export async function getFlags(status?: "unresolved" | "resolved" | "all"): Promise<Flag[]> {
  return cachedReq<Flag[]>("/flags", { status }, 30_000);
}

export async function resolveFlag(
  id: number,
  explanation?: string,
  question_text?: string
): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>("POST", `/flags/${id}/resolve`, { explanation, question_text });
}

export async function getAlerts(): Promise<SystemAlert[]> {
  return cachedReq<SystemAlert[]>("/alerts", undefined, 30_000);
}

export async function resolveAlert(id: number): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>("POST", `/alerts/${id}/resolve`);
}

export async function getBugReports(resolved = false): Promise<BugReport[]> {
  return cachedReq<BugReport[]>("/bug-reports", { resolved: String(resolved) }, 30_000);
}

// Returns an object URL; <img src> can't send the admin Authorization header.
export async function getBugReportPhotoUrl(id: number, index: number): Promise<string> {
  const res = await fetch(`${BASE}/bug-reports/${id}/photos/${index}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Failed to load screenshot (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

export async function setBugReportResolved(id: number, resolved: boolean): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>("POST", `/bug-reports/${id}/resolve`, { resolved });
}

export interface QuestionsFilter {
  page?: number;
  limit?: number;
  subject?: string;
  exam_type?: string;
  year?: number;
  search?: string;
  has_diagram?: boolean;
  missing_explanation?: boolean;
  has_flags?: boolean;
}

export async function getQuestions(
  filter: QuestionsFilter = {}
): Promise<PaginatedResponse<Question>> {
  return req<PaginatedResponse<Question>>(
    "GET",
    "/questions",
    undefined,
    filter as Record<string, string | number | undefined>
  );
}

export async function updateQuestion(id: number, data: Partial<Question>): Promise<Question> {
  return req<Question>("PUT", `/questions/${id}`, data);
}

export async function deleteQuestion(id: number): Promise<{ ok: boolean; deleted: number }> {
  return req<{ ok: boolean; deleted: number }>("DELETE", `/questions/${id}`);
}

export async function uploadQuestionImage(id: number, file: File): Promise<Question> {
  const token = localStorage.getItem("admin_token") || "";
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${BASE}/questions/${id}/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteQuestionImage(id: number): Promise<{ ok: boolean }> {
  return req<{ ok: boolean }>("DELETE", `/questions/${id}/image`);
}

export async function toggleQuestionActive(id: number, is_active: boolean): Promise<{ id: number; is_active: boolean }> {
  return req<{ id: number; is_active: boolean }>("PATCH", `/questions/${id}/active`, { is_active });
}

export async function generateExplanation(id: number): Promise<{ explanation: string }> {
  return req<{ explanation: string }>("POST", `/questions/${id}/generate-explanation`);
}

export interface UsersFilter {
  page?: number;
  limit?: number;
  search?: string;
  plan?: 'all' | 'premium' | 'free' | 'trial';
  sent?: 'qotd' | 'dyk';
  sentDate?: string;
  sort?: 'activity';
}

export async function getUsers(filter: UsersFilter = {}): Promise<PaginatedResponse<User>> {
  return req<PaginatedResponse<User>>(
    "GET",
    "/users",
    undefined,
    filter as Record<string, string | number | undefined>
  );
}

export async function deleteUsers(
  payload: { ids: number[] } | { all: true; search?: string; confirmAll?: string }
): Promise<{ ok: boolean; deleted: number }> {
  return req<{ ok: boolean; deleted: number }>("DELETE", "/users", payload);
}

export async function updateUserPlan(
  telegramId: number,
  plan: "premium" | "free",
  months?: number
): Promise<User> {
  return req<User>("PUT", `/users/${telegramId}/plan`, { plan, months });
}

export async function getUserActivity(telegramId: number): Promise<UserActivity> {
  return req<UserActivity>("GET", `/users/${telegramId}/activity`);
}

export async function getSubscriptions(): Promise<Subscription[]> {
  return cachedReq<Subscription[]>("/subscriptions");
}

export async function getAnalytics(): Promise<Analytics> {
  return cachedReq<Analytics>("/analytics");
}

export interface LeaderboardEntry {
  rank: number;
  first_name: string;
  telegram_id: number;
  correct: number;
  total: number;
  accuracy: number;
}

export async function getLeaderboard(subject?: string): Promise<{ entries: LeaderboardEntry[]; active_users: number }> {
  return req<{ entries: LeaderboardEntry[]; active_users: number }>(
    "GET",
    "/leaderboard",
    undefined,
    subject ? { subject } : undefined
  );
}

export async function getSnapshotWeeks(): Promise<{ weeks: string[] }> {
  return req<{ weeks: string[] }>("GET", "/leaderboard/weeks");
}

export async function getLeaderboardSnapshot(week: string): Promise<{ entries: LeaderboardEntry[] }> {
  return req<{ entries: LeaderboardEntry[] }>("GET", "/leaderboard/snapshot", undefined, { week });
}

export type BroadcastTarget = "all" | "waec" | "jamb" | "neco" | "premium" | "free";

export async function broadcast(
  message: string,
  target: BroadcastTarget
): Promise<{ sent: number; failed: number; total: number }> {
  return req<{ sent: number; failed: number; total: number }>("POST", "/broadcast", {
    message,
    target,
  });
}

export interface UserSearchResult {
  telegram_id: number;
  first_name: string;
  username: string | null;
  exam_type: string | null;
  plan: string;
  streak: number;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const data = await req<{ data: UserSearchResult[] }>("GET", `/users?search=${encodeURIComponent(query)}&limit=8`);
  return data.data ?? [];
}

export async function sendDM(telegramId: number, message: string): Promise<void> {
  await req<{ ok: boolean }>("POST", "/dm", { telegram_id: telegramId, message });
}

export async function getGrowthAnalytics(): Promise<GrowthAnalytics> {
  return cachedReq<GrowthAnalytics>("/analytics/growth");
}

export async function getRetention(): Promise<RetentionData> {
  return cachedReq<RetentionData>("/analytics/retention");
}

export async function getFunnel(): Promise<FunnelData> {
  return cachedReq<FunnelData>("/analytics/funnel");
}

export async function getPageViewAnalytics(days = 30): Promise<PageViewAnalytics> {
  return cachedReq<PageViewAnalytics>("/analytics/pageviews", { days });
}

export async function getBroadcastHistory(): Promise<BroadcastLog[]> {
  const data = await req<{ history: BroadcastLog[] }>("GET", "/broadcast/history");
  return data.history;
}

export async function exportUsersCSV(): Promise<void> {
  const token = getToken();
  const url = `${BASE}/users/export`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `users-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function bulkImportQuestions(questions: unknown[]): Promise<BulkImportResult> {
  return req<BulkImportResult>("POST", "/questions/bulk-import", { questions });
}

export async function getPricing(): Promise<PricingSettings> {
  return req<PricingSettings>("GET", "/pricing");
}

export async function updatePricing(
  changes: Partial<PricingSettings>
): Promise<PricingSettings> {
  const result = await req<PricingSettings>("PUT", "/pricing", changes);
  invalidateCache("/pricing");
  return result;
}

export async function getPricingHistory(): Promise<PricingHistoryEntry[]> {
  return req<PricingHistoryEntry[]>("GET", "/pricing/history");
}

export async function getAuditLogs(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  return req<AuditLogEntry[]>("GET", "/audit-logs", undefined, { limit, offset });
}
