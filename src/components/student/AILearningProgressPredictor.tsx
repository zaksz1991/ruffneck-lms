"use client";

import { FormEvent, useState } from "react";

type Week = { week: string; focus: string; hours: number; checkpoint: string };
type Analysis = {
  status: "On track" | "At risk" | "Needs more data";
  headline: string;
  confidence: "Low" | "Moderate" | "Higher";
  completionPercent: number;
  lessonsRemaining: number;
  requiredLessonsPerWeek: number;
  observedHoursPerWeek: number;
  paceAssessment: string;
  risks: string[];
  recommendations: string[];
  weeklyPlan: Week[];
  assumptions: string[];
  nextAction: string;
};

const panel: React.CSSProperties = { background: "#102744", border: "1px solid #24415f", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "11px 12px", background: "#081a30", color: "#f1f5f9", border: "1px solid #35516e", borderRadius: 9, marginTop: 6, boxSizing: "border-box" };
const label: React.CSSProperties = { display: "block", color: "#dbeafe", fontSize: 13, fontWeight: 600, marginBottom: 12 };
const button: React.CSSProperties = { border: 0, borderRadius: 9, padding: "12px 16px", fontWeight: 700, cursor: "pointer", background: "#00b4d8", color: "#062038" };

export default function AILearningProgressPredictor() {
  const [course, setCourse] = useState("");
  const [completed, setCompleted] = useState("4");
  const [total, setTotal] = useState("20");
  const [daysLeft, setDaysLeft] = useState("30");
  const [goalDate, setGoalDate] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("4");
  const [recentHours, setRecentHours] = useState("3");
  const [weeksObserved, setWeeksObserved] = useState("2");
  const [notes, setNotes] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setAnalysis(null);
    try {
      const response = await fetch("/api/student/ai-learning-progress-predictor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course, completedLessons: Number(completed), totalLessons: Number(total), daysLeft: Number(daysLeft), goalDate, weeklyHours: Number(weeklyHours), recentHours: Number(recentHours), weeksObserved: Number(weeksObserved), notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not analyze progress.");
      setAnalysis(data.result as Analysis);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not analyze progress."); }
    finally { setLoading(false); }
  }

  function exportReport() {
    if (!analysis) return;
    const lines = ["RuffNeck Learn — Learning Progress Review", `Course/goal: ${course}`, `Status: ${analysis.status}`, `Confidence: ${analysis.confidence}`, `Completion: ${analysis.completionPercent}%`, `Lessons remaining: ${analysis.lessonsRemaining}`, `Required pace: ${analysis.requiredLessonsPerWeek} lessons/week`, `Observed study time: ${analysis.observedHoursPerWeek} hours/week`, "", analysis.headline, "", "PACE ASSESSMENT", analysis.paceAssessment, "", "RISKS", ...analysis.risks.map(x => `- ${x}`), "", "RECOMMENDATIONS", ...analysis.recommendations.map(x => `- ${x}`), "", "WEEKLY PLAN", ...analysis.weeklyPlan.map(w => `${w.week}: ${w.focus} (${w.hours} hours). Checkpoint: ${w.checkpoint}`), "", "ASSUMPTIONS", ...analysis.assumptions.map(x => `- ${x}`), "", `NEXT ACTION: ${analysis.nextAction}`, "", "This is an AI-generated estimate, not a guarantee. Verify against actual course requirements and update with new activity data."];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "ruffneck-learning-progress-review.txt"; a.click(); URL.revokeObjectURL(url);
  }

  const statusColor = analysis?.status === "On track" ? "#86efac" : analysis?.status === "At risk" ? "#fca5a5" : "#fde68a";

  return <main style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px 48px", color: "#f1f5f9" }}>
    <header style={{ marginBottom: 22 }}><div style={{ color: "#00b4d8", fontWeight: 800, letterSpacing: 1.5, fontSize: 12 }}>RUFFNECK LEARN · LEARNING ANALYTICS</div><h1 style={{ fontSize: "clamp(27px, 4vw, 38px)", margin: "8px 0", lineHeight: 1.15 }}>AI Learning Progress Predictor</h1><p style={{ color: "#b8c9dc", maxWidth: 760, lineHeight: 1.6, margin: 0 }}>Review your current progress, recent study time, and target date to estimate whether your plan is realistic and identify useful adjustments.</p></header>
    <div style={{ ...panel, marginBottom: 16, borderColor: "#31506d" }}><strong style={{ color: "#fbbf24" }}>Important</strong><p style={{ color: "#cbd5e1", margin: "7px 0 0", lineHeight: 1.55, fontSize: 13 }}>This is an AI-assisted estimate based on the figures you enter—not a guaranteed prediction or an automatic reading of your LMS history. Enter accurate activity data and update it as you progress.</p></div>
    <form onSubmit={submit} style={panel}>
      <h2 style={{ fontSize: 19, margin: "0 0 16px" }}>Your learning data</h2>
      <label style={label}>Course or learning goal<input style={input} value={course} onChange={e => setCourse(e.target.value)} required minLength={2} maxLength={160} placeholder="e.g. AI Literacy or Python fundamentals" /></label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <label style={label}>Lessons completed<input style={input} type="number" min="0" step="1" value={completed} onChange={e => setCompleted(e.target.value)} required /></label>
        <label style={label}>Total lessons<input style={input} type="number" min="1" step="1" value={total} onChange={e => setTotal(e.target.value)} required /></label>
        <label style={label}>Days until target<input style={input} type="number" min="1" max="3650" value={daysLeft} onChange={e => setDaysLeft(e.target.value)} required /></label>
        <label style={label}>Target date (optional)<input style={input} type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} /></label>
        <label style={label}>Planned hours per week<input style={input} type="number" min="1" max="60" step="0.5" value={weeklyHours} onChange={e => setWeeklyHours(e.target.value)} required /></label>
        <label style={label}>Hours studied recently<input style={input} type="number" min="0" max="168" step="0.5" value={recentHours} onChange={e => setRecentHours(e.target.value)} required /></label>
        <label style={label}>Weeks in recent window<select style={input} value={weeksObserved} onChange={e => setWeeksObserved(e.target.value)}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n} {n === 1 ? "week" : "weeks"}</option>)}</select></label>
      </div>
      <label style={{ ...label, marginTop: 4 }}>Context (optional)<textarea style={{ ...input, minHeight: 90, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1200} placeholder="For example: work schedule, difficult topics, upcoming exams, or interruptions." /></label>
      <button type="submit" disabled={loading} style={{ ...button, opacity: loading ? 0.65 : 1 }}>{loading ? "Reviewing your progress…" : "Analyze my progress"}</button>
      {error && <p role="alert" style={{ color: "#fca5a5", marginBottom: 0 }}>{error}</p>}
    </form>

    {analysis && <section aria-live="polite" style={{ marginTop: 20 }}>
      <div style={{ ...panel, borderColor: statusColor, marginBottom: 14 }}><div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}><span style={{ color: statusColor, fontWeight: 800, fontSize: 14 }}>{analysis.status.toUpperCase()}</span><span style={{ color: "#b8c9dc", fontSize: 12 }}>Confidence: {analysis.confidence}</span></div><h2 style={{ fontSize: 23, margin: "10px 0" }}>{analysis.headline}</h2><div style={{ height: 8, background: "#07182b", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(0, Math.min(100, analysis.completionPercent))}%`, background: "#00b4d8" }} /></div><p style={{ color: "#b8c9dc", fontSize: 13 }}>{analysis.completionPercent}% complete · {analysis.lessonsRemaining} lessons remaining · target pace {analysis.requiredLessonsPerWeek} lessons/week · observed {analysis.observedHoursPerWeek} study hours/week</p><p style={{ lineHeight: 1.6 }}>{analysis.paceAssessment}</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
        <div style={panel}><h3 style={{ marginTop: 0 }}>Risks to watch</h3>{analysis.risks.length ? <ul style={{ paddingLeft: 20, lineHeight: 1.65, color: "#dbeafe" }}>{analysis.risks.map((x,i)=><li key={i}>{x}</li>)}</ul> : <p>No specific risks listed.</p>}</div>
        <div style={panel}><h3 style={{ marginTop: 0 }}>Recommended adjustments</h3><ul style={{ paddingLeft: 20, lineHeight: 1.65, color: "#dbeafe" }}>{analysis.recommendations.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
      </div>
      <div style={{ ...panel, marginTop: 14 }}><h3 style={{ marginTop: 0 }}>Suggested four-week plan</h3><div style={{ display: "grid", gap: 10 }}>{analysis.weeklyPlan.map((w,i)=><article key={i} style={{ border: "1px solid #294763", borderRadius: 10, padding: 13 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>{w.week}</strong><span style={{ color: "#67e8f9", fontSize: 13 }}>{w.hours} hours</span></div><p style={{ margin: "8px 0", lineHeight: 1.5 }}>{w.focus}</p><p style={{ margin: 0, color: "#b8c9dc", fontSize: 13 }}>Checkpoint: {w.checkpoint}</p></article>)}</div><h3>Assumptions and limits</h3><ul style={{ paddingLeft: 20, lineHeight: 1.6, color: "#b8c9dc" }}>{analysis.assumptions.map((x,i)=><li key={i}>{x}</li>)}</ul><div style={{ borderLeft: "3px solid #00b4d8", padding: "10px 12px", background: "#0a2037", borderRadius: "0 8px 8px 0", marginTop: 14 }}><strong>Next action</strong><p style={{ margin: "5px 0 0", lineHeight: 1.5 }}>{analysis.nextAction}</p></div><button type="button" onClick={exportReport} style={{ ...button, marginTop: 16 }}>Download progress report (.txt)</button><button type="button" onClick={() => window.print()} style={{ ...button, marginTop: 16, marginLeft: 10, background: "#dbeafe" }}>Print / Save as PDF</button></div>
      <p style={{ color: "#91a8c0", fontSize: 12, lineHeight: 1.5 }}>Use this review as a planning aid. Actual completion depends on lesson difficulty, assessment results, course requirements, and time available. Reassess with updated figures rather than relying on one estimate.</p>
    </section>}
  </main>;
}
