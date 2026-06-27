import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getQuestions, updateQuestion, deleteQuestion, uploadQuestionImage, deleteQuestionImage, toggleQuestionActive, generateExplanation, bulkImportQuestions } from "../api";
import type { Question, PaginatedResponse, BulkImportResult } from "../types";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import Badge from "../components/Badge";

const ALL_SUBJECTS: { code: string; label: string }[] = [
  { code: "accounts",         label: "Accounts" },
  { code: "agric",            label: "Agricultural Science" },
  { code: "animal-husbandry", label: "Animal Husbandry" },
  { code: "arabic",           label: "Arabic" },
  { code: "biology",          label: "Biology" },
  { code: "book-keeping",     label: "Book Keeping" },
  { code: "catering",         label: "Catering Craft Practice" },
  { code: "chemistry",        label: "Chemistry" },
  { code: "crk",              label: "Christian Religious Knowledge" },
  { code: "civic-education",  label: "Civic Education" },
  { code: "commerce",         label: "Commerce" },
  { code: "computer",         label: "Computer Studies" },
  { code: "data-processing",  label: "Data Processing" },
  { code: "economics",        label: "Economics" },
  { code: "english",          label: "English Language" },
  { code: "fine-arts",        label: "Fine Arts" },
  { code: "french",           label: "French" },
  { code: "further-math",     label: "Further Mathematics" },
  { code: "geography",        label: "Geography" },
  { code: "government",       label: "Government" },
  { code: "hausa",            label: "Hausa" },
  { code: "history",          label: "History" },
  { code: "home-economics",   label: "Home Economics" },
  { code: "igbo",             label: "Igbo" },
  { code: "insurance",        label: "Insurance" },
  { code: "irk",              label: "Islamic Religious Knowledge" },
  { code: "literature",       label: "Literature In English" },
  { code: "marketing",        label: "Marketing" },
  { code: "math",             label: "Mathematics" },
  { code: "music",            label: "Music" },
  { code: "office-practice",  label: "Office Practice" },
  { code: "pe",               label: "Physical Education" },
  { code: "physics",          label: "Physics" },
  { code: "yoruba",           label: "Yoruba" },
];

const EXAM_TYPES = ["JAMB", "NECO", "WAEC"];

