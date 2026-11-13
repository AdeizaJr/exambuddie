import React, { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { getUserActivity, getUserMessages } from "../api";
import type { User, UserActivity, UserWeakTopic, UserAdminMessage } from "../types";
import Spinner from "./Spinner";
import Modal from "./Modal";

// "13 Nov 2026, 5:55 pm WAT": Nigerian time regardless of where the admin is browsing from
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
  return `${d} WAT`;
}

function UserMessages({ telegramId }: { telegramId: number }) {
  const [messages, setMessages] = useState<UserAdminMessage[] | null>(null);

  useEffect(() => {
    getUserMessages(telegramId).then(setMessages).catch(() => setMessages([]));
  }, [telegramId]);

  if (!messages) return <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>;
  if (!messages.length) return <p className="py-4 text-center text-sm text-muted">No messages sent to this user yet</p>;

  return (
    <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
      {messages.map((m) => (
        <div key={`${m.kind}-${m.id}`} className="rounded-lg border border-border bg-surface2 p-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              m.kind === "dm" ? "border-purple-400/30 bg-purple-400/10 text-purple-300"
                : m.kind === "auto" ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                : "border-accent/30 bg-accent/10 text-accent"
            }`}>
              {m.kind === "dm" ? "DM" : m.kind === "auto" ? `Auto · ${m.target}` : `Broadcast · ${m.target}`}
            </span>
            <span className={`text-xs ${m.ok ? "text-green-400" : "text-red-400"}`}>
              {m.ok ? "✓ Delivered" : `✗ Failed${m.error ? `: ${m.error}` : ""}`}
            </span>
            <span className="ml-auto text-xs text-muted">
              {m.sent_by ? `${m.sent_by} · ` : ""}
              {new Date(m.sent_at).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-xs text-white">{m.message}</p>
        </div>
      ))}
    </div>
  );
}

// Activity + message history for one user. Shared by the Users and Overview pages.
export default function UserActivityModal({ user, onClose }: { user: User; onClose: () => void }) {
  const activityUser = user;
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityTab, setActivityTab] = useState<"activity" | "messages">("activity");

  useEffect(() => {
    let cancelled = false;
    setActivity(null);
    setActivityTab("activity");
    setActivityLoading(true);
    getUserActivity(user.telegram_id)
      .then((data) => { if (!cancelled) setActivity(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setActivityLoading(false); });
    return () => { cancelled = true; };
  }, [user.telegram_id]);

  return (
    <Modal
      title={`User Activity — ${activityUser.first_name} (${activityUser.telegram_id})`}
      onClose={onClose}
    >
          <div className="mb-4 flex gap-1.5 border-b border-border pb-3">
            {(["activity", "messages"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActivityTab(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  activityTab === t ? "bg-accent/15 text-accent" : "text-muted hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {activityTab === "messages" ? (
            <UserMessages telegramId={activityUser.telegram_id} />
          ) : activityLoading || !activity ? (
            <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
          ) : (
            <div className="space-y-6">
              {/* User meta */}
              <div className="flex flex-wrap gap-4 text-xs text-muted">
                <span>📱 <span className="text-white">{activityUser.phone_number ?? "Not provided"}</span></span>
                <span className="inline-flex items-center gap-1"><Flame size={13} className="text-orange-400" /> <span className="text-white">{activityUser.streak}-day streak</span></span>
                <span>📅 Joined <span className="text-white">{formatDateTime(activityUser.joined_at)}</span></span>
              </div>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Questions", value: Number(activity.summary.total_attempts).toLocaleString() },
                  { label: "Correct", value: Number(activity.summary.correct).toLocaleString() },
                  { label: "Accuracy", value: `${activity.summary.accuracy ?? 0}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-border bg-surface2 p-3 text-center">
                    <p className="text-lg font-bold text-white">{value}</p>
                    <p className="mt-0.5 text-xs text-muted">{label}</p>
                  </div>
                ))}
              </div>

              {/* Subject breakdown */}
              {activity.subjects.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">By Subject</h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-surface2">
                          <th className="px-3 py-2 text-left font-medium text-muted">Subject</th>
                          <th className="px-3 py-2 text-right font-medium text-muted">Attempts</th>
                          <th className="px-3 py-2 text-right font-medium text-muted">Correct</th>
                          <th className="px-3 py-2 text-right font-medium text-muted">Accuracy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {activity.subjects.map((s) => (
                          <tr key={s.subject} className="hover:bg-surface2">
                            <td className="px-3 py-2 capitalize text-white">{s.subject.replace(/-/g, " ")}</td>
                            <td className="px-3 py-2 text-right text-muted">{Number(s.attempts).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-muted">{Number(s.correct).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-medium text-white">{s.accuracy}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Weak topics */}
              {activity.weakTopics?.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Weak Topics</h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-surface2">
                          <th className="px-3 py-2 text-left font-medium text-muted">Topic</th>
                          <th className="px-3 py-2 text-left font-medium text-muted">Subject</th>
                          <th className="px-3 py-2 text-right font-medium text-muted">Attempts</th>
                          <th className="px-3 py-2 text-right font-medium text-muted">Accuracy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {activity.weakTopics.map((t: UserWeakTopic) => (
                          <tr key={`${t.subject}-${t.topic}`} className="hover:bg-surface2">
                            <td className="px-3 py-2 text-white">{t.topic}</td>
                            <td className="px-3 py-2 capitalize text-muted">{t.subject.replace(/-/g, " ")}</td>
                            <td className="px-3 py-2 text-right text-muted">{Number(t.attempts).toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right font-bold ${Number(t.accuracy) < 40 ? "text-red-400" : Number(t.accuracy) < 60 ? "text-amber-400" : "text-white"}`}>
                              {t.accuracy}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent attempts */}
              {activity.recent.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Recent Attempts (last 50)</h3>
                  <div className="max-h-56 overflow-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left font-medium text-muted">Q ID</th>
                          <th className="px-3 py-2 text-left font-medium text-muted">Subject</th>
                          <th className="px-3 py-2 text-left font-medium text-muted">Exam / Year</th>
                          <th className="px-3 py-2 text-left font-medium text-muted">Result</th>
                          <th className="px-3 py-2 text-left font-medium text-muted">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {activity.recent.map((a, i) => (
                          <tr key={i} className="hover:bg-surface2">
                            <td className="px-3 py-2 text-muted">{a.question_id}</td>
                            <td className="px-3 py-2 capitalize text-white">{a.subject.replace(/-/g, " ")}</td>
                            <td className="px-3 py-2 text-muted">{a.exam_type} {a.year}</td>
                            <td className="px-3 py-2">
                              <span className={`font-medium ${a.is_correct ? "text-green-400" : "text-red-400"}`}>
                                {a.is_correct ? "✓" : "✗"} {a.selected_option}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted">
                              {new Date(a.attempted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activity.summary.total_attempts === 0 && (
                <p className="py-4 text-center text-sm text-muted">No activity yet</p>
              )}
            </div>
          )}
    </Modal>
  );
}
