"use client";

import { useState } from "react";

type Result = { title?: string; content?: string; sections?: { heading: string; content: string }[]; checklist?: string[] };

const styles = `
.jaa{max-width:1040px;margin:0 auto;padding:24px;color:#10213a}.jaa *{box-sizing:border-box}.jaa-hero{background:linear-gradient(135deg,#0b1e3a,#123c63);color:#fff;padding:28px;border-radius:18px;margin-bottom:20px}.jaa-hero h1{margin:0 0 8px;font-size:clamp(1.5rem,3vw,2.1rem)}.jaa-hero p{margin:0;color:#d6e9f7;line-height:1.6}.jaa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.jaa-card{background:#fff;border:1px solid #dbe5ef;border-radius:14px;padding:18px;box-shadow:0 5px 20px #10213a0a}.jaa-field{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}.jaa-field label{font-weight:650;font-size:.92rem}.jaa input,.jaa select,.jaa textarea{width:100%;border:1px solid #cbd7e4;border-radius:9px;padding:11px 12px;font:inherit;background:#fff;color:#10213a}.jaa textarea{min-height:112px;resize:vertical}.jaa .jaa-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.jaa button{border:0;border-radius:9px;padding:11px 16px;font:inherit;font-weight:700;cursor:pointer}.jaa .jaa-primary{background:#00b4d8;color:#06243b}.jaa .jaa-secondary{background:#eaf2f8;color:#12304c}.jaa button:disabled{opacity:.55;cursor:wait}.jaa-output{white-space:pre-wrap;line-height:1.7;overflow-wrap:anywhere}.jaa-status{margin:12px 0;padding:11px 13px;border-radius:9px;background:#eaf8fc;color:#10415a}.jaa-error{background:#fff0f0;color:#8a2020}.jaa-note{font-size:.86rem;color:#52657b;line-height:1.55}.jaa h2{font-size:1.12rem;margin:0 0 14px}.jaa-result{margin-top:18px}.jaa-list{padding-left:20px;line-height:1.8}@media(max-width:720px){.jaa-grid{grid-template-columns:1fr}.jaa{padding:14px}.jaa-hero{padding:22px}}
`;

export default function AIJobApplicationAssistant() {
  const [documentType, setDocumentType] = useState("cover_letter");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [tone, setTone] = useState("professional");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setStatus(""); setError(false); setResult("");
    if (!role.trim() || !jobDescription.trim() || !experience.trim()) {
      setStatus("Enter the target role, job description, and your genuine experience before generating."); setError(true); return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/student/ai-job-application-assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType, role, company, jobDescription, experience, skills, tone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate the application document.");
      setResult(data.result || "No content was returned.");
      setStatus("Draft generated. Review every detail and correct anything that does not reflect your experience.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "A request error occurred."); setError(true);
    } finally { setBusy(false); }
  }

  async function copyResult() {
    try { await navigator.clipboard.writeText(result); setStatus("Draft copied to clipboard."); setError(false); }
    catch { setStatus("Clipboard access failed. Select the draft and copy it manually."); setError(true); }
  }

  function downloadResult() {
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `ruffneck-${documentType.replaceAll("_", "-")}.txt`; a.click(); URL.revokeObjectURL(url);
  }

  return <main className="jaa"><style>{styles}</style>
    <header className="jaa-hero"><h1>AI Job Application Assistant</h1><p>Prepare a targeted application draft from a real vacancy and your own experience. Use it as a starting point, not a substitute for checking the facts.</p></header>
    <section className="jaa-grid">
      <div className="jaa-card"><h2>1. Vacancy details</h2>
        <div className="jaa-field"><label htmlFor="jaa-type">What do you want to prepare?</label><select id="jaa-type" value={documentType} onChange={e=>setDocumentType(e.target.value)}><option value="cover_letter">Cover letter</option><option value="application_email">Application email</option><option value="job_match_analysis">Job match analysis and skills gaps</option><option value="application_pack">Cover letter + application email + checklist</option></select></div>
        <div className="jaa-field"><label htmlFor="jaa-role">Target job title *</label><input id="jaa-role" value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Administrative Officer" maxLength={180}/></div>
        <div className="jaa-field"><label htmlFor="jaa-company">Company or organisation</label><input id="jaa-company" value={company} onChange={e=>setCompany(e.target.value)} placeholder="Organisation name (optional)" maxLength={180}/></div>
        <div className="jaa-field"><label htmlFor="jaa-job">Job description / vacancy requirements *</label><textarea id="jaa-job" value={jobDescription} onChange={e=>setJobDescription(e.target.value)} placeholder="Paste the vacancy text and requirements here." maxLength={12000}/></div>
      </div>
      <div className="jaa-card"><h2>2. Your experience</h2>
        <div className="jaa-field"><label htmlFor="jaa-experience">Relevant experience and achievements *</label><textarea id="jaa-experience" value={experience} onChange={e=>setExperience(e.target.value)} placeholder="Include actual roles, responsibilities, measurable results, education, and relevant projects. Do not include passwords or sensitive ID numbers." maxLength={8000}/></div>
        <div className="jaa-field"><label htmlFor="jaa-skills">Skills and certifications</label><textarea id="jaa-skills" value={skills} onChange={e=>setSkills(e.target.value)} placeholder="List skills, tools, training, and certifications you genuinely have." maxLength={5000}/></div>
        <div className="jaa-field"><label htmlFor="jaa-tone">Writing style</label><select id="jaa-tone" value={tone} onChange={e=>setTone(e.target.value)}><option value="professional">Professional and direct</option><option value="confident">Confident and achievement-focused</option><option value="entry-level">Entry-level / career transition</option><option value="concise">Concise</option></select></div>
        <p className="jaa-note">Only provide information you are comfortable sending to an AI service. Avoid sensitive personal data. Generated content may be inaccurate; verify all names, dates, qualifications, and claims.</p>
        <div className="jaa-actions"><button className="jaa-primary" onClick={generate} disabled={busy}>{busy ? "Preparing draft…" : "Generate application draft"}</button><button className="jaa-secondary" onClick={()=>{setRole("");setCompany("");setJobDescription("");setExperience("");setSkills("");setResult("");setStatus("");}}>Clear form</button></div>
      </div>
    </section>
    {status && <div className={`jaa-status ${error ? "jaa-error" : ""}`} role="status">{status}</div>}
    {result && <section className="jaa-card jaa-result"><h2>3. Review your draft</h2><div className="jaa-output">{result}</div><div className="jaa-actions"><button className="jaa-primary" onClick={copyResult}>Copy draft</button><button className="jaa-secondary" onClick={downloadResult}>Download .txt</button><button className="jaa-secondary" onClick={()=>window.print()}>Print / Save as PDF</button></div><p className="jaa-note">Before submitting: replace placeholders, verify every claim, match the employer's instructions, and ensure the final application sounds like you.</p></section>}
  </main>;
}
