import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getQuestions, updateQuestion, deleteQuestion } from '../api';
import type { Question, PaginatedResponse } from '../types';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

const ALL_SUBJECTS: { code: string; label: string }[] = [
  { code: 'english',          label: 'English Language' },
  { code: 'math',             label: 'Mathematics' },
  { code: 'biology',          label: 'Biology' },
  { code: 'chemistry',        label: 'Chemistry' },
  { code: 'physics',          label: 'Physics' },
  { code: 'economics',        label: 'Economics' },
  { code: 'government',       label: 'Government' },
  { code: 'literature',       label: 'Literature In English' },
  { code: 'geography',        label: 'Geography' },
  { code: 'accounts',         label: 'Accounts' },
  { code: 'crk',              label: 'Christian Religious Knowledge' },
  { code: 'commerce',         label: 'Commerce' },
  { code: 'agric',            label: 'Agricultural Science' },
  { code: 'irk',              label: 'Islamic Religious Knowledge' },
  { code: 'computer',         label: 'Computer Studies' },
  { code: 'history',          label: 'History' },
  { code: 'further-math',     label: 'Further Mathematics' },
  { code: 'civic-education',  label: 'Civic Education' },
  { code: 'yoruba',           label: 'Yoruba' },
  { code: 'marketing',        label: 'Marketing' },
  { code: 'data-processing',  label: 'Data Processing' },
  { code: 'hausa',            label: 'Hausa' },
  { code: 'home-economics',   label: 'Home Economics' },
  { code: 'catering',         label: 'Catering Craft Practice' },
  { code: 'pe',               label: 'Physical Education' },
  { code: 'animal-husbandry', label: 'Animal Husbandry' },
  { code: 'igbo',             label: 'Igbo' },
  { code: 'french',           label: 'French' },
  { code: 'office-practice',  label: 'Office Practice' },
  { code: 'insurance',        label: 'Insurance' },
  { code: 'fine-arts',        label: 'Fine Arts' },
  { code: 'music',            label: 'Music' },
  { code: 'arabic',           label: 'Arabic' },
  { code: 'book-keeping',     label: 'Book Keeping' },
];

const YEARS = Array.from({ length: 16 }, (_, i) => 2025 - i);

interface EditState {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_option: 'A' | 'B' | 'C' | 'D' | 'E';
  explanation: string;
}