const YEARS = Array.from({ length: 16 }, (_, i) => 2010 + i);

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
  const hasDiagram = searchParams.get("has_diagram") ?? "";
  const missingExp = searchParams.get("missing_explanation") ?? "";
  const hasFlags = searchParams.get("has_flags") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const [result, setResult] = useState<PaginatedResponse<Question> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Question | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

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
        has_diagram: hasDiagram === "true" ? true : hasDiagram === "false" ? false : undefined,
        missing_explanation: missingExp === "true" ? true : undefined,
        has_flags: hasFlags === "true" ? true : undefined,
      });
      setResult(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [page, subject, examType, year, search, hasDiagram, missingExp, hasFlags]);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit(q: Question) {
    setEditTarget(q);
    setImageFile(null);
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

  async function handleImageUpload() {
    if (!editTarget || !imageFile) return;
    setImageUploading(true);
    try {
      const updated = await uploadQuestionImage(editTarget.id, imageFile);
      setEditTarget(updated);
      setImageFile(null);
      setResult((prev) =>
        prev ? { ...prev, data: prev.data.map((q) => (q.id === updated.id ? updated : q)) } : prev
      );
    } catch (e: any) {
      alert("Upload failed: " + e.message);
    } finally {
      setImageUploading(false);
    }
  }

  async function handleImageDelete() {
    if (!editTarget) return;
    if (!confirm("Remove this diagram image?")) return;
    await deleteQuestionImage(editTarget.id);
    const updated = { ...editTarget, image_url: undefined };
    setEditTarget(updated as Question);
    setResult((prev) =>
      prev ? { ...prev, data: prev.data.map((q) => (q.id === updated.id ? (updated as Question) : q)) } : prev
    );
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

  async function handleGenerate() {
    if (!editTarget || !editState) return;
    setGenerating(true);
    try {
      const { explanation } = await generateExplanation(editTarget.id);
      setEditState({ ...editState, explanation });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleActive(q: Question) {
    try {
      const updated = await toggleQuestionActive(q.id, !q.is_active);
      setResult(prev =>
        prev ? { ...prev, data: prev.data.map(row => row.id === q.id ? { ...row, is_active: updated.is_active } : row) } : prev
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Toggle failed");
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Questions</h1>
          <p className="mt-0.5 text-sm text-muted">Browse, edit and manage exam questions</p>
        </div>
        <button
          onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); }}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-white"
        >
          ⬆ Import CSV
        </button>
      </div>

      {showImport && (
        <Modal title="Bulk Import Questions" onClose={() => setShowImport(false)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface2 p-3 text-xs text-muted space-y-1">
              <p className="font-semibold text-white">Required CSV columns:</p>
              <p>exam_type, subject, year, question_text, option_a, option_b, option_c, option_d, correct_option</p>
              <p className="font-semibold text-white mt-2">Optional:</p>
              <p>option_e, topic, explanation</p>
              <p className="mt-2 text-amber-400">Max 500 rows per import. First row must be the header.</p>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-white"
            />
            {importResult && (
              <div className={`rounded-lg border p-3 text-sm ${importResult.skipped > 0 ? "border-amber-500/30 bg-amber-500/10" : "border-accent/30 bg-accent/10"}`}>
                <p className="font-medium text-white">Import complete</p>
                <p className="text-xs text-muted mt-1">✅ {importResult.inserted} inserted · ⚠ {importResult.skipped} skipped</p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {importResult.errors.map((e, i) => <p key={i} className="text-xs text-red-400">{e}</p>)}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-muted hover:text-white">Cancel</button>
              <button
                onClick={async () => {
                  if (!importFile) return;
                  setImporting(true);
                  try {
                    const text = await importFile.text();
                    const lines = text.trim().split('\n');
                    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
                    const rows = lines.slice(1).map((line) => {
                      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
                      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
                    });
                    const result = await bulkImportQuestions(rows);
                    setImportResult(result);
                    if (result.inserted > 0) load();
                  } catch (e: unknown) {
                    alert(e instanceof Error ? e.message : "Import failed");
                  } finally {
                    setImporting(false);
                  }
                }}
                disabled={!importFile || importing}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {importing ? <><Spinner size="sm" /> Importing...</> : "Import"}
              </button>
            </div>
          </div>
        </Modal>
      )}

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
          {EXAM_TYPES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
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

        <select
          value={hasDiagram}
          onChange={(e) => setFilter("has_diagram", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        >
          <option value="">All Questions</option>
          <option value="true">Has Diagram</option>
          <option value="false">No Diagram</option>
        </select>

        <select
          value={missingExp}
          onChange={(e) => setFilter("missing_explanation", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        >
          <option value="">All Explanations</option>
          <option value="true">Missing Explanation</option>
        </select>

        <select
          value={hasFlags}
          onChange={(e) => setFilter("has_flags", e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        >
          <option value="">All Flags</option>
          <option value="true">Has Flags</option>
        </select>

        <input
          type="text"
          placeholder="Search by ID, source ID, or question text..."
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
                      Active
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
                        {q.has_diagram && (
                          <span className="mr-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            🖼 diagram
                          </span>
                        )}
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
                        <button
                          onClick={() => handleToggleActive(q)}
                          title={q.is_active ? "Click to disable" : "Click to enable"}
                          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                            q.is_active
                              ? "bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20"
                              : "bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-green-500/15 hover:text-green-400 hover:border-green-500/20"
                          }`}
                        >
                          {q.is_active ? "On" : "Off"}
                        </button>
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
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-muted">
                  Explanation
                </label>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1 rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-400 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
                >
                  {generating ? <><Spinner size="sm" /> Generating…</> : "✨ Generate AI"}
                </button>
              </div>
              <textarea
                rows={4}
                value={editState.explanation}
                onChange={(e) => setEditState({ ...editState, explanation: e.target.value })}
                className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                placeholder="Add an explanation for this question..."
              />
            </div>

            {/* Diagram Image */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Diagram Image
              </label>
              {editTarget?.image_url && (
                <div className="mb-2 flex items-center gap-3">
                  <img
                    src={editTarget.image_url}
                    alt="diagram"
                    className="h-32 rounded border border-border object-contain bg-white"
                  />
                  <button
                    onClick={handleImageDelete}
                    className="text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-muted file:mr-2 file:rounded file:border-0 file:bg-surface2 file:px-3 file:py-1 file:text-xs file:text-white"
                />
                {imageFile && (
                  <button
                    onClick={handleImageUpload}
                    disabled={imageUploading}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-50"
                  >
                    {imageUploading ? "Uploading…" : "Upload"}
                  </button>
                )}
              </div>
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
