import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { getTheoryQuestions, updateTheoryQuestion, setTheoryFlags } from "../api";
import type { TheoryQuestion, TheoryListResponse } from "../types";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import Badge from "../components/Badge";
import MathText from "../components/MathText";

// Theory + practical (essay) questions, served to students by the bot's theory practice.
// "Checked" marks a question a human has reviewed; only "On" questions are shown to students.

const EXAM_TYPES = ["WAEC", "NECO"];
const YEARS = Array.from({ length: 17 }, (_, i) => 2026 - i);

const selectClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none";

function Pill({ on, onLabel, offLabel, onClick, title }: { on: boolean; onLabel: string; offLabel: string; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
        on
          ? "bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20"
          : "bg-surface2 text-muted border border-border hover:bg-green-500/15 hover:text-green-400 hover:border-green-500/20"
      }`}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white">
      <MathText text={text} />
    </div>
  );
}

function Stat({ label, value, tone = "text-white" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export default function Theory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subject = searchParams.get("subject") ?? "";
  const examType = searchParams.get("exam") ?? "";
  const year = searchParams.get("year") ?? "";
  const paperType = searchParams.get("paper") ?? "";
  const reviewed = searchParams.get("reviewed") ?? "";
  const active = searchParams.get("active") ?? "";
  const missingAnswer = searchParams.get("missing_answer") ?? "";
  const search = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const [result, setResult] = useState<TheoryListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<TheoryQuestion | null>(null);
  const [editTarget, setEditTarget] = useState<TheoryQuestion | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  function setFilter(key: string, value: string, keepPage = false) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (!keepPage) next.delete("page");
        return next;
      },
      { replace: true }
    );
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTheoryQuestions({
        page,
        limit: 50,
        subject: subject || undefined,
        exam_type: examType || undefined,
        year: year ? parseInt(year) : undefined,
        paper_type: paperType || undefined,
        reviewed: reviewed || undefined,
        active: active || undefined,
        missing_answer: missingAnswer || undefined,
        search: search || undefined,
      });
      setResult(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load theory questions");
    } finally {
      setLoading(false);
    }
  }, [page, subject, examType, year, paperType, reviewed, active, missingAnswer, search]);

  useEffect(() => {
    load();
  }, [load]);

  function patchRow(id: number, patch: Partial<TheoryQuestion>) {
    setResult((prev) => (prev ? { ...prev, data: prev.data.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : prev));
    setViewTarget((v) => (v && v.id === id ? { ...v, ...patch } : v));
  }

  async function toggle(q: TheoryQuestion, field: "is_active" | "reviewed") {
    try {
      const updated = await setTheoryFlags(q.id, { [field]: !q[field] });
      patchRow(q.id, { is_active: updated.is_active, reviewed: updated.reviewed });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Update failed");
    }
  }

  function openEdit(q: TheoryQuestion) {
    setViewTarget(null);
    setEditTarget(q);
    setEditQuestion(q.question_text);
    setEditAnswer(q.worked_solution ?? "");
  }

  async function handleSave() {
    if (!editTarget || !editQuestion.trim()) return;
    setSaving(true);
    try {
      const updated = await updateTheoryQuestion(editTarget.id, {
        question_text: editQuestion,
        worked_solution: editAnswer.trim() ? editAnswer : null,
      });
      patchRow(updated.id, updated);
      setEditTarget(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const counts = result?.counts;

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Theory</h1>
        <p className="mt-0.5 text-sm text-muted">
          Theory and practical questions with model answers. Live in the bot under Practice → Theory.
        </p>
      </div>

      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Questions" value={counts.total} />
          <Stat label="Checked" value={counts.reviewed} tone="text-success" />
          <Stat label="Waiting" value={counts.total - counts.reviewed} tone="text-amber-400" />
          <Stat label="No answer" value={counts.missing_answer} tone={counts.missing_answer ? "text-red-400" : "text-white"} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={subject} onChange={(e) => setFilter("subject", e.target.value)} className={selectClass}>
          <option value="">All Subjects</option>
          {(result?.subjects ?? []).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={examType} onChange={(e) => setFilter("exam", e.target.value)} className={selectClass}>
          <option value="">All Exams</option>
          {EXAM_TYPES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={year} onChange={(e) => setFilter("year", e.target.value)} className={selectClass}>
          <option value="">All Years</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={paperType} onChange={(e) => setFilter("paper", e.target.value)} className={selectClass}>
          <option value="">Theory + Practical</option>
          <option value="theory">Theory only</option>
          <option value="practical">Practical only</option>
        </select>
        <select value={reviewed} onChange={(e) => setFilter("reviewed", e.target.value)} className={selectClass}>
          <option value="">Checked + Waiting</option>
          <option value="false">Waiting for check</option>
          <option value="true">Checked</option>
        </select>
        <select value={active} onChange={(e) => setFilter("active", e.target.value)} className={selectClass}>
          <option value="">On + Off</option>
          <option value="true">On</option>
          <option value="false">Off</option>
        </select>
        <select value={missingAnswer} onChange={(e) => setFilter("missing_answer", e.target.value)} className={selectClass}>
          <option value="">All Answers</option>
          <option value="true">Missing answer</option>
        </select>
        <input
          type="text"
          placeholder="Search by ID, source ID, or question text..."
          value={search}
          onChange={(e) => setFilter("q", e.target.value)}
          className="min-w-48 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
        />
        <button onClick={load} className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border">
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : error ? (
          <div className="p-6 text-red-400">{error}</div>
        ) : !result?.data.length ? (
          <div className="p-10 text-center text-sm text-muted">No theory questions match these filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["ID", "Question", "Subject", "Exam", "Year", "Paper", "Answer", "Checked", "Active", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.data.map((q) => (
                    <tr key={q.id} className="transition-colors hover:bg-surface2">
                      <td className="px-4 py-3 font-mono text-xs text-muted">{q.id}</td>
                      <td className="max-w-sm px-4 py-3 text-white">
                        {q.question_number != null && <span className="mr-1.5 font-mono text-xs text-muted">Q{q.question_number}</span>}
                        {q.image_urls.length > 0 && (
                          <span className="mr-2 inline-flex items-center rounded border border-amber-500/20 bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-400">
                            🖼 {q.image_urls.length}
                          </span>
                        )}
                        <button type="button" onClick={() => setViewTarget(q)} className="text-left hover:text-accent hover:underline">
                          {q.question_text.length > 90 ? q.question_text.slice(0, 90) + "…" : q.question_text}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{q.subject}</td>
                      <td className="px-4 py-3"><Badge variant={q.exam_type === "WAEC" ? "green" : "amber"}>{q.exam_type}</Badge></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{q.year}</td>
                      <td className="px-4 py-3">
                        <Badge variant={q.paper_type === "practical" ? "blue" : "gray"}>{q.paper_type}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {q.worked_solution ? <span className="text-success">✓</span> : <span className="text-red-400">✗</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Pill on={q.reviewed} onLabel="Checked" offLabel="Waiting" onClick={() => toggle(q, "reviewed")} title="Mark as checked or not" />
                      </td>
                      <td className="px-4 py-3">
                        <Pill on={q.is_active} onLabel="On" offLabel="Off" onClick={() => toggle(q, "is_active")} title="Turn on or off" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setViewTarget(q)} className="rounded border border-border bg-surface2 px-2.5 py-1 text-xs text-white transition-colors hover:bg-border">View</button>
                          <button onClick={() => openEdit(q)} className="rounded border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/20">Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.pages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-muted">
                  Page {result.page} of {result.pages} · {result.total.toLocaleString()} questions
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setFilter("page", String(page - 1), true)}
                    className="rounded border border-border bg-surface2 px-3 py-1 text-xs text-white disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= result.pages}
                    onClick={() => setFilter("page", String(page + 1), true)}
                    className="rounded border border-border bg-surface2 px-3 py-1 text-xs text-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* View */}
      {viewTarget && (
        <Modal title={`${viewTarget.exam_type} ${viewTarget.year} ${viewTarget.subject} · ${viewTarget.paper_type}${viewTarget.question_number != null ? ` · Q${viewTarget.question_number}` : ""}`} onClose={() => setViewTarget(null)} wide>
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-mono">#{viewTarget.id}</span>
              <span className="font-mono">{viewTarget.source_id}</span>
              {viewTarget.sitting && <span>· {viewTarget.sitting}</span>}
            </div>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Question</h3>
              <RichText text={viewTarget.question_text} />
            </section>
            {viewTarget.image_urls.length > 0 && (
              <section className="space-y-3">
                {viewTarget.image_urls.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer">
                    <img src={src} alt="diagram" className="max-h-96 rounded-lg border border-border bg-white" />
                  </a>
                ))}
              </section>
            )}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Model answer</h3>
              {viewTarget.worked_solution ? (
                <div className="rounded-lg border border-border bg-surface2 p-4"><RichText text={viewTarget.worked_solution} /></div>
              ) : (
                <p className="text-sm text-red-400">No model answer yet.</p>
              )}
            </section>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex gap-2">
              <Pill on={viewTarget.reviewed} onLabel="Checked" offLabel="Waiting" onClick={() => toggle(viewTarget, "reviewed")} title="Mark as checked or not" />
              <Pill on={viewTarget.is_active} onLabel="On" offLabel="Off" onClick={() => toggle(viewTarget, "is_active")} title="Turn on or off" />
            </div>
            <button onClick={() => openEdit(viewTarget)} className="rounded-lg bg-accent-dark px-4 py-2 text-sm font-medium text-white">Edit</button>
          </div>
        </Modal>
      )}

      {/* Edit */}
      {editTarget && (
        <Modal title={`Edit theory question #${editTarget.id}`} onClose={() => setEditTarget(null)} wide>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Question</label>
              <textarea
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-white focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">Model answer</label>
              <textarea
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
                rows={14}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-white focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-muted hover:text-white">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !editQuestion.trim()}
                className="flex items-center gap-2 rounded-lg bg-accent-dark px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {saving ? <><Spinner size="sm" /> Saving...</> : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
