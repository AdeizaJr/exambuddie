import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getQuestions, updateQuestion, deleteQuestion } from "../api";
import type { Question, PaginatedResponse } from "../types";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import Badge from "../components/Badge";

const ALL_SUBJECTS: { code: string; label: string }[] = [
  { code: "english", label: "English Language" },
  { code: "math", label: "Mathematics" },
  { code: "biology", label: "Biology" },
  { code: "chemistry", label: "Chemistry" },
  { code: "physics", label: "Physics" },
  { code: "economics", label: "Economics" },
  { code: "government", label: "Government" },
  { code: "literature", label: "Literature In English" },
  { code: "geography", label: "Geography" },
  { code: "accounts", label: "Accounts" },
  { code: "crk", label: "Christian Religious Knowledge" },
  { code: "commerce", label: "Commerce" },
  { code: "agric", label: "Agricultural Science" },
  { code: "irk", label: "Islamic Religious Knowledge" },
  { code: "computer", label: "Computer Studies" },
  { code: "history", label: "History" },
  { code: "further-math", label: "Further Mathematics" },
  { code: "civic-education", label: "Civic Education" },
  { code: "yoruba", label: "Yoruba" },
  { code: "marketing", label: "Marketing" },
  { code: "data-processing", label: "Data Processing" },
  { code: "hausa", label: "Hausa" },
  { code: "home-economics", label: "Home Economics" },
  { code: "catering", label: "Catering Craft Practice" },
  { code: "pe", label: "Physical Education" },
  { code: "animal-husbandry", label: "Animal Husbandry" },
  { code: "igbo", label: "Igbo" },
  { code: "french", label: "French" },
  { code: "office-practice", label: "Office Practice" },
  { code: "insurance", label: "Insurance" },
  { code: "fine-arts", label: "Fine Arts" },
  { code: "music", label: "Music" },
  { code: "arabic", label: "Arabic" },
  { code: "book-keeping", label: "Book Keeping" },
];

const YEARS = Array.from({ length: 16 }, (_, i) => 2025 - i);

interface EditState {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_option: "A" | "B" | "C" | "D" | "E";
  explanation: string;
}

export default function Questions() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive filter values from URL — these are the source of truth
  const subject = searchParams.get("subject") ?? "";
  const examType = searchParams.get("exam") ?? "";
  const year = searchParams.get("year") ?? "";
  const search = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const [result, setResult] = useState<PaginatedResponse<Question> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Question | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Update a single filter key; resets page to 1 unless changing the page itself
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
      const data = await getQuestions({
        page,
        limit: 50,
        subject: subject || undefined,
        exam_type: examType || undefined,
        year: year ? parseInt(year) : undefined,
        search: search || undefined,
      });
      setResult(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [page, subject, examType, year, search]);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit(q: Question) {
    setEditTarget(q);
    setEditState({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      option_e: q.option_e || "",
      correct_option: q.correct_option,
      explanation: q.explanation || "",
    });
  }

  async function handleSave() {
    if (!editTarget || !editState) return;
    setSaving(true);
    try {
      await updateQuestion(editTarget.id, {
        ...editState,
        option_e: editState.option_e || undefined,
        explanation: editState.explanation || undefined,
      });
      setEditTarget(null);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuestion(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Questions</h1>
        <p className="mt-0.5 text-sm text-muted">Browse, edit and manage exam questions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={subject}
          onChange={(e) => setFilter("subject", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        >
          <option value="">All Subjects</option>
          {ALL_SUBJECTS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={examType}
          onChange={(e) => setFilter("exam", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        >
          <option value="">All Exams</option>
          <option value="WAEC">WAEC</option>
          <option value="JAMB">JAMB</option>
          <option value="NECO">NECO</option>
        </select>

        <select
          value={year}
          onChange={(e) => setFilter("year", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        >
          <option value="">All Years</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search question text..."
          value={search}
          onChange={(e) => setFilter("q", e.target.value)}
          className="min-w-48 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
        />

        <button
          onClick={load}
          className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6 text-red-400">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="w-16 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Question
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Exam
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Ans
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Exp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Flags
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result?.data.map((q) => (
                    <tr key={q.id} className="transition-colors hover:bg-surface2">
                      <td className="px-4 py-3 font-mono text-xs text-muted">{q.id}</td>
                      <td className="max-w-xs px-4 py-3 text-white">
                        <span title={q.question_text}>
                          {q.question_text.length > 80
                            ? q.question_text.slice(0, 80) + "…"
                            : q.question_text}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{q.subject}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            q.exam_type === "WAEC"
                              ? "green"
                              : q.exam_type === "JAMB"
                                ? "blue"
                                : "amber"
                          }
                        >
                          {q.exam_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{q.year}</td>
                      <td className="px-4 py-3 font-bold text-white">{q.correct_option}</td>
                      <td className="px-4 py-3">
                        {q.explanation ? (
                          <span className="text-accent">✓</span>
                        ) : (
                          <span className="text-muted">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {q.flag_count > 0 ? (
                          <Badge variant="red">{q.flag_count}</Badge>
                        ) : (
                          <span className="text-xs text-muted">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(q)}
                            className="rounded border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/20"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(q)}
                            className="rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result?.data.length === 0 && (
                <div className="py-10 text-center text-sm text-muted">No questions found</div>
              )}
            </div>

            {/* Pagination */}
            {result && result.pages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-muted">
                  {result.total.toLocaleString()} questions · page {result.page} of {result.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilter("page", String(page - 1), true)}
                    disabled={page === 1}
                    className="rounded border border-border bg-surface2 px-3 py-1.5 text-xs text-white transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilter("page", String(page + 1), true)}
                    disabled={page === result.pages}
                    className="rounded border border-border bg-surface2 px-3 py-1.5 text-xs text-white transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editTarget && editState && (
        <Modal title={`Edit Question #${editTarget.id}`} onClose={() => setEditTarget(null)} wide>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Question Text
              </label>
              <textarea
                rows={4}
                value={editState.question_text}
                onChange={(e) => setEditState({ ...editState, question_text: e.target.value })}
                className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(["option_a", "option_b", "option_c", "option_d"] as const).map((opt) => (
                <div key={opt}>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                    Option {opt.split("_")[1].toUpperCase()}
                  </label>
                  <input
                    type="text"
                    value={editState[opt]}
                    onChange={(e) => setEditState({ ...editState, [opt]: e.target.value })}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                  Option E (optional)
                </label>
                <input
                  type="text"
                  value={editState.option_e}
                  onChange={(e) => setEditState({ ...editState, option_e: e.target.value })}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                  Correct Option
                </label>
                <select
                  value={editState.correct_option}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      correct_option: e.target.value as "A" | "B" | "C" | "D" | "E",
                    })
                  }
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                >
                  {["A", "B", "C", "D", "E"].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Explanation
              </label>
              <textarea
                rows={4}
                value={editState.explanation}
                onChange={(e) => setEditState({ ...editState, explanation: e.target.value })}
                className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                placeholder="Add an explanation for this question..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditTarget(null)}
                className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
              >
                {saving && <Spinner size="sm" />}
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal title="Confirm Delete" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-white">
              Are you sure you want to delete question <strong>#{deleteTarget.id}</strong>?
            </p>
            <p className="rounded-lg border border-border bg-surface2 p-3 text-sm text-muted">
              {deleteTarget.question_text.slice(0, 120)}…
            </p>
            <p className="text-xs text-red-400">This action cannot be undone.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border bg-surface2 px-4 py-2 text-sm text-white transition-colors hover:bg-border"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {deleting && <Spinner size="sm" />}
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
