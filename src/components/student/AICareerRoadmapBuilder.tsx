"use client";

import { FormEvent, useState } from "react";

type Roadmap = {
  careerGoal: string;
  startingPoint: string;
  targetTimeline: string;
  summary: string;
  milestones: Array<{
    title: string;
    timeframe: string;
    objective: string;
    actions: string[];
    evidence: string[];
    checkpoint: string;
  }>;
  portfolioProjects: Array<{ title: string; brief: string; deliverables: string[] }>;
  weeklyRoutine: string[];
  risksAndAdjustments: string[];
  nextActions: string[];
};

const emptyRoadmap: Roadmap = {
  careerGoal: "", startingPoint: "", targetTimeline: "", summary: "",
  milestones: [], portfolioProjects: [], weeklyRoutine: [], risksAndAdjustments: [], nextActions: [],
};

export default function AICareerRoadmapBuilder() {
  const [goal, setGoal] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [hours, setHours] = useState("5–7 hours per week");
  const [timeline, setTimeline] = useState("12 weeks");
  const [interests, setInterests] = useState("");
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateRoadmap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setRoadmap(null);
    try {
      const response = await fetch("/api/student/ai-career-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, currentSkills, experience, hours, timeline, interests }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to generate your roadmap.");
      setRoadmap(data.roadmap as Roadmap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function downloadRoadmap() {
    if (!roadmap) return;
    const lines = [
      "RUFFNECK LEARN — AI CAREER ROADMAP", "", `Career goal: ${roadmap.careerGoal}`,
      `Starting point: ${roadmap.startingPoint}`, `Timeline: ${roadmap.targetTimeline}`, "", roadmap.summary, "",
      "MILESTONES", ...roadmap.milestones.flatMap((m, i) => [
        `${i + 1}. ${m.title} (${m.timeframe})`, m.objective, "Actions:", ...m.actions.map(a => `- ${a}`),
        "Evidence of progress:", ...m.evidence.map(e => `- ${e}`), `Checkpoint: ${m.checkpoint}`, "",
      ]),
      "PORTFOLIO PROJECTS", ...roadmap.portfolioProjects.flatMap(p => [p.title, p.brief, ...p.deliverables.map(d => `- ${d}`), ""]),
      "WEEKLY ROUTINE", ...roadmap.weeklyRoutine.map(x => `- ${x}`), "",
      "RISKS AND ADJUSTMENTS", ...roadmap.risksAndAdjustments.map(x => `- ${x}`), "",
      "NEXT ACTIONS", ...roadmap.nextActions.map((x, i) => `${i + 1}. ${x}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "ruffneck-career-roadmap.txt"; link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="crm-page">
      <style jsx>{`
        .crm-page{max-width:1100px;margin:0 auto;padding:28px 18px 56px;color:#e8eef8}
        .crm-hero{padding:28px;border:1px solid #233b5e;border-radius:20px;background:linear-gradient(135deg,#0b1e3a,#102d50 70%,#073b4c);margin-bottom:22px}
        .crm-kicker{color:#00b4d8;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
        h1{font-size:clamp(28px,4vw,42px);line-height:1.12;margin:10px 0} .crm-hero p{color:#c0cde0;max-width:760px;line-height:1.65;margin-bottom:0}
        .crm-card{background:#0d1b30;border:1px solid #243953;border-radius:16px;padding:22px;margin-bottom:20px}
        .crm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.crm-field{display:flex;flex-direction:column;gap:7px}.crm-field label{font-size:13px;font-weight:700;color:#d9e5f5}
        input,textarea,select{width:100%;border:1px solid #344b68;border-radius:10px;padding:12px 13px;background:#081426;color:#f1f5fb;font:inherit;outline:none}input:focus,textarea:focus,select:focus{border-color:#00b4d8;box-shadow:0 0 0 2px #00b4d822}textarea{min-height:96px;resize:vertical}
        .crm-wide{grid-column:1/-1}.crm-button{border:0;border-radius:10px;padding:13px 18px;background:#00b4d8;color:#041524;font-weight:800;cursor:pointer}.crm-button:disabled{opacity:.6;cursor:wait}.crm-secondary{background:#142943;color:#dff7ff;border:1px solid #31506e;margin-left:8px}
        .crm-error{padding:12px 14px;border:1px solid #8b3a4a;background:#351a27;color:#ffd7de;border-radius:10px;margin-top:14px}.crm-muted{color:#aabbd1;font-size:13px;line-height:1.55}.crm-result h2{margin-top:0}.crm-result h3{color:#72e3f5;margin-bottom:7px}.crm-milestone{border:1px solid #263d59;border-radius:13px;padding:17px;margin:13px 0;background:#0a1729}.crm-milestone p,.crm-result p{line-height:1.6;color:#d0dceb}.crm-result li{margin:6px 0;line-height:1.5;color:#d0dceb}.crm-pill{display:inline-block;padding:5px 9px;border-radius:99px;background:#12384a;color:#80eaff;font-size:12px;font-weight:700}.crm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
        @media(max-width:680px){.crm-grid{grid-template-columns:1fr}.crm-wide{grid-column:auto}.crm-hero,.crm-card{padding:18px}.crm-secondary{margin-left:0}}
      `}</style>
      <section className="crm-hero">
        <div className="crm-kicker">RuffNeck Learn · Career Development</div>
        <h1>AI Career Roadmap Builder</h1>
        <p>Turn a career goal into a practical sequence of learning milestones, portfolio projects, and progress checkpoints. The roadmap is a planning aid—not a guarantee of employment or a substitute for verified career advice.</p>
      </section>
      <form className="crm-card" onSubmit={generateRoadmap}>
        <h2>Build your roadmap</h2>
        <div className="crm-grid">
          <div className="crm-field crm-wide"><label htmlFor="crm-goal">Target role or career goal *</label><input id="crm-goal" required minLength={3} maxLength={180} value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Junior data analyst, product designer, IT support specialist" /></div>
          <div className="crm-field"><label htmlFor="crm-skills">Current skills</label><textarea id="crm-skills" maxLength={2500} value={currentSkills} onChange={e => setCurrentSkills(e.target.value)} placeholder="Tools, technical skills, strengths, languages" /></div>
          <div className="crm-field"><label htmlFor="crm-experience">Experience and education</label><textarea id="crm-experience" maxLength={2500} value={experience} onChange={e => setExperience(e.target.value)} placeholder="Work, study, volunteering, projects, certifications" /></div>
          <div className="crm-field"><label htmlFor="crm-timeline">Target timeline</label><select id="crm-timeline" value={timeline} onChange={e => setTimeline(e.target.value)}><option>4 weeks</option><option>8 weeks</option><option>12 weeks</option><option>6 months</option><option>12 months</option></select></div>
          <div className="crm-field"><label htmlFor="crm-hours">Time available each week</label><select id="crm-hours" value={hours} onChange={e => setHours(e.target.value)}><option>1–3 hours per week</option><option>5–7 hours per week</option><option>8–12 hours per week</option><option>13+ hours per week</option></select></div>
          <div className="crm-field crm-wide"><label htmlFor="crm-interests">Interests, constraints, or preferred learning style</label><textarea id="crm-interests" maxLength={1500} value={interests} onChange={e => setInterests(e.target.value)} placeholder="e.g. prefer free resources, need a mobile-friendly plan, interested in Nigerian job opportunities" /></div>
        </div>
        <p className="crm-muted">Do not enter passwords, identification numbers, or other sensitive personal information.</p>
        <button className="crm-button" type="submit" disabled={loading}>{loading ? "Building your roadmap…" : "Generate career roadmap"}</button>
        {error && <div className="crm-error" role="alert">{error}</div>}
      </form>
      {roadmap && <section className="crm-card crm-result" aria-live="polite">
        <div className="crm-pill">Personalized planning draft</div><h2>{roadmap.careerGoal || goal}</h2>
        <p>{roadmap.summary}</p><p className="crm-muted">Starting point: {roadmap.startingPoint} · Timeline: {roadmap.targetTimeline}</p>
        <h3>Milestones</h3>
        {roadmap.milestones.map((m, i) => <article className="crm-milestone" key={`${m.title}-${i}`}><span className="crm-pill">{m.timeframe}</span><h3>{i + 1}. {m.title}</h3><p>{m.objective}</p><strong>Actions</strong><ul>{m.actions.map((a, j) => <li key={j}>{a}</li>)}</ul><strong>Evidence of progress</strong><ul>{m.evidence.map((e, j) => <li key={j}>{e}</li>)}</ul><p><strong>Checkpoint:</strong> {m.checkpoint}</p></article>)}
        <h3>Portfolio projects</h3>{roadmap.portfolioProjects.map((p, i) => <article className="crm-milestone" key={`${p.title}-${i}`}><h3>{p.title}</h3><p>{p.brief}</p><ul>{p.deliverables.map((d, j) => <li key={j}>{d}</li>)}</ul></article>)}
        <h3>Suggested weekly routine</h3><ul>{roadmap.weeklyRoutine.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <h3>Risks and adjustments</h3><ul>{roadmap.risksAndAdjustments.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <h3>Start with these actions</h3><ol>{roadmap.nextActions.map((x, i) => <li key={i}>{x}</li>)}</ol>
        <div className="crm-actions"><button type="button" className="crm-button" onClick={downloadRoadmap}>Download roadmap (.txt)</button><button type="button" className="crm-button crm-secondary" onClick={() => window.print()}>Print / Save as PDF</button></div>
        <p className="crm-muted">Review the plan against current job postings and trusted learning resources. Adjust the schedule as your circumstances change.</p>
      </section>}
    </main>
  );
}
