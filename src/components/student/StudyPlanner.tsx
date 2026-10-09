"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type StudySession = {
  id: string;
  title: string;
  notes: string | null;
  planned_for: string;
  duration_minutes: number;
  status: "planned" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
};

type ApiResult = { sessions?: StudySession[]; session?: StudySession; success?: boolean; error?: string };
const emptyForm = () => ({ title: "", notes: "", planned_for: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)), duration_minutes: "30" });
function toLocalInput(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function dateLabel(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "Date not available" : d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }

export default function StudyPlanner() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"upcoming" | "all" | "completed">("upcoming");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/student/study-planner", { cache: "no-store" });
      const result = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(result.error || "Could not load your study plan.");
      setSessions(result.sessions ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load your study plan."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: sessions.filter(s => s.status === "planned" && new Date(s.planned_for).getTime() >= now).length,
      completed: sessions.filter(s => s.status === "completed").length,
      minutes: sessions.filter(s => s.status === "completed").reduce((sum, s) => sum + s.duration_minutes, 0),
    };
  }, [sessions]);

  const visible = useMemo(() => {
    const now = Date.now();
    return sessions.filter(s => filter === "all" || (filter === "completed" ? s.status === "completed" : s.status === "planned" && new Date(s.planned_for).getTime() >= now))
      .sort((a, b) => filter === "completed" ? new Date(b.planned_for).getTime() - new Date(a.planned_for).getTime() : new Date(a.planned_for).getTime() - new Date(b.planned_for).getTime());
  }, [sessions, filter]);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/student/study-planner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, duration_minutes: Number(form.duration_minutes), planned_for: new Date(form.planned_for).toISOString() }) });
      const result = (await response.json()) as ApiResult;
      if (!response.ok || !result.session) throw new Error(result.error || "Could not save this session.");
      setSessions(current => [...current, result.session!]); setForm(emptyForm()); setShowForm(false); setNotice("Study session added to your plan.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save this session."); }
    finally { setSaving(false); }
  }

  async function updateSession(session: StudySession, status: StudySession["status"]) {
    setBusyId(session.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/student/study-planner", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: session.id, status }) });
      const result = (await response.json()) as ApiResult;
      if (!response.ok || !result.session) throw new Error(result.error || "Could not update this session.");
      setSessions(current => current.map(s => s.id === session.id ? result.session! : s)); setNotice(status === "completed" ? "Session marked as completed." : "Session updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update this session."); }
    finally { setBusyId(null); }
  }

  async function deleteSession(session: StudySession) {
    if (!window.confirm(`Remove “${session.title}” from your study plan?`)) return;
    setBusyId(session.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/student/study-planner?id=${encodeURIComponent(session.id)}`, { method: "DELETE" });
      const result = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(result.error || "Could not remove this session.");
      setSessions(current => current.filter(s => s.id !== session.id)); setNotice("Study session removed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove this session."); }
    finally { setBusyId(null); }
  }

  return <main className="sp-page">
    <style>{`
      .sp-page{max-width:1120px;margin:0 auto;padding:28px 18px 56px;color:#eaf2ff}.sp-hero{position:relative;overflow:hidden;border:1px solid #24476a;border-radius:24px;padding:28px;background:linear-gradient(120deg,#0b1e3a,#103858 68%,#07546a)}.sp-eyebrow{font-size:12px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#67e8f9}.sp-hero h1{font-size:clamp(28px,4vw,42px);margin:10px 0}.sp-hero p{max-width:660px;color:#c5d5e8;line-height:1.65;margin:0}.sp-btn{border:0;border-radius:11px;padding:11px 15px;font-weight:750;cursor:pointer;background:#00b4d8;color:#04192a}.sp-btn:disabled{opacity:.55;cursor:wait}.sp-btn.alt{background:#173957;color:#eaf2ff;border:1px solid #355c7c}.sp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}.sp-stat,.sp-panel{border:1px solid #203d5b;background:#0c2038;border-radius:17px;padding:18px}.sp-stat strong{display:block;font-size:27px;margin-bottom:3px}.sp-muted{font-size:13px;color:#9db3ca}.sp-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin:24px 0 14px}.sp-tabs{display:flex;gap:6px;flex-wrap:wrap}.sp-tab{border:1px solid #2a4a69;background:#0b1e3a;color:#bfd0e3;border-radius:10px;padding:9px 12px;cursor:pointer}.sp-tab[aria-pressed=true]{background:#123b55;color:#67e8f9;border-color:#00b4d8}.sp-list{display:grid;gap:10px}.sp-item{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border:1px solid #203d5b;background:#0c2038;border-radius:16px;padding:17px}.sp-item h3{margin:0 0 7px;font-size:17px}.sp-date{color:#67e8f9;font-size:13px;font-weight:700}.sp-notes{color:#b5c7db;line-height:1.55;white-space:pre-wrap;margin:9px 0 0;font-size:14px}.sp-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.sp-smallbtn{background:#102c47;border:1px solid #2a4b6a;color:#d9e7f7;border-radius:9px;padding:8px 10px;cursor:pointer}.sp-smallbtn.done{color:#6ee7b7;border-color:#256a5c}.sp-smallbtn.remove{color:#fca5a5}.sp-status{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:5px 8px;background:#183b52;color:#9feafa;display:inline-block;margin-top:9px}.sp-status.completed{background:#123d32;color:#6ee7b7}.sp-status.cancelled{background:#392a32;color:#fda4af}.sp-form{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:14px}.sp-field{display:grid;gap:6px}.sp-field.full{grid-column:1/-1}.sp-field label{font-size:13px;color:#c5d5e8;font-weight:700}.sp-field input,.sp-field textarea,.sp-field select{width:100%;box-sizing:border-box;border:1px solid #35516d;border-radius:10px;background:#081a2d;color:#f1f7ff;padding:11px;font:inherit}.sp-field textarea{min-height:82px;resize:vertical}.sp-formactions{grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end}.sp-alert{padding:12px 14px;border-radius:11px;margin:12px 0;background:#132e47;color:#cfe9ff}.sp-alert.error{background:#40212a;color:#fecdd3}.sp-empty{text-align:center;padding:38px 20px;color:#afc2d7}.sp-empty strong{display:block;color:#eaf2ff;font-size:18px;margin-bottom:6px}.sp-toplink{display:inline-block;color:#8deafa;text-decoration:none;margin-top:18px;font-size:14px}.sp-toplink:hover{text-decoration:underline}@media(max-width:640px){.sp-page{padding:16px 12px 36px}.sp-hero{padding:21px}.sp-stats{gap:8px}.sp-stat{padding:12px}.sp-stat strong{font-size:22px}.sp-item{display:block}.sp-actions{justify-content:flex-start;margin-top:14px}.sp-form{grid-template-columns:1fr}.sp-field.full,.sp-formactions{grid-column:auto}.sp-formactions{justify-content:stretch}.sp-formactions button{flex:1}}
    `}</style>
    <section className="sp-hero"><div className="sp-eyebrow">Your learning, planned</div><h1>Study Planner</h1><p>Turn your learning goals into manageable sessions. Schedule study time, track completed sessions, and build a consistent learning routine.</p><div style={{ marginTop: 20 }}><button className="sp-btn" onClick={() => { setShowForm(v => !v); setError(""); }}>{showForm ? "Close form" : "+ Plan a study session"}</button></div></section>
    <section className="sp-stats" aria-label="Study plan summary"><div className="sp-stat"><strong>{stats.upcoming}</strong><span className="sp-muted">Upcoming sessions</span></div><div className="sp-stat"><strong>{stats.completed}</strong><span className="sp-muted">Sessions completed</span></div><div className="sp-stat"><strong>{Math.floor(stats.minutes / 60)}h {stats.minutes % 60}m</strong><span className="sp-muted">Time invested</span></div></section>
    {error && <div className="sp-alert error" role="alert">{error}</div>}{notice && <div className="sp-alert" role="status">{notice}</div>}
    {showForm && <section className="sp-panel"><h2 style={{ margin: 0 }}>Plan a session</h2><p className="sp-muted">Choose a realistic time and a specific learning goal.</p><form className="sp-form" onSubmit={createSession}><div className="sp-field full"><label htmlFor="sp-title">Session title *</label><input id="sp-title" required maxLength={120} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Practise Excel formulas" /></div><div className="sp-field"><label htmlFor="sp-date">Date and time *</label><input id="sp-date" type="datetime-local" required value={form.planned_for} onChange={e => setForm(f => ({ ...f, planned_for: e.target.value }))} /></div><div className="sp-field"><label htmlFor="sp-duration">Duration *</label><select id="sp-duration" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1 hour 30 minutes</option><option value="120">2 hours</option></select></div><div className="sp-field full"><label htmlFor="sp-notes">Notes (optional)</label><textarea id="sp-notes" maxLength={1000} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What do you want to complete in this session?" /></div><div className="sp-formactions"><button className="sp-btn alt" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="sp-btn" disabled={saving} type="submit">{saving ? "Saving…" : "Save session"}</button></div></form></section>}
    <div className="sp-toolbar"><h2 style={{ margin: 0, fontSize: 21 }}>Your study sessions</h2><div className="sp-tabs" role="group" aria-label="Filter study sessions">{([{ id: "upcoming", label: "Upcoming" }, { id: "all", label: "All sessions" }, { id: "completed", label: "Completed" }] as const).map(item => <button key={item.id} className="sp-tab" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div></div>
    {loading ? <div className="sp-panel sp-empty">Loading your study plan…</div> : visible.length ? <div className="sp-list">{visible.map(session => <article className="sp-item" key={session.id}><div style={{ minWidth: 0, flex: 1 }}><div className="sp-date">{dateLabel(session.planned_for)} · {session.duration_minutes} min</div><h3 style={{ marginTop: 8 }}>{session.title}</h3>{session.notes && <p className="sp-notes">{session.notes}</p>}<span className={`sp-status ${session.status}`}>{session.status}</span></div><div className="sp-actions">{session.status === "planned" && <button className="sp-smallbtn done" disabled={busyId === session.id} onClick={() => void updateSession(session, "completed")}>✓ Complete</button>}{session.status === "planned" && <button className="sp-smallbtn" disabled={busyId === session.id} onClick={() => void updateSession(session, "cancelled")}>Cancel session</button>}<button className="sp-smallbtn remove" disabled={busyId === session.id} onClick={() => void deleteSession(session)}>Remove</button></div></article>)}</div> : <div className="sp-panel sp-empty"><strong>{filter === "completed" ? "No completed sessions yet" : filter === "upcoming" ? "No upcoming sessions" : "Your study plan is empty"}</strong>{filter === "completed" ? "Mark a session as complete when you finish it." : "Create a study session to give your next learning goal a time and place."}<div style={{ marginTop: 14 }}><button className="sp-btn" onClick={() => { setShowForm(true); setFilter("all"); }}>+ Plan a session</button></div></div>}
    <Link className="sp-toplink" href="/student">← Back to learner dashboard</Link>
  </main>;
}
