"use client";

import { useState } from "react";

type Analysis = {
  target_role?: string;
  summary?: string;
  strengths?: string[];
  skill_gaps?: Array<{ skill: string; importance: string; why_it_matters: string; suggested_action: string }>;
  learning_plan?: Array<{ timeframe: string; focus: string; activities: string[]; evidence_of_progress: string }>;
  course_recommendations?: Array<{ course_title: string; reason: string; priority: string }>;
  practical_projects?: Array<{ title: string; brief: string; skills_practiced: string[] }>;
  interview_topics?: string[];
  disclaimer?: string;
};

const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "12px 13px", borderRadius: 10, border: "1px solid #d6e0eb", background: "#fff", color: "#14243a", font: "inherit" };

export default function AISkillsGapAnalyzer() {
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [courses, setCourses] = useState("");
  const [goal, setGoal] = useState("Get job-ready");
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setError("");
    setResult(null);
    if (!role.trim() || !skills.trim()) {
      setError("Enter a target role and at least some current skills before analyzing.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/student/ai-skills-gap-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, skills, experience, jobDescription, courses, goal }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The skills analysis could not be completed.");
      setResult(data.analysis as Analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function exportReport() {
    if (!result) return;
    const lines: string[] = ["RUFFNECK LEARN — AI SKILLS GAP ANALYSIS", `Target role: ${result.target_role || role}`, "", result.summary || ""];
    if (result.strengths?.length) lines.push("", "CURRENT STRENGTHS", ...result.strengths.map((x) => `• ${x}`));
    if (result.skill_gaps?.length) lines.push("", "SKILL GAPS", ...result.skill_gaps.map((x) => `• ${x.skill} (${x.importance})\n  Why: ${x.why_it_matters}\n  Action: ${x.suggested_action}`));
    if (result.learning_plan?.length) lines.push("", "LEARNING PLAN", ...result.learning_plan.map((x) => `${x.timeframe}: ${x.focus}\n${x.activities.map((a) => `• ${a}`).join("\n")}\nEvidence: ${x.evidence_of_progress}`));
    if (result.course_recommendations?.length) lines.push("", "COURSE RECOMMENDATIONS", ...result.course_recommendations.map((x) => `• ${x.course_title} (${x.priority}) — ${x.reason}`));
    if (result.practical_projects?.length) lines.push("", "PRACTICAL PROJECTS", ...result.practical_projects.map((x) => `• ${x.title}: ${x.brief}\nSkills: ${x.skills_practiced.join(", ")}`));
    if (result.interview_topics?.length) lines.push("", "INTERVIEW TOPICS", ...result.interview_topics.map((x) => `• ${x}`));
    if (result.disclaimer) lines.push("", result.disclaimer);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ruffneck-skills-gap-analysis.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e0e8f1", borderRadius: 14, padding: 18, marginTop: 14 };
  const heading: React.CSSProperties = { color: "#0b1e3a", margin: "0 0 10px", fontSize: 18 };
  const list: React.CSSProperties = { paddingLeft: 20, marginBottom: 0, lineHeight: 1.65, color: "#33465d" };

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px 48px", color: "#15263d" }}>
      <section style={{ background: "linear-gradient(130deg,#0b1e3a,#123d63)", borderRadius: 18, padding: "26px 24px", color: "white" }}>
        <div style={{ color: "#65d8ed", fontWeight: 700, fontSize: 12, letterSpacing: 1.5 }}>RUFFNECK LEARN · CAREER TOOLS</div>
        <h1 style={{ fontSize: "clamp(26px,4vw,36px)", margin: "10px 0", lineHeight: 1.15 }}>AI Skills Gap Analyzer</h1>
        <p style={{ margin: 0, maxWidth: 760, lineHeight: 1.65, color: "#e0edf8" }}>Compare your current skills with a target role. Get a practical development plan, project ideas, and relevant course suggestions. Results are guidance—not a hiring decision or a guarantee of employment.</p>
      </section>

      <section style={{ ...card, marginTop: 18 }}>
        <h2 style={heading}>Your career profile</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>Target job or career role *<input style={fieldStyle} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Data Analyst" maxLength={160} /></label>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>Career goal<select style={fieldStyle} value={goal} onChange={(e) => setGoal(e.target.value)}><option>Get job-ready</option><option>Prepare for promotion</option><option>Change careers</option><option>Start freelancing</option><option>Improve current performance</option></select></label>
        </div>
        <label style={{ display: "grid", gap: 6, fontWeight: 600, marginTop: 14 }}>Current skills and tools *<textarea style={{ ...fieldStyle, minHeight: 100, resize: "vertical" }} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="List skills, tools, languages, and tasks you can genuinely perform." maxLength={6000} /></label>
        <label style={{ display: "grid", gap: 6, fontWeight: 600, marginTop: 14 }}>Experience and achievements<textarea style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }} value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Include work, volunteering, personal projects, or measurable results." maxLength={6000} /></label>
        <label style={{ display: "grid", gap: 6, fontWeight: 600, marginTop: 14 }}>Relevant courses or certifications<textarea style={{ ...fieldStyle, minHeight: 70, resize: "vertical" }} value={courses} onChange={(e) => setCourses(e.target.value)} placeholder="Courses completed, certificates earned, or topics studied." maxLength={4000} /></label>
        <label style={{ display: "grid", gap: 6, fontWeight: 600, marginTop: 14 }}>Job description (optional)<textarea style={{ ...fieldStyle, minHeight: 130, resize: "vertical" }} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the vacancy requirements to make the analysis more specific." maxLength={10000} /></label>
        {error && <p role="alert" style={{ color: "#a32222", background: "#fff1f1", borderRadius: 8, padding: 10 }}>{error}</p>}
        <button type="button" onClick={analyze} disabled={loading} style={{ marginTop: 16, padding: "12px 18px", border: 0, borderRadius: 10, background: loading ? "#8293a7" : "#00b4d8", color: "#06213a", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>{loading ? "Analyzing your profile…" : "Analyze my skills"}</button>
      </section>

      {result && <section aria-live="polite" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}><h2 style={{ color: "#0b1e3a", margin: 0 }}>Your development report</h2><button onClick={exportReport} type="button" style={{ padding: "10px 14px", border: "1px solid #b9c9d9", borderRadius: 9, background: "white", color: "#0b1e3a", fontWeight: 700, cursor: "pointer" }}>Download report (.txt)</button></div>
        {result.summary && <div style={card}><h3 style={heading}>Summary</h3><p style={{ lineHeight: 1.7, margin: 0 }}>{result.summary}</p></div>}
        {!!result.strengths?.length && <div style={card}><h3 style={heading}>Existing strengths</h3><ul style={list}>{result.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        {!!result.skill_gaps?.length && <div style={card}><h3 style={heading}>Priority skill gaps</h3>{result.skill_gaps.map((x, i) => <article key={i} style={{ padding: "12px 0", borderBottom: i < result.skill_gaps!.length - 1 ? "1px solid #e8eef4" : 0 }}><div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}><strong>{x.skill}</strong><span style={{ fontSize: 12, fontWeight: 800, color: "#075b77", background: "#e4f8fc", borderRadius: 20, padding: "3px 9px" }}>{x.importance}</span></div><p style={{ margin: "7px 0", lineHeight: 1.55 }}><strong>Why it matters:</strong> {x.why_it_matters}</p><p style={{ margin: 0, lineHeight: 1.55 }}><strong>Suggested action:</strong> {x.suggested_action}</p></article>)}</div>}
        {!!result.learning_plan?.length && <div style={card}><h3 style={heading}>Suggested learning plan</h3>{result.learning_plan.map((x, i) => <article key={i} style={{ marginBottom: 16 }}><strong>{x.timeframe} · {x.focus}</strong><ul style={list}>{x.activities?.map((a, j) => <li key={j}>{a}</li>)}</ul><p style={{ margin: "8px 0 0", color: "#53667b" }}><strong>Evidence of progress:</strong> {x.evidence_of_progress}</p></article>)}</div>}
        {!!result.course_recommendations?.length && <div style={card}><h3 style={heading}>Relevant courses to explore</h3>{result.course_recommendations.map((x, i) => <div key={i} style={{ marginBottom: 12 }}><strong>{x.course_title}</strong> <span style={{ color: "#08718a", fontSize: 12 }}>· {x.priority}</span><p style={{ margin: "5px 0 0", lineHeight: 1.55 }}>{x.reason}</p></div>)}<p style={{ fontSize: 13, color: "#64748b", marginBottom: 0 }}>Suggestions are AI-generated. Check the actual RuffNeck Learn catalog before enrolling; course availability is not automatically verified.</p></div>}
        {!!result.practical_projects?.length && <div style={card}><h3 style={heading}>Portfolio projects to build</h3>{result.practical_projects.map((x, i) => <div key={i} style={{ marginBottom: 12 }}><strong>{x.title}</strong><p style={{ margin: "5px 0", lineHeight: 1.55 }}>{x.brief}</p><small style={{ color: "#53667b" }}>Skills: {x.skills_practiced?.join(", ")}</small></div>)}</div>}
        {!!result.interview_topics?.length && <div style={card}><h3 style={heading}>Interview topics to prepare</h3><ul style={list}>{result.interview_topics.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        {result.disclaimer && <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{result.disclaimer}</p>}
      </section>}
    </main>
  );
}