export default function Questions() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive filter values from URL — these are the source of truth
  const subject  = searchParams.get('subject') ?? '';
  const examType = searchParams.get('exam')    ?? '';
  const year     = searchParams.get('year')    ?? '';
  const search   = searchParams.get('q')       ?? '';
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const [result, setResult]       = useState<PaginatedResponse<Question> | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [editTarget, setEditTarget]   = useState<Question | null>(null);
  const [editState, setEditState]     = useState<EditState | null>(null);
  const [saving, setSaving]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [deleting, setDeleting]     = useState(false);

  // Update a single filter key; resets page to 1 unless changing the page itself
  function setFilter(key: string, value: string, keepPage = false) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value); else next.delete(key);
        if (!keepPage) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getQuestions({
        page,
        limit: 50,
        subject:   subject   || undefined,
        exam_type: examType  || undefined,
        year:      year      ? parseInt(year) : undefined,
        search:    search    || undefined,
      });
      setResult(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [page, subject, examType, year, search]);

  useEffect(() => { load(); }, [load]);

  function openEdit(q: Question) {
    setEditTarget(q);
    setEditState({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      option_e: q.option_e || '',
      correct_option: q.correct_option,
      explanation: q.explanation || '',
    });
  }

  async function handleSave() {
    if (!editTarget || !editState) return;
    setSaving(true);
    try {
      await updateQuestion(editTarget.id, {
        ...editState,
        option_e:    editState.option_e    || undefined,
        explanation: editState.explanation || undefined,
      });
      setEditTarget(null);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
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
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-display text-white">Questions</h1>
        <p className="text-sm text-muted mt-0.5">Browse, edit and manage exam questions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={subject}
          onChange={(e) => setFilter('subject', e.target.value)}
          className="bg-surface border border-border text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
        >
          <option value="">All Subjects</option>
          {ALL_SUBJECTS.map((s) => (
            <option key={s.code} value={s.code}>{s.label}</option>
          ))}
        </select>

        <select
          value={examType}
          onChange={(e) => setFilter('exam', e.target.value)}
          className="bg-surface border border-border text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
        >
          <option value="">All Exams</option>
          <option value="WAEC">WAEC</option>
          <option value="JAMB">JAMB</option>
          <option value="NECO">NECO</option>
        </select>

        <select
          value={year}
          onChange={(e) => setFilter('year', e.target.value)}
          className="bg-surface border border-border text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
        >
          <option value="">All Years</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search question text..."
          value={search}
          onChange={(e) => setFilter('q', e.target.value)}
          className="flex-1 min-w-48 bg-surface border border-border text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-accent placeholder-muted"
        />

        <button
          onClick={load}
          className="px-4 py-2 bg-surface2 border border-border text-sm text-white rounded-lg hover:bg-border transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
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
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider w-16">ID</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Question</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Subject</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Exam</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Year</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Ans</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Exp</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Flags</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result?.data.map((q) => (
                    <tr key={q.id} className="hover:bg-surface2 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted">{q.id}</td>
                      <td className="px-4 py-3 text-white max-w-xs">
                        <span title={q.question_text}>
                          {q.question_text.length > 80
                            ? q.question_text.slice(0, 80) + '…'
                            : q.question_text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{q.subject}</td>
                      <td className="px-4 py-3">
                        <Badge variant={q.exam_type === 'WAEC' ? 'green' : q.exam_type === 'JAMB' ? 'blue' : 'amber'}>
                          {q.exam_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted font-mono text-xs">{q.year}</td>
                      <td className="px-4 py-3 text-white font-bold">{q.correct_option}</td>
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
                          <span className="text-muted text-xs">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(q)}
                            className="text-xs px-2.5 py-1 bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(q)}
                            className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors"
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
                <div className="text-center py-10 text-muted text-sm">No questions found</div>
              )}
            </div>

            {/* Pagination */}
            {result && result.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted">
                  {result.total.toLocaleString()} questions · page {result.page} of {result.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilter('page', String(page - 1), true)}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs bg-surface2 border border-border text-white rounded hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilter('page', String(page + 1), true)}
                    disabled={page === result.pages}
                    className="px-3 py-1.5 text-xs bg-surface2 border border-border text-white rounded hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider font-medium">Question Text</label>
              <textarea
                rows={4}
                value={editState.question_text}
                onChange={(e) => setEditState({ ...editState, question_text: e.target.value })}
                className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['option_a', 'option_b', 'option_c', 'option_d'] as const).map((opt) => (
                <div key={opt}>
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider font-medium">
                    Option {opt.split('_')[1].toUpperCase()}
                  </label>
                  <input
                    type="text"
                    value={editState[opt]}
                    onChange={(e) => setEditState({ ...editState, [opt]: e.target.value })}
                    className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider font-medium">Option E (optional)</label>
                <input
                  type="text"
                  value={editState.option_e}
                  onChange={(e) => setEditState({ ...editState, option_e: e.target.value })}
                  className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider font-medium">Correct Option</label>
                <select
                  value={editState.correct_option}
                  onChange={(e) => setEditState({ ...editState, correct_option: e.target.value as 'A' | 'B' | 'C' | 'D' | 'E' })}
                  className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent"
                >
                  {['A', 'B', 'C', 'D', 'E'].map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider font-medium">Explanation</label>
              <textarea
                rows={4}
                value={editState.explanation}
                onChange={(e) => setEditState({ ...editState, explanation: e.target.value })}
                className="w-full bg-bg border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent resize-y"
                placeholder="Add an explanation for this question..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm bg-surface2 border border-border text-white rounded-lg hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center gap-2"
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
            <p className="text-sm text-muted bg-surface2 border border-border rounded-lg p-3">
              {deleteTarget.question_text.slice(0, 120)}…
            </p>
            <p className="text-xs text-red-400">This action cannot be undone.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm bg-surface2 border border-border text-white rounded-lg hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
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
