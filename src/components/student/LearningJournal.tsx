"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type JournalEntry = {
  id: string;
  title: string;
  body: string;
  course_title: string | null;
  entry_type: "reflection" | "lesson_note" | "question" | "goal";
  created_at: string;
  updated_at: string;
};

const TYPES: { value: JournalEntry["entry_type"]; label: string }[] = [
  { value: "reflection", label: "Learning reflection" },
  { value: "lesson_note", label: "Lesson notes" },
  { value: "question", label: "Question to revisit" },
  { value: "goal", label: "Learning goal" },
];

export default function LearningJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [entryType, setEntryType] = useState<JournalEntry["entry_type"]>("reflection");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student/learning-journal", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load journal entries.");
      setEntries(payload.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load journal entries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  function resetForm() {
    setTitle(""); setBody(""); setCourseTitle(""); setEntryType("reflection"); setEditingId(null);
  }

  function editEntry(entry: JournalEntry) {
    setEditingId(entry.id); setTitle(entry.title); setBody(entry.body);
    setCourseTitle(entry.course_title ?? ""); setEntryType(entry.entry_type);
    setMessage(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/student/learning-journal", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, title: title.trim(), body: body.trim(), course_title: courseTitle.trim() || null, entry_type: entryType }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save entry.");
      resetForm(); setMessage(editingId ? "Journal entry updated." : "Journal entry saved.");
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry.");
    } finally { setSaving(false); }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this journal entry? This cannot be undone.")) return;
    setError(""); setMessage("");
    try {
      const response = await fetch(`/api/student/learning-journal?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not delete entry.");
      setEntries((current) => current.filter((entry) => entry.id !== id));
      if (editingId === id) resetForm();
      setMessage("Journal entry deleted.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete entry."); }
  }

  const visibleEntries = entries.filter((entry) => filter === "all" || entry.entry_type === filter);
  const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <main className="lj-wrap">
      <style jsx>{`
        .lj-wrap{max-width:1100px;margin:0 auto;padding:24px 16px 48px;color:#10243e}.lj-hero{background:linear-gradient(120deg,#0b1e3a,#123b60);color:white;border-radius:20px;padding:28px;margin-bottom:20px}.lj-kicker{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7be4f3}.lj-hero h1{font-size:clamp(26px,4vw,36px);margin:8px 0}.lj-hero p{max-width:680px;color:#d8e8f4;margin:0;line-height:1.6}.lj-grid{display:grid;grid-template-columns:minmax(0, .95fr) minmax(0, 1.2fr);gap:18px;align-items:start}.lj-card{background:white;border:1px solid #dce5ef;border-radius:16px;padding:20px;box-shadow:0 8px 24px #0b1e3a0a}.lj-card h2{margin:0 0 14px;font-size:19px}.lj-field{display:grid;gap:6px;margin-bottom:13px}.lj-field label{font-size:13px;font-weight:750;color:#344963}.lj-field input,.lj-field select,.lj-field textarea,.lj-filter{width:100%;box-sizing:border-box;border:1px solid #cbd8e6;border-radius:9px;padding:11px 12px;font:inherit;color:#10243e;background:#fff}.lj-field textarea{min-height:150px;resize:vertical;line-height:1.55}.lj-btn{border:0;border-radius:9px;padding:10px 14px;font-weight:750;cursor:pointer}.lj-primary{background:#00b4d8;color:#06263d}.lj-secondary{background:#eaf2f8;color:#173451}.lj-danger{background:#fff0ef;color:#9b2626}.lj-actions{display:flex;flex-wrap:wrap;gap:8px}.lj-notice{padding:10px 12px;border-radius:9px;margin:0 0 12px;font-size:14px}.lj-error{background:#fff0ef;color:#9b2626}.lj-message{background:#e8faf5;color:#17664f}.lj-toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px}.lj-toolbar h2{margin:0}.lj-filter{max-width:210px}.lj-entry{border:1px solid #dce5ef;border-radius:12px;padding:15px;margin-bottom:11px}.lj-entryhead{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}.lj-entry h3{margin:0 0 5px;font-size:16px;overflow-wrap:anywhere}.lj-meta{font-size:12px;color:#63768a;display:flex;gap:8px;flex-wrap:wrap}.lj-tag{display:inline-block;background:#e7f8fc;color:#075a70;padding:4px 7px;border-radius:999px;font-size:11px;font-weight:800}.lj-body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;color:#344963;margin:12px 0 14px}.lj-empty{border:1px dashed #cbd8e6;border-radius:12px;padding:28px 16px;text-align:center;color:#63768a;line-height:1.6}.lj-count{font-size:13px;color:#63768a}@media(max-width:760px){.lj-grid{grid-template-columns:1fr}.lj-hero{padding:22px}.lj-card{padding:16px}.lj-toolbar{align-items:flex-start;flex-direction:column}.lj-filter{max-width:none}}
      `}</style>
      <section className="lj-hero"><div className="lj-kicker">RuffNeck Learn · Personal learning</div><h1>Learning Journal</h1><p>Capture lesson notes, reflect on what you have learned, save questions to revisit, and keep your learning goals in one private place.</p></section>
      <div className="lj-grid">
        <section className="lj-card">
          <h2>{editingId ? "Edit journal entry" : "Write an entry"}</h2>
          {error && <p className="lj-notice lj-error" role="alert">{error}</p>}
          {message && <p className="lj-notice lj-message" role="status">{message}</p>}
          <form onSubmit={submitEntry}>
            <div className="lj-field"><label htmlFor="lj-title">Title</label><input id="lj-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required placeholder="What did you learn today?" /></div>
            <div className="lj-field"><label htmlFor="lj-type">Entry type</label><select id="lj-type" value={entryType} onChange={(e) => setEntryType(e.target.value as JournalEntry["entry_type"])}>{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
            <div className="lj-field"><label htmlFor="lj-course">Related course (optional)</label><input id="lj-course" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} maxLength={160} placeholder="e.g. AI Literacy" /></div>
            <div className="lj-field"><label htmlFor="lj-body">Notes</label><textarea id="lj-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={12000} required placeholder="Record key ideas, practical examples, questions, or your next step…" /></div>
            <div className="lj-actions"><button className="lj-btn lj-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Update entry" : "Save entry"}</button>{editingId && <button className="lj-btn lj-secondary" type="button" onClick={resetForm}>Cancel edit</button>}</div>
          </form>
        </section>
        <section className="lj-card">
          <div className="lj-toolbar"><div><h2>Your journal</h2><div className="lj-count">{entries.length} {entries.length === 1 ? "entry" : "entries"}</div></div><select className="lj-filter" aria-label="Filter journal entries" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All entries</option>{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
          {loading ? <div className="lj-empty">Loading your journal…</div> : visibleEntries.length === 0 ? <div className="lj-empty">{entries.length ? "No entries match this filter." : "Your journal is empty. Save your first reflection, lesson note, question, or goal."}</div> : visibleEntries.map((entry) => <article className="lj-entry" key={entry.id}><div className="lj-entryhead"><div><h3>{entry.title}</h3><div className="lj-meta"><span>{dateLabel(entry.updated_at)}</span>{entry.course_title && <span>· {entry.course_title}</span>}</div></div><span className="lj-tag">{TYPES.find((type) => type.value === entry.entry_type)?.label ?? entry.entry_type}</span></div><p className="lj-body">{entry.body}</p><div className="lj-actions"><button className="lj-btn lj-secondary" type="button" onClick={() => editEntry(entry)}>Edit</button><button className="lj-btn lj-danger" type="button" onClick={() => void deleteEntry(entry.id)}>Delete</button></div></article>)}
        </section>
      </div>
    </main>
  );
}
