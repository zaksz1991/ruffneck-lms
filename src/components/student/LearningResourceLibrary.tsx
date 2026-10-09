"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ResourceType = "article" | "video" | "document" | "tool" | "website" | "other";
type Resource = { id: string; title: string; url: string; description: string | null; resource_type: ResourceType; course_title: string | null; topic: string | null; is_favorite: boolean; created_at: string; updated_at: string };
const types: { value: ResourceType | "all"; label: string }[] = [{ value: "all", label: "All resources" }, { value: "article", label: "Articles" }, { value: "video", label: "Videos" }, { value: "document", label: "Documents" }, { value: "tool", label: "Tools" }, { value: "website", label: "Websites" }, { value: "other", label: "Other" }];
const initialForm = { title: "", url: "", description: "", resource_type: "article" as ResourceType, course_title: "", topic: "" };

export default function LearningResourceLibrary() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ResourceType | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (filter !== "all") params.set("type", filter);
      const response = await fetch(`/api/student/learning-resources?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load resources.");
      setResources(result.resources ?? []); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load resources."); }
    finally { setLoading(false); }
  }, [search, filter]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 180); return () => clearTimeout(timer); }, [load]);

  const stats = useMemo(() => ({ total: resources.length, favorites: resources.filter(r => r.is_favorite).length, courses: new Set(resources.map(r => r.course_title).filter(Boolean)).size }), [resources]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/student/learning-resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save resource.");
      setForm(initialForm); setShowForm(false); setMessage("Resource saved to your library."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save resource."); }
    finally { setBusy(false); }
  }

  async function toggleFavorite(resource: Resource) {
    try {
      const response = await fetch("/api/student/learning-resources", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: resource.id, is_favorite: !resource.is_favorite }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not update favorite."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update favorite."); }
  }

  async function remove(resource: Resource) {
    if (!window.confirm(`Remove “${resource.title}” from your library?`)) return;
    try { const response = await fetch(`/api/student/learning-resources?id=${encodeURIComponent(resource.id)}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not delete resource."); setResources(current => current.filter(item => item.id !== resource.id)); setMessage("Resource removed."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete resource."); }
  }

  return <main className="lrl-wrap">
    <style>{`
      .lrl-wrap{--lrl-navy:#0b1e3a;--lrl-cyan:#00b4d8;color:#15243a;max-width:1120px;margin:0 auto;padding:24px 18px 48px;font-family:inherit}
      .lrl-hero{background:linear-gradient(125deg,#0b1e3a,#123d63);border-radius:22px;padding:28px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
      .lrl-kicker{font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:#7ce7f5;font-weight:800}.lrl-hero h1{margin:8px 0;font-size:clamp(25px,4vw,36px);line-height:1.15}.lrl-hero p{margin:0;color:#d6e6f2;max-width:610px;line-height:1.6}.lrl-btn{border:0;border-radius:10px;background:var(--lrl-cyan);color:#062138;font-weight:800;padding:11px 16px;cursor:pointer}.lrl-btn:disabled{opacity:.6;cursor:wait}.lrl-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}.lrl-stat,.lrl-card,.lrl-form{border:1px solid #dfe7ef;border-radius:15px;background:#fff}.lrl-stat{padding:16px}.lrl-stat strong{display:block;font-size:25px;color:#0b1e3a}.lrl-stat span{font-size:13px;color:#617188}.lrl-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.lrl-input,.lrl-select,.lrl-textarea{box-sizing:border-box;width:100%;border:1px solid #cbd7e3;border-radius:9px;padding:11px 12px;background:#fff;color:#15243a;font:inherit}.lrl-search{flex:1;min-width:210px}.lrl-select{width:auto;min-width:155px}.lrl-form{padding:18px;margin-bottom:18px}.lrl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lrl-field label{display:block;font-size:13px;font-weight:750;margin:0 0 6px}.lrl-field-full{grid-column:1/-1}.lrl-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}.lrl-btn-secondary{background:#edf3f8;color:#19334e}.lrl-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.lrl-card{padding:17px;min-width:0}.lrl-cardtop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.lrl-tag{display:inline-block;background:#e5f8fc;color:#08647b;border-radius:100px;padding:5px 9px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.lrl-card h2{font-size:18px;line-height:1.35;margin:12px 0 7px;overflow-wrap:anywhere}.lrl-desc{font-size:14px;color:#586a80;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.lrl-meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.lrl-chip{font-size:12px;background:#f1f5f9;border-radius:7px;padding:5px 8px;color:#41536a}.lrl-cardfoot{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:16px}.lrl-link{font-weight:800;color:#087f9c;text-decoration:none;overflow-wrap:anywhere}.lrl-iconbtn{border:1px solid #d5e0e9;background:#fff;color:#243b53;border-radius:8px;padding:7px 9px;cursor:pointer}.lrl-empty{border:1px dashed #c7d5e2;border-radius:15px;padding:32px 20px;text-align:center;color:#64748b;background:#f8fafc;grid-column:1/-1}.lrl-message{padding:11px 13px;background:#effbfe;border:1px solid #bcecf4;border-radius:10px;color:#07566b;margin:14px 0;font-size:14px}.lrl-muted{color:#617188;font-size:14px}
      @media(max-width:680px){.lrl-wrap{padding:16px 12px 34px}.lrl-hero{padding:22px 18px}.lrl-stats{gap:8px}.lrl-stat{padding:12px}.lrl-stat strong{font-size:21px}.lrl-list,.lrl-grid{grid-template-columns:1fr}.lrl-field-full{grid-column:auto}.lrl-select{width:100%}.lrl-actions .lrl-btn{flex:1}}
    `}</style>
    <section className="lrl-hero"><div><div className="lrl-kicker">RuffNeck Learn · Your resources</div><h1>Learning Resource Library</h1><p>Keep useful articles, videos, documents, websites, and tools together. Organize resources by course or topic and return to them whenever you need them.</p></div><button className="lrl-btn" onClick={() => setShowForm(value => !value)}>{showForm ? "Close form" : "+ Save a resource"}</button></section>
    <section className="lrl-stats" aria-label="Resource statistics"><div className="lrl-stat"><strong>{stats.total}</strong><span>Resources shown</span></div><div className="lrl-stat"><strong>{stats.favorites}</strong><span>Favorites shown</span></div><div className="lrl-stat"><strong>{stats.courses}</strong><span>Courses represented</span></div></section>
    {message && <div className="lrl-message" role="status">{message}</div>}
    {showForm && <form className="lrl-form" onSubmit={submit}><h2 style={{marginTop:0}}>Save a learning resource</h2><div className="lrl-grid">
      <div className="lrl-field"><label htmlFor="lrl-title">Title *</label><input id="lrl-title" className="lrl-input" required maxLength={180} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Excel PivotTable guide" /></div>
      <div className="lrl-field"><label htmlFor="lrl-url">Web address (HTTP/HTTPS) *</label><input id="lrl-url" className="lrl-input" type="url" required value={form.url} onChange={e => setForm({...form,url:e.target.value})} placeholder="https://..." /></div>
      <div className="lrl-field"><label htmlFor="lrl-type">Resource type</label><select id="lrl-type" className="lrl-input" value={form.resource_type} onChange={e => setForm({...form,resource_type:e.target.value as ResourceType})}>{types.filter(t=>t.value!=="all").map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
      <div className="lrl-field"><label htmlFor="lrl-course">Course (optional)</label><input id="lrl-course" className="lrl-input" maxLength={180} value={form.course_title} onChange={e => setForm({...form,course_title:e.target.value})} placeholder="Course name" /></div>
      <div className="lrl-field"><label htmlFor="lrl-topic">Topic (optional)</label><input id="lrl-topic" className="lrl-input" maxLength={120} value={form.topic} onChange={e => setForm({...form,topic:e.target.value})} placeholder="e.g. Data analysis" /></div>
      <div className="lrl-field lrl-field-full"><label htmlFor="lrl-description">Notes (optional)</label><textarea id="lrl-description" className="lrl-textarea" maxLength={1200} rows={3} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="What is useful about this resource? What do you want to practise?" /></div>
    </div><div className="lrl-actions"><button type="button" className="lrl-btn lrl-btn-secondary" onClick={() => {setShowForm(false);setForm(initialForm);}}>Cancel</button><button className="lrl-btn" disabled={busy}>{busy ? "Saving…" : "Save resource"}</button></div></form>}
    <div className="lrl-toolbar"><input className="lrl-input lrl-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search titles, notes, and topics…" aria-label="Search resources" /><select className="lrl-select" value={filter} onChange={e => setFilter(e.target.value as ResourceType | "all")} aria-label="Filter resource type">{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
    {loading ? <div className="lrl-empty">Loading your resources…</div> : <section className="lrl-list" aria-label="Saved resources">{resources.length === 0 ? <div className="lrl-empty"><h2 style={{color:"#19334e",marginTop:0}}>Your library is ready</h2><p>No resources match this view yet. Save a useful link to start building your personal learning collection.</p><button className="lrl-btn" onClick={() => setShowForm(true)}>Save your first resource</button></div> : resources.map(resource=><article className="lrl-card" key={resource.id}><div className="lrl-cardtop"><span className="lrl-tag">{resource.resource_type}</span><button className="lrl-iconbtn" aria-label={resource.is_favorite ? "Remove from favorites" : "Add to favorites"} title={resource.is_favorite ? "Remove favorite" : "Add favorite"} onClick={() => void toggleFavorite(resource)}>{resource.is_favorite ? "★ Favorite" : "☆ Favorite"}</button></div><h2>{resource.title}</h2>{resource.description && <p className="lrl-desc">{resource.description}</p>}<div className="lrl-meta">{resource.course_title && <span className="lrl-chip">Course: {resource.course_title}</span>}{resource.topic && <span className="lrl-chip">Topic: {resource.topic}</span>}</div><div className="lrl-cardfoot"><a className="lrl-link" href={resource.url} target="_blank" rel="noopener noreferrer">Open resource ↗</a><button className="lrl-iconbtn" onClick={() => void remove(resource)}>Remove</button></div></article>)}</section>}
    <p className="lrl-muted" style={{marginTop:18}}>Only HTTP and HTTPS links are accepted. This library saves links and notes; it does not upload or host files.</p>
  </main>;
}
