"use client";

import { FormEvent, useState } from "react";

type Profile = { id?: string; user_id?: string; username: string; display_name: string; headline: string; bio: string; is_public: boolean };
type Item = { id: string; title: string; description: string; category: string; project_url: string | null; skills: string[]; is_public: boolean; sort_order?: number; created_at?: string };

const blankProfile: Profile = { username: "", display_name: "", headline: "", bio: "", is_public: false };
const blankItem = { title: "", description: "", category: "project", project_url: "", skills: "", is_public: false };

export default function LearnerPortfolio({ initialProfile, initialItems }: { initialProfile: Profile | null; initialItems: Item[] }) {
  const [profile, setProfile] = useState<Profile>(initialProfile ?? blankProfile);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [itemForm, setItemForm] = useState({ ...blankItem });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const publicUrl = typeof window !== "undefined" && profile.username ? `${window.location.origin}/portfolio/${profile.username}` : "";

  async function send(payload: Record<string, unknown>) {
    const response = await fetch("/api/student/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to save portfolio changes.");
    return result;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const result = await send({ action: "save_profile", profile });
      setProfile(result.profile); setStatus("Portfolio profile saved.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not save profile."); }
    finally { setBusy(false); }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const result = await send({ action: "add_item", item: { ...itemForm, skills: itemForm.skills.split(",").map(s => s.trim()).filter(Boolean) } });
      setItems(current => [result.item, ...current]); setItemForm({ ...blankItem }); setStatus("Portfolio entry added.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not add entry."); }
    finally { setBusy(false); }
  }

  async function toggleItem(item: Item) {
    setBusy(true); setStatus("");
    try { const result = await send({ action: "toggle_item", id: item.id, is_public: !item.is_public }); setItems(current => current.map(row => row.id === item.id ? result.item : row)); setStatus("Entry visibility updated."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not update entry."); }
    finally { setBusy(false); }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Delete this portfolio entry? This cannot be undone.")) return;
    setBusy(true); setStatus("");
    try { await send({ action: "delete_item", id }); setItems(current => current.filter(item => item.id !== id)); setStatus("Portfolio entry deleted."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not delete entry."); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); setStatus("Public portfolio link copied."); }
    catch { setStatus(`Copy this link: ${publicUrl}`); }
  }

  return <>
    <section className="portfolio-card">
      <h2>Profile details</h2><p className="portfolio-muted">Choose a short public username and describe the work you can do. Your profile stays private until you publish it.</p>
      <form onSubmit={saveProfile}>
        <div className="portfolio-grid" style={{ marginTop: 18 }}>
          <label className="portfolio-field">Display name<input maxLength={100} required value={profile.display_name} onChange={e => setProfile({ ...profile, display_name: e.target.value })} placeholder="Your professional name" /></label>
          <label className="portfolio-field">Portfolio username<input maxLength={30} minLength={3} pattern="[a-z0-9][a-z0-9_-]{2,29}" required value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} placeholder="e.g. hassan-zakariya" /><span className="portfolio-muted">3–30 characters: lowercase letters, numbers, _ or -.</span></label>
          <label className="portfolio-field portfolio-wide">Professional headline<input maxLength={160} value={profile.headline} onChange={e => setProfile({ ...profile, headline: e.target.value })} placeholder="e.g. AI-enabled administrative and data operations" /></label>
          <label className="portfolio-field portfolio-wide">About me<textarea maxLength={1200} value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} placeholder="Summarise your strengths, the problems you solve, and the work you want to do." /></label>
        </div>
        <div className="portfolio-actions"><button className="portfolio-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></div>
      </form>
    </section>

    <section className="portfolio-card">
      <div className="portfolio-public-row"><div><h2>Public portfolio</h2><p className="portfolio-muted">Publishing makes your profile and only the entries marked public visible to anyone with your link.</p></div><label><input type="checkbox" checked={profile.is_public} onChange={async e => { const next = e.target.checked; setProfile(p => ({ ...p, is_public: next })); setBusy(true); setStatus(""); try { const result = await send({ action: "set_public", is_public: next }); setProfile(result.profile); setStatus(next ? "Portfolio published." : "Portfolio is now private."); } catch (error) { setProfile(p => ({ ...p, is_public: !next })); setStatus(error instanceof Error ? error.message : "Could not change visibility."); } finally { setBusy(false); } }} /> Publish profile</label></div>
      {profile.is_public && profile.username && <div className="portfolio-actions"><a className="portfolio-button secondary" href={`/portfolio/${profile.username}`} target="_blank" rel="noreferrer">View public page ↗</a><button type="button" className="portfolio-button secondary" onClick={copyLink}>Copy public link</button></div>}
    </section>

    <section className="portfolio-card">
      <h2>Add a portfolio entry</h2><p className="portfolio-muted">Add a project, work sample, case study, achievement, or certificate. Do not include confidential client or employer information.</p>
      <form onSubmit={addItem}>
        <div className="portfolio-grid" style={{ marginTop: 18 }}>
          <label className="portfolio-field">Entry title<input required maxLength={140} value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })} placeholder="e.g. Monthly sales analysis dashboard" /></label>
          <label className="portfolio-field">Type<select value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}><option value="project">Project</option><option value="work_sample">Work sample</option><option value="case_study">Case study</option><option value="achievement">Achievement</option><option value="certificate">Certificate</option></select></label>
          <label className="portfolio-field portfolio-wide">Description<textarea required maxLength={2000} value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} placeholder="What was the task, what did you do, and what was the outcome?" /></label>
          <label className="portfolio-field">Project or verification link (optional)<input type="url" maxLength={500} value={itemForm.project_url} onChange={e => setItemForm({ ...itemForm, project_url: e.target.value })} placeholder="https://…" /></label>
          <label className="portfolio-field">Skills (comma-separated)<input maxLength={500} value={itemForm.skills} onChange={e => setItemForm({ ...itemForm, skills: e.target.value })} placeholder="Excel, data analysis, reporting" /></label>
        </div>
        <div className="portfolio-actions"><label className="portfolio-field" style={{ flexDirection: "row", alignItems: "center" }}><input type="checkbox" checked={itemForm.is_public} onChange={e => setItemForm({ ...itemForm, is_public: e.target.checked })} /> Make this entry public</label><button className="portfolio-button" disabled={busy}>{busy ? "Saving…" : "Add entry"}</button></div>
      </form>
    </section>

    <section className="portfolio-card"><h2>Your portfolio entries <span style={{ color: "#8ba5c1", fontWeight: 500 }}>({items.length})</span></h2><p className="portfolio-muted">Keep descriptions specific. Explain your process and results rather than listing tools alone.</p>
      {items.length === 0 ? <div className="portfolio-empty" style={{ marginTop: 16 }}>Your portfolio is empty. Add your first project, work sample, or achievement above.</div> : <div className="portfolio-items" style={{ marginTop: 16 }}>{items.map(item => <article className="portfolio-item" key={item.id}><span className="portfolio-chip">{item.category.replace("_", " ")}</span><h3>{item.title}</h3><p>{item.description}</p>{item.skills?.length > 0 && <div className="portfolio-tags">{item.skills.map(skill => <span key={skill}>{skill}</span>)}</div>}<div className="portfolio-actions">{item.project_url && <a className="portfolio-button secondary" href={item.project_url} target="_blank" rel="noreferrer">Open link ↗</a>}<button type="button" className="portfolio-button secondary" disabled={busy} onClick={() => toggleItem(item)}>{item.is_public ? "Make private" : "Make public"}</button><button type="button" className="portfolio-button danger" disabled={busy} onClick={() => removeItem(item.id)}>Delete</button></div></article>)}</div>}
    </section>
    {status && <p className="portfolio-status" role="status" aria-live="polite">{status}</p>}
  </>;
}
