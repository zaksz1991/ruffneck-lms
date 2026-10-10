"use client";

import { FormEvent, useState } from "react";

type Resource = {
  title: string;
  type: string;
  provider: string;
  url: string;
  level: string;
  estimatedTime: string;
  whyItFits: string;
  action: string;
  verification: "verified" | "check";
};
type Plan = { summary: string; resources: Resource[]; weeklyPlan: string[]; searchTerms: string[]; cautions: string[] };

const panel: React.CSSProperties = { background: "#102744", border: "1px solid #24415f", borderRadius: 14, padding: 18 };
const input: React.CSSProperties = { width: "100%", padding: "11px 12px", background: "#081a30", color: "#f1f5f9", border: "1px solid #35516e", borderRadius: 9, marginTop: 6 };

export default function AILearningResourceRecommender() {
  const [goal, setGoal] = useState("");
  const [skills, setSkills] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [hours, setHours] = useState("4");
  const [language, setLanguage] = useState("English");
  const [topics, setTopics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setPlan(null);
    try {
      const response = await fetch("/api/student/ai-learning-resource-recommender", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, skills, level, hoursPerWeek: Number(hours), language, topics }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate recommendations. Please try again.");
      setPlan(data.plan as Plan);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setLoading(false); }
  }

  function exportText() {
    if (!plan) return;
    const text = ["RUFFNECK LEARN — LEARNING RESOURCE PLAN", "", plan.summary, "", "RECOMMENDED RESOURCES", ...plan.resources.map((r, i) => `${i + 1}. ${r.title} (${r.type})\nProvider: ${r.provider}\nLink: ${r.url}\nLevel: ${r.level}; Time: ${r.estimatedTime}\nWhy: ${r.whyItFits}\nNext action: ${r.action}\nLink status: ${r.verification === "verified" ? "Verified official/resource URL" : "Check URL and availability"}`), "", "WEEKLY PLAN", ...plan.weeklyPlan.map((x, i) => `${i + 1}. ${x}`), "", "SEARCH TERMS", ...plan.searchTerms.map(x => `- ${x}`), "", "CHECK BEFORE USING", ...plan.cautions.map(x => `- ${x}`)].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "ruffneck-learning-resource-plan.txt"; a.click(); URL.revokeObjectURL(url);
  }

  return <main style={{ minHeight: "100vh", background: "#081a30", color: "#e8f0fa", padding: "28px 16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}><div style={{ color: "#00b4d8", fontWeight: 700, letterSpacing: 1.5, fontSize: 12 }}>RUFFNECK LEARN · STUDY TOOLS</div><h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", margin: "10px 0" }}>AI Learning Resource Recommender</h1><p style={{ color: "#b8c9dc", lineHeight: 1.65, maxWidth: 760 }}>Build a focused learning list around your career goal, current skills, preferred language, and available study time. External resources are suggestions—not endorsements—and links should be checked before use.</p></header>
      <form onSubmit={submit} style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
        <label style={{ fontSize: 14 }}>Career or learning goal<input style={input} required minLength={3} maxLength={180} value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Become a junior data analyst" /></label>
        <label style={{ fontSize: 14 }}>Current skills and experience<textarea style={{ ...input, minHeight: 92, resize: "vertical" }} required maxLength={1600} value={skills} onChange={e => setSkills(e.target.value)} placeholder="List skills you already have and what you have tried" /></label>
        <label style={{ fontSize: 14 }}>Current level<select style={input} value={level} onChange={e => setLevel(e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Career changer</option></select></label>
        <label style={{ fontSize: 14 }}>Study time per week<select style={input} value={hours} onChange={e => setHours(e.target.value)}>{["1","2","3","4","5","6","8","10","12","15"].map(v => <option key={v} value={v}>{v} hours</option>)}</select></label>
        <label style={{ fontSize: 14 }}>Preferred language<select style={input} value={language} onChange={e => setLanguage(e.target.value)}>{["English","Hausa","Yoruba","Igbo","Swahili"].map(v => <option key={v}>{v}</option>)}</select></label>
        <label style={{ fontSize: 14 }}>Topics to prioritize (optional)<textarea style={{ ...input, minHeight: 92, resize: "vertical" }} maxLength={800} value={topics} onChange={e => setTopics(e.target.value)} placeholder="e.g. Excel, SQL, dashboards, portfolio" /></label>
        <div style={{ gridColumn: "1 / -1" }}><button disabled={loading} type="submit" style={{ border: 0, borderRadius: 9, padding: "13px 20px", background: loading ? "#58758d" : "#00b4d8", color: "#06182b", fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>{loading ? "Building your resource plan…" : "Recommend learning resources"}</button>{error && <p role="alert" style={{ color: "#ffb4b4", marginBottom: 0 }}>{error}</p>}</div>
      </form>
      {plan && <section aria-live="polite" style={{ marginTop: 24 }}>
        <div style={panel}><h2 style={{ marginTop: 0 }}>Your learning plan</h2><p style={{ lineHeight: 1.7, color: "#c9d7e6" }}>{plan.summary}</p><button onClick={exportText} type="button" style={{ background: "transparent", border: "1px solid #00b4d8", borderRadius: 8, padding: "9px 13px", color: "#75e5f5", cursor: "pointer" }}>Download plan (.txt)</button></div>
        <h2 style={{ margin: "24px 0 12px" }}>Recommended resources</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}>{plan.resources.map((r, i) => <article key={`${r.title}-${i}`} style={panel}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{r.title}</h3><span style={{ color: r.verification === "verified" ? "#7ee0b1" : "#f8d38b", fontSize: 11, whiteSpace: "nowrap" }}>{r.verification === "verified" ? "Official link" : "Check link"}</span></div><p style={{ color: "#00b4d8", margin: "0 0 8px", fontSize: 13 }}>{r.provider} · {r.type}</p><p style={{ color: "#c2d1e1", lineHeight: 1.55 }}>{r.whyItFits}</p><p style={{ fontSize: 13, color: "#b8c9dc" }}>Level: {r.level} · Time: {r.estimatedTime}</p><p style={{ lineHeight: 1.55 }}><strong>Next action:</strong> {r.action}</p>{r.url && <a href={r.url} target="_blank" rel="noreferrer noopener" style={{ color: "#75e5f5", overflowWrap: "anywhere" }}>Open resource ↗</a>}</article>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 18 }}><div style={panel}><h2 style={{ marginTop: 0 }}>Weekly sequence</h2><ol style={{ paddingLeft: 22, lineHeight: 1.7 }}>{plan.weeklyPlan.map((x, i) => <li key={i} style={{ marginBottom: 8 }}>{x}</li>)}</ol></div><div style={panel}><h2 style={{ marginTop: 0 }}>Search terms</h2><ul style={{ paddingLeft: 22, lineHeight: 1.7 }}>{plan.searchTerms.map((x, i) => <li key={i}>{x}</li>)}</ul><h3>Before you start</h3><ul style={{ paddingLeft: 22, lineHeight: 1.6 }}>{plan.cautions.map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>
      </section>}
      <footer style={{ marginTop: 28, color: "#8198b1", fontSize: 12, lineHeight: 1.6 }}>Recommendations may contain errors or outdated details. Confirm provider, price, access requirements, and link destination. Do not submit private or sensitive information to external learning services.</footer>
    </div>
  </main>;
}
