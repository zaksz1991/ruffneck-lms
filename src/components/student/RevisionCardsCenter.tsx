"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Card = {
  id: string; front: string; back: string; course_title: string | null; topic: string | null;
  due_at: string; last_reviewed_at: string | null; review_count: number; created_at: string; updated_at: string;
};
type Draft = { front: string; back: string; course_title: string; topic: string };
const EMPTY: Draft = { front: "", back: "", course_title: "", topic: "" };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
  return payload as T;
}

export default function RevisionCardsCenter() {
  const [cards, setCards] = useState<Card[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await request<{ cards: Card[] }>("/api/student/revision-cards"); setCards(result.cards); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load cards."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const dueCards = useMemo(() => cards.filter(card => new Date(card.due_at).getTime() <= Date.now()), [cards]);
  const visible = useMemo(() => cards.filter(card => {
    const matchesFilter = filter === "all" || (filter === "due" ? new Date(card.due_at).getTime() <= Date.now() : card.course_title === filter);
    const haystack = `${card.front} ${card.back} ${card.topic ?? ""} ${card.course_title ?? ""}`.toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase().trim());
  }), [cards, filter, search]);
  const activeCard = cards.find(card => card.id === active) ?? null;

  function beginEdit(card?: Card) {
    setEditing(card?.id ?? null);
    setDraft(card ? { front: card.front, back: card.back, course_title: card.course_title ?? "", topic: card.topic ?? "" } : EMPTY);
    setError(""); setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (editing) await request("/api/student/revision-cards", { method: "PATCH", body: JSON.stringify({ id: editing, ...draft }) });
      else await request("/api/student/revision-cards", { method: "POST", body: JSON.stringify(draft) });
      setDraft(EMPTY); setEditing(null); setNotice(editing ? "Revision card updated." : "Revision card created."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save card."); }
    finally { setSaving(false); }
  }

  async function review(rating: "again" | "hard" | "good" | "easy") {
    if (!activeCard) return;
    setError(""); setNotice("");
    try {
      await request("/api/student/revision-cards", { method: "PATCH", body: JSON.stringify({ id: activeCard.id, action: "review", rating }) });
      setNotice(rating === "again" ? "Card scheduled to return in about 10 minutes." : "Review saved. Your next review has been scheduled.");
      setActive(null); setFlipped(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save review."); }
  }

  async function remove(card: Card) {
    if (!window.confirm("Delete this revision card permanently?")) return;
    setError("");
    try { await request(`/api/student/revision-cards?id=${encodeURIComponent(card.id)}`, { method: "DELETE" }); if (active === card.id) setActive(null); setNotice("Revision card deleted."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not delete card."); }
  }

  function startStudy(dueOnly: boolean) {
    const pool = dueOnly ? dueCards : cards;
    if (!pool.length) { setNotice(dueOnly ? "No cards are due right now." : "Create a revision card to start studying."); return; }
    setActive(pool[0].id); setFlipped(false); setNotice("");
  }

  const courses = Array.from(new Set(cards.map(card => card.course_title).filter((value): value is string => Boolean(value))));

  return <main className="rc-page">
    <style jsx>{`
      .rc-page{--navy:#0b1e3a;--cyan:#00b4d8;--ink:#172b46;--muted:#64748b;max-width:1180px;margin:0 auto;padding:28px 18px 56px;color:var(--ink)}
      .rc-hero{background:linear-gradient(125deg,#0b1e3a,#123b62);border-radius:22px;padding:28px;color:#fff;display:flex;justify-content:space-between;gap:24px;align-items:center;flex-wrap:wrap}
      .rc-eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#7ce7f5;font-weight:800}.rc-hero h1{font-size:clamp(26px,4vw,38px);margin:8px 0}.rc-hero p{color:#d8e8f4;max-width:620px;line-height:1.6;margin:0}.rc-actions{display:flex;gap:10px;flex-wrap:wrap}
      .rc-btn{border:0;border-radius:11px;padding:11px 15px;font-weight:750;cursor:pointer;background:var(--cyan);color:#06223b}.rc-btn.secondary{background:#fff;color:var(--navy)}.rc-btn.ghost{background:#eaf6fa;color:#16425c}.rc-btn.danger{background:#fff0f0;color:#9f2525}.rc-btn:disabled{opacity:.55;cursor:not-allowed}
      .rc-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin:18px 0}.rc-stat,.rc-panel{background:#fff;border:1px solid #e2eaf1;border-radius:16px;padding:18px;box-shadow:0 5px 18px #0b1e3a08}.rc-stat span{display:block;color:var(--muted);font-size:13px}.rc-stat strong{display:block;font-size:27px;margin-top:7px;color:var(--navy)}.rc-grid{display:grid;grid-template-columns:minmax(280px,.82fr) minmax(0,1.5fr);gap:18px;align-items:start}.rc-panel h2{font-size:19px;margin:0 0 14px;color:var(--navy)}.rc-field{display:grid;gap:6px;margin-bottom:12px}.rc-field label{font-size:13px;font-weight:750}.rc-field input,.rc-field textarea,.rc-search{width:100%;box-sizing:border-box;border:1px solid #cbd8e4;border-radius:10px;padding:11px 12px;font:inherit;background:#fff;color:var(--ink)}.rc-field textarea{min-height:100px;resize:vertical}.rc-field input:focus,.rc-field textarea:focus,.rc-search:focus{outline:2px solid #8ce6f3;border-color:var(--cyan)}.rc-muted{color:var(--muted);font-size:13px;line-height:1.5}.rc-alert{padding:11px 13px;border-radius:10px;margin:12px 0;font-size:14px;background:#fff0f0;color:#922727}.rc-notice{padding:11px 13px;border-radius:10px;margin:12px 0;font-size:14px;background:#e9fbf5;color:#14644d}.rc-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:13px}.rc-toolbar select{border:1px solid #cbd8e4;border-radius:10px;padding:10px;background:white;color:var(--ink)}.rc-list{display:grid;gap:10px}.rc-card{border:1px solid #e2eaf1;border-radius:13px;padding:14px;display:grid;gap:9px}.rc-cardtop{display:flex;justify-content:space-between;gap:12px}.rc-card h3{margin:0;font-size:15px;line-height:1.5}.rc-tags{display:flex;gap:6px;flex-wrap:wrap}.rc-tag{font-size:11px;padding:4px 8px;border-radius:999px;background:#edf6fa;color:#31536b}.rc-cardactions{display:flex;gap:7px;flex-wrap:wrap}.rc-cardactions .rc-btn{font-size:12px;padding:8px 10px}.rc-empty{border:1px dashed #cbd8e4;border-radius:13px;padding:25px;text-align:center;color:var(--muted);line-height:1.6}.rc-study{margin:18px 0;background:#f0fbfd;border:1px solid #bcecf4;border-radius:18px;padding:20px}.rc-studyhead{display:flex;justify-content:space-between;gap:10px;align-items:center}.rc-flash{width:100%;min-height:210px;border:1px solid #c5e6ee;background:#fff;border-radius:16px;padding:26px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;cursor:pointer;margin:13px 0;color:var(--navy)}.rc-flash small{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#51778b;font-weight:800}.rc-flash strong{font-size:clamp(18px,2.5vw,25px);line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.rc-ratings{display:flex;gap:8px;flex-wrap:wrap}.rc-ratings .rc-btn{flex:1;min-width:90px}.rc-footer{font-size:12px;color:var(--muted);margin-top:12px}
      @media(max-width:780px){.rc-grid{grid-template-columns:1fr}.rc-stats{gap:8px}.rc-stat{padding:13px}.rc-stat strong{font-size:22px}.rc-hero{padding:22px}.rc-page{padding:18px 12px 36px}}
    `}</style>
    <section className="rc-hero"><div><div className="rc-eyebrow">RuffNeck Learn · Active recall</div><h1>Revision Cards Center</h1><p>Turn important course concepts into question-and-answer cards. Review them regularly and schedule the next review based on how confidently you remembered each answer.</p></div><div className="rc-actions"><button className="rc-btn secondary" onClick={() => startStudy(true)}>Study due cards ({dueCards.length})</button><button className="rc-btn" onClick={() => startStudy(false)}>Study all cards</button></div></section>
    <section className="rc-stats"><div className="rc-stat"><span>Total cards</span><strong>{cards.length}</strong></div><div className="rc-stat"><span>Due for review</span><strong>{dueCards.length}</strong></div><div className="rc-stat"><span>Reviews completed</span><strong>{cards.reduce((sum, card) => sum + card.review_count, 0)}</strong></div></section>
    {error && <div className="rc-alert" role="alert">{error}</div>}{notice && <div className="rc-notice" role="status">{notice}</div>}
    {activeCard && <section className="rc-study"><div className="rc-studyhead"><div><strong>Study session</strong><div className="rc-muted">{activeCard.course_title || "Personal revision"}{activeCard.topic ? ` · ${activeCard.topic}` : ""}</div></div><button className="rc-btn ghost" onClick={() => { setActive(null); setFlipped(false); }}>End session</button></div><button className="rc-flash" onClick={() => setFlipped(value => !value)} aria-label={flipped ? "Show question" : "Reveal answer"}><small>{flipped ? "Answer" : "Question · tap to reveal"}</small><strong>{flipped ? activeCard.back : activeCard.front}</strong></button>{flipped ? <><p className="rc-muted">How well did you recall the answer? Your choice schedules the next review.</p><div className="rc-ratings"><button className="rc-btn danger" onClick={() => void review("again")}>Again · 10 min</button><button className="rc-btn ghost" onClick={() => void review("hard")}>Hard · 1 day</button><button className="rc-btn" onClick={() => void review("good")}>Good · later</button><button className="rc-btn secondary" onClick={() => void review("easy")}>Easy · longer</button></div></> : <p className="rc-muted">Try answering from memory before revealing the answer.</p>}</section>}
    <div className="rc-grid"><section className="rc-panel"><h2>{editing ? "Edit revision card" : "Create a revision card"}</h2><p className="rc-muted">Write one clear question or prompt and a concise answer. Avoid putting multiple unrelated facts on one card.</p><form onSubmit={save}><div className="rc-field"><label htmlFor="rc-front">Question / prompt *</label><textarea id="rc-front" value={draft.front} maxLength={4000} required onChange={event => setDraft({ ...draft, front: event.target.value })} placeholder="Example: What is the purpose of a pivot table?" /></div><div className="rc-field"><label htmlFor="rc-back">Answer *</label><textarea id="rc-back" value={draft.back} maxLength={4000} required onChange={event => setDraft({ ...draft, back: event.target.value })} placeholder="Explain the concept in your own words…" /></div><div className="rc-field"><label htmlFor="rc-course">Course (optional)</label><input id="rc-course" value={draft.course_title} maxLength={160} onChange={event => setDraft({ ...draft, course_title: event.target.value })} placeholder="e.g. Data Analysis with Excel & Power BI" /></div><div className="rc-field"><label htmlFor="rc-topic">Topic (optional)</label><input id="rc-topic" value={draft.topic} maxLength={120} onChange={event => setDraft({ ...draft, topic: event.target.value })} placeholder="e.g. Pivot tables" /></div><div className="rc-actions"><button className="rc-btn" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add card"}</button>{editing && <button className="rc-btn ghost" type="button" onClick={() => beginEdit()}>Cancel edit</button>}</div></form></section>
    <section className="rc-panel"><h2>Your revision library</h2><div className="rc-toolbar"><input className="rc-search" aria-label="Search revision cards" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search questions, answers, topics…" /><select aria-label="Filter cards" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All cards</option><option value="due">Due now</option>{courses.map(course => <option key={course} value={course}>{course}</option>)}</select></div>{loading ? <div className="rc-empty">Loading your revision library…</div> : visible.length ? <div className="rc-list">{visible.map(card => <article className="rc-card" key={card.id}><div className="rc-cardtop"><h3>{card.front}</h3><span className="rc-tag">{new Date(card.due_at).getTime() <= Date.now() ? "Due" : "Scheduled"}</span></div><div className="rc-tags">{card.course_title && <span className="rc-tag">{card.course_title}</span>}{card.topic && <span className="rc-tag">{card.topic}</span>}<span className="rc-tag">{card.review_count} successful review{card.review_count === 1 ? "" : "s"}</span></div><p className="rc-muted">Answer: {card.back.length > 150 ? `${card.back.slice(0, 150)}…` : card.back}</p><div className="rc-cardactions"><button className="rc-btn" onClick={() => { setActive(card.id); setFlipped(false); }}>Study</button><button className="rc-btn ghost" onClick={() => beginEdit(card)}>Edit</button><button className="rc-btn danger" onClick={() => void remove(card)}>Delete</button></div></article>)}</div> : <div className="rc-empty">{cards.length ? "No cards match your search or filter." : "Your revision library is empty. Add your first question and answer to begin."}</div>}<div className="rc-footer">Cards are private to your account. Keep each card focused on one idea for more effective retrieval practice.</div></section></div>
  </main>;
}
