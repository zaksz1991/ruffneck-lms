"use client";

import { useState } from "react";

type Roadmap = {
  targetRole: string;
  summary: string;
  currentStrengths: string[];
  skillGaps: { skill: string; priority: "High" | "Medium" | "Low"; reason: string }[];
  milestones: { title: string; timeframe: string; actions: string[]; evidence: string }[];
  recommendedCourses: { title: string; reason: string }[];
  portfolioProjects: string[];
  nextStep: string;
};

const roles = ["AI / Automation Specialist", "Data Analyst", "Digital Marketer", "Administrative Professional", "Teacher / Learning Facilitator", "Virtual Assistant", "Business Operations Specialist", "Other"];
const skills = ["AI tools and prompting", "Microsoft Excel", "Power BI / data analysis", "Digital marketing", "Business writing", "Administration / records management", "Automation", "Presentation and communication", "Teaching / training", "Project management", "Programming", "Customer service"];

export default function AICareerPathwayPlanner() {
  const [targetRole, setTargetRole] = useState(roles[0]);
  const [currentRole, setCurrentRole] = useState("");
  const [experience, setExperience] = useState("beginner");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [hours, setHours] = useState("5");
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleSkill(skill: string) {
    setSelectedSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]);
  }

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setRoadmap(null);
    try {
      const response = await fetch("/api/student/career-pathway", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, currentRole, experience, skills: selectedSkills, goal, hoursPerWeek: Number(hours) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to create a career plan.");
      setRoadmap(payload.roadmap as Roadmap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  return <main className="career-wrap">
    <style jsx>{`
      .career-wrap{max-width:1120px;margin:0 auto;padding:24px;color:#e8eef8}.hero{background:linear-gradient(135deg,#0b1e3a,#123c60);border:1px solid #244b6d;border-radius:22px;padding:28px;margin-bottom:20px}.eyebrow{color:#00b4d8;font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.hero h1{font-size:clamp(27px,4vw,38px);margin:10px 0}.hero p{color:#c2d3e5;line-height:1.65;max-width:760px}.layout{display:grid;grid-template-columns:minmax(280px,.85fr) minmax(0,1.15fr);gap:20px}.panel{background:#0c1a2c;border:1px solid #263a51;border-radius:18px;padding:22px}.panel h2{font-size:19px;margin:0 0 16px}.field{display:flex;flex-direction:column;gap:7px;margin-bottom:15px}.field label,.label{font-size:13px;color:#c7d6e8;font-weight:650}.field input,.field select,.field textarea{background:#071322;border:1px solid #344960;border-radius:10px;padding:11px 12px;color:#f4f8fc;width:100%;box-sizing:border-box}.field textarea{min-height:84px;resize:vertical}.skill-list{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 16px}.skill{display:flex;gap:8px;align-items:flex-start;background:#101f32;border:1px solid #2b4058;padding:9px;border-radius:9px;font-size:12px;color:#d9e5f3}.skill input{accent-color:#00b4d8;margin-top:2px}.primary{width:100%;background:#00b4d8;color:#041725;font-weight:800;border:0;border-radius:11px;padding:13px;cursor:pointer}.primary:disabled{opacity:.55;cursor:wait}.muted{color:#9db0c6;font-size:13px;line-height:1.6}.error{color:#fecaca;background:#451a1a;padding:12px;border-radius:10px;margin-top:12px}.empty{padding:30px 18px;text-align:center;border:1px dashed #344960;border-radius:14px;color:#9db0c6;line-height:1.7}.result h2{margin-bottom:8px}.summary{color:#c8d8e9;line-height:1.65}.pill{display:inline-block;background:#103a4b;color:#70e6f5;border:1px solid #1c5c70;border-radius:30px;padding:5px 9px;font-size:11px;font-weight:800}.section{border-top:1px solid #293c51;margin-top:19px;padding-top:17px}.section h3{font-size:15px;margin:0 0 11px}.gap-item,.milestone,.course{background:#101f32;border:1px solid #2b4058;border-radius:12px;padding:13px;margin:9px 0}.gap-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.priority{font-size:10px;text-transform:uppercase;font-weight:800;color:#fbbf24}.gap-item p,.milestone p,.course p{font-size:13px;line-height:1.55;color:#b9cadd;margin:7px 0}.milestone h4,.course h4{font-size:14px;margin:0 0 6px}.milestone ul{padding-left:18px;color:#cbd8e7;font-size:13px;line-height:1.7}.next-step{background:#103a4b;border-left:4px solid #00b4d8;padding:14px;border-radius:8px;color:#e3faff;line-height:1.6}.plain-list{padding-left:20px;color:#cbd8e7;line-height:1.7;font-size:13px}.footnote{font-size:11px;color:#8095ad;line-height:1.6;margin-top:16px}@media(max-width:820px){.layout{grid-template-columns:1fr}.career-wrap{padding:14px}.hero{padding:22px}.skill-list{grid-template-columns:1fr 1fr}}@media(max-width:420px){.skill-list{grid-template-columns:1fr}}
    `}</style>
    <header className="hero"><div className="eyebrow">RuffNeck Learn · Career planning</div><h1>AI Career Pathway Planner</h1><p>Turn a career goal into a practical learning roadmap. Share your current experience, skills, and available study time to receive prioritized skill gaps, milestones, portfolio ideas, and relevant course suggestions.</p></header>
    <div className="layout">
      <section className="panel"><h2>Your career profile</h2><form onSubmit={createPlan}>
        <div className="field"><label htmlFor="target">Career goal</label><select id="target" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>{roles.map((role) => <option key={role}>{role}</option>)}</select></div>
        <div className="field"><label htmlFor="current">Current role or background</label><input id="current" value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} maxLength={120} placeholder="e.g. administrative officer, student, self-employed" /></div>
        <div className="field"><label htmlFor="experience">Current experience level</label><select id="experience" value={experience} onChange={(e) => setExperience(e.target.value)}><option value="beginner">Beginner / changing career</option><option value="some experience">Some practical experience</option><option value="experienced">Experienced / seeking advancement</option></select></div>
        <div className="label">Skills you already have</div><div className="skill-list">{skills.map((skill) => <label className="skill" key={skill}><input type="checkbox" checked={selectedSkills.includes(skill)} onChange={() => toggleSkill(skill)} />{skill}</label>)}</div>
        <div className="field"><label htmlFor="hours">Study time available each week</label><select id="hours" value={hours} onChange={(e) => setHours(e.target.value)}>{["1","2","3","5","7","10","15"].map((value) => <option key={value} value={value}>{value} {value === "1" ? "hour" : "hours"}</option>)}</select></div>
        <div className="field"><label htmlFor="goal">Specific goal or constraints (optional)</label><textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={1200} placeholder="e.g. build a portfolio in 3 months, use free tools, or prepare for a role in education." /></div>
        <button className="primary" disabled={loading} type="submit">{loading ? "Building your roadmap…" : "Generate my career roadmap"}</button>
        {error && <div className="error" role="alert">{error}</div>}
      </form></section>
      <section className="panel result" aria-live="polite"><h2>Your roadmap</h2>{!roadmap && !loading && <div className="empty">Your personalized pathway will appear here.<br />Complete your profile and select <strong>Generate my career roadmap</strong>.</div>}{loading && <div className="empty">Reviewing your profile and preparing practical milestones…</div>}
        {roadmap && <><span className="pill">{roadmap.targetRole}</span><p className="summary">{roadmap.summary}</p>
          <div className="section"><h3>Strengths to build on</h3><ul className="plain-list">{roadmap.currentStrengths.map((item,i)=><li key={i}>{item}</li>)}</ul></div>
          <div className="section"><h3>Priority skill gaps</h3>{roadmap.skillGaps.map((item,i)=><div className="gap-item" key={i}><div className="gap-head"><strong>{item.skill}</strong><span className="priority">{item.priority} priority</span></div><p>{item.reason}</p></div>)}</div>
          <div className="section"><h3>Milestones</h3>{roadmap.milestones.map((item,i)=><div className="milestone" key={i}><h4>{i+1}. {item.title}</h4><span className="pill">{item.timeframe}</span><ul>{item.actions.map((action,j)=><li key={j}>{action}</li>)}</ul><p><strong>Evidence of progress:</strong> {item.evidence}</p></div>)}</div>
          <div className="section"><h3>Suggested RuffNeck Learn courses</h3>{roadmap.recommendedCourses.map((item,i)=><div className="course" key={i}><h4>{item.title}</h4><p>{item.reason}</p></div>)}</div>
          <div className="section"><h3>Portfolio project ideas</h3><ul className="plain-list">{roadmap.portfolioProjects.map((item,i)=><li key={i}>{item}</li>)}</ul></div>
          <div className="section"><h3>Your next step</h3><div className="next-step">{roadmap.nextStep}</div></div>
          <p className="footnote">This AI-generated roadmap is guidance, not a job guarantee or formal assessment. Course recommendations may need to be matched to the live catalogue. Revisit the plan as you gain experience.</p>
        </>}
      </section>
    </div>
  </main>;
}
