"use client";

import { useMemo, useState } from "react";

type CVInput = {
  fullName: string; email: string; phone: string; location: string; targetRole: string;
  summary: string; experience: string; education: string; skills: string; projects: string;
  certifications: string; jobDescription: string; style: "professional" | "modern" | "entry-level";
};

const initial: CVInput = {
  fullName: "", email: "", phone: "", location: "", targetRole: "", summary: "",
  experience: "", education: "", skills: "", projects: "", certifications: "",
  jobDescription: "", style: "professional",
};

const fields: { key: keyof CVInput; label: string; placeholder: string; rows?: number; required?: boolean }[] = [
  { key: "fullName", label: "Full name", placeholder: "Your name", required: true },
  { key: "email", label: "Email address", placeholder: "you@example.com", required: true },
  { key: "phone", label: "Phone number", placeholder: "+234 …" },
  { key: "location", label: "Location", placeholder: "City, Country" },
  { key: "targetRole", label: "Target role / job title", placeholder: "Administrative Officer", required: true },
  { key: "summary", label: "Professional profile", placeholder: "Summarise your experience, strengths and value. Leave blank for AI drafting.", rows: 3 },
  { key: "experience", label: "Work experience", placeholder: "Role | Employer | Dates\nResponsibilities and measurable achievements…", rows: 5 },
  { key: "education", label: "Education", placeholder: "Qualification | Institution | Year", rows: 3 },
  { key: "skills", label: "Skills", placeholder: "Excel, records management, customer service…", rows: 3 },
  { key: "projects", label: "Projects / portfolio", placeholder: "Project, your contribution, outcome…", rows: 3 },
  { key: "certifications", label: "Certifications and training", placeholder: "Certificate | Provider | Year", rows: 2 },
  { key: "jobDescription", label: "Job description (optional)", placeholder: "Paste the vacancy requirements to tailor your CV accurately.", rows: 5 },
];

export default function AICVBuilder() {
  const [form, setForm] = useState<CVInput>(initial);
  const [cv, setCv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const wordCount = useMemo(() => cv.trim() ? cv.trim().split(/\s+/).length : 0, [cv]);

  function update(key: keyof CVInput, value: string) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function generate() {
    setError(""); setNotice(""); setCv("");
    if (!form.fullName.trim() || !form.email.trim() || !form.targetRole.trim()) {
      setError("Enter your full name, email address and target role first."); return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/student/ai-cv-builder", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "CV generation failed. Please try again.");
      if (typeof data.cv !== "string" || !data.cv.trim()) throw new Error("The AI returned an empty CV. Try again.");
      setCv(data.cv.trim()); setNotice("Draft created. Review every detail before using it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  function download() {
    if (!cv) return;
    const blob = new Blob([cv], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${(form.fullName || "CV").trim().replace(/[^a-z0-9-_]+/gi, "-")}-CV.txt`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  return <main className="cvb-page">
    <style>{`
      .cvb-page{--navy:#0b1e3a;--cyan:#00b4d8;color:#15233a;max-width:1180px;margin:0 auto;padding:28px 18px 48px;font-family:Arial,Helvetica,sans-serif}
      .cvb-hero{background:linear-gradient(125deg,#0b1e3a,#12385c);color:white;border-radius:22px;padding:30px;margin-bottom:22px}
      .cvb-kicker{color:#7de8f7;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.cvb-hero h1{font-size:clamp(27px,4vw,40px);margin:10px 0}.cvb-hero p{max-width:760px;line-height:1.65;color:#e1eaf5;margin:0}
      .cvb-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start}.cvb-card{border:1px solid #dce5ef;border-radius:18px;padding:22px;background:#fff;box-shadow:0 8px 28px #0b1e3a0b}.cvb-card h2{font-size:20px;margin:0 0 6px;color:#0b1e3a}.cvb-sub{font-size:13px;color:#64748b;line-height:1.5;margin:0 0 18px}.cvb-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cvb-field{display:flex;flex-direction:column;gap:7px}.cvb-field.wide{grid-column:1/-1}.cvb-field label{font-size:13px;font-weight:700;color:#334155}.cvb-field input,.cvb-field textarea,.cvb-field select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;font:inherit;font-size:14px;background:#fff;color:#172033;outline:none}.cvb-field textarea{resize:vertical;min-height:78px;line-height:1.5}.cvb-field input:focus,.cvb-field textarea:focus,.cvb-field select:focus{border-color:#00a9ca;box-shadow:0 0 0 3px #00b4d81b}.cvb-btn{border:0;border-radius:10px;background:#00b4d8;color:#05263b;font-weight:800;padding:13px 17px;cursor:pointer}.cvb-btn:disabled{opacity:.6;cursor:wait}.cvb-btn.secondary{background:#e8f7fb;color:#07506a}.cvb-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.cvb-alert{padding:11px 13px;border-radius:10px;font-size:13px;margin-top:14px}.cvb-error{background:#fff0f0;color:#9f1239}.cvb-success{background:#ecfdf5;color:#166534}.cvb-output{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;font-size:14px;color:#26364b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;min-height:360px;max-height:680px;overflow:auto}.cvb-empty{min-height:300px;display:flex;align-items:center;justify-content:center;text-align:center;color:#718096;font-size:14px;line-height:1.6;padding:16px}.cvb-note{font-size:12px;color:#64748b;line-height:1.6;margin-top:14px}.cvb-count{font-size:12px;color:#64748b;margin:0 0 10px}@media(max-width:850px){.cvb-grid{grid-template-columns:1fr}.cvb-hero{padding:23px}}@media(max-width:520px){.cvb-page{padding:16px 12px 32px}.cvb-fields{grid-template-columns:1fr}.cvb-field.wide{grid-column:auto}.cvb-card{padding:16px}.cvb-hero{border-radius:16px}}
    `}</style>
    <section className="cvb-hero"><div className="cvb-kicker">RuffNeck Learn · Career tools</div><h1>AI CV & Resume Builder</h1><p>Build a clear, role-focused CV from your real experience, skills, education and projects. Add a job description to tailor the draft without inventing qualifications or achievements.</p></section>
    <div className="cvb-grid">
      <section className="cvb-card"><h2>Your information</h2><p className="cvb-sub">Provide accurate details. You can leave optional sections blank; the builder will not treat missing details as facts.</p>
        <div className="cvb-fields">{fields.map((field) => <div className={`cvb-field ${field.rows || field.key === "targetRole" ? "wide" : ""}`} key={field.key}>
          <label htmlFor={`cvb-${field.key}`}>{field.label}{field.required ? " *" : ""}</label>
          {field.rows ? <textarea id={`cvb-${field.key}`} rows={field.rows} placeholder={field.placeholder} value={String(form[field.key])} onChange={(e) => update(field.key, e.target.value)} maxLength={field.key === "jobDescription" ? 12000 : 8000} /> : <input id={`cvb-${field.key}`} type={field.key === "email" ? "email" : "text"} placeholder={field.placeholder} value={String(form[field.key])} onChange={(e) => update(field.key, e.target.value)} maxLength={300} required={field.required} />}
        </div>)}
        <div className="cvb-field wide"><label htmlFor="cvb-style">CV style</label><select id="cvb-style" value={form.style} onChange={(e) => update("style", e.target.value)}><option value="professional">Professional / corporate</option><option value="modern">Modern and concise</option><option value="entry-level">Entry-level / career transition</option></select></div></div>
        <div className="cvb-actions"><button className="cvb-btn" onClick={generate} disabled={busy}>{busy ? "Building your CV…" : "Generate CV draft"}</button><button className="cvb-btn secondary" onClick={() => { setForm(initial); setCv(""); setError(""); setNotice(""); }}>Clear form</button></div>
        {error && <div className="cvb-alert cvb-error" role="alert">{error}</div>}{notice && <div className="cvb-alert cvb-success" role="status">{notice}</div>}
        <p className="cvb-note">Privacy: the form is sent to the authenticated server endpoint for AI processing. Avoid entering passwords, bank details, national identification numbers or other information unrelated to your application. This tool does not save a CV to your account.</p>
      </section>
      <section className="cvb-card"><h2>CV preview</h2><p className="cvb-sub">Check dates, contact details, job titles and every achievement before submitting applications.</p>
        {cv ? <><p className="cvb-count">{wordCount} words · editable draft</p><textarea className="cvb-output" aria-label="Generated CV draft" value={cv} onChange={(e) => setCv(e.target.value)} /> <div className="cvb-actions"><button className="cvb-btn" onClick={download}>Download .txt</button><button className="cvb-btn secondary" onClick={() => window.print()}>Print / Save as PDF</button><button className="cvb-btn secondary" onClick={() => { void navigator.clipboard?.writeText(cv).then(() => setNotice("CV copied to clipboard.")); }}>Copy text</button></div></> : <div className="cvb-empty">Your generated CV will appear here.<br />Complete the required fields and select “Generate CV draft”.</div>}
        <p className="cvb-note">AI drafts can contain errors. Verify all claims, tailor the final version to the vacancy, and use a word processor for final layout before sending.</p>
      </section>
    </div>
  </main>;
}
