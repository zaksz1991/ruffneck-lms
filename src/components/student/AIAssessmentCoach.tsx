"use client";

import { FormEvent, useState } from "react";

type Mode = "hint" | "feedback" | "review" | "practice";
const ACTIONS: Array<{ value: Mode; label: string; description: string }> = [
  { value: "hint", label: "Give me a hint", description: "A nudge without the full answer" },
  { value: "feedback", label: "Review my attempt", description: "What is correct and what needs work" },
  { value: "review", label: "Self-review checklist", description: "Check your response against key criteria" },
  { value: "practice", label: "Similar practice question", description: "Try another question without its answer" },
];

type Props = { courseTitle?: string; initialTopic?: string };
export default function AIAssessmentCoach({ courseTitle = "General study", initialTopic = "" }: Props) {
  const [topic, setTopic] = useState(initialTopic);
  const [question, setQuestion] = useState("");
  const [learnerAnswer, setLearnerAnswer] = useState("");
  const [mode, setMode] = useState<Mode>("hint");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setAnswer("");
    try {
      const response = await fetch("/api/student/ai-assessment-coach", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseTitle, topic, question, learnerAnswer, mode }),
      });
      const data = await response.json().catch(() => ({})) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "The coach could not respond. Please try again.");
      setAnswer(data.answer);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reach the coach."); }
    finally { setBusy(false); }
  }

  return (
    <section className="rac-wrap" aria-labelledby="rac-title">
      <style>{`
        .rac-wrap{--rac-navy:#0b1e3a;--rac-cyan:#00b4d8;color:#17243a;background:#fff;border:1px solid #dce5ef;border-radius:18px;overflow:hidden;font-family:inherit}
        .rac-head{background:linear-gradient(120deg,#0b1e3a,#123b60);color:#fff;padding:22px 24px}.rac-head h2{font-size:1.35rem;margin:0 0 7px}.rac-head p{margin:0;color:#d8e8f5;line-height:1.5;font-size:.94rem}
        .rac-body{padding:22px;display:grid;gap:16px}.rac-field{display:grid;gap:7px}.rac-field label,.rac-label{font-weight:700;font-size:.9rem}.rac-field input,.rac-field textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;font:inherit;color:#17243a;background:#fff}.rac-field textarea{min-height:100px;resize:vertical}.rac-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.rac-mode{display:flex;gap:10px;text-align:left;align-items:flex-start;padding:12px;border:1px solid #d4deea;border-radius:11px;background:#fff;color:#17243a;cursor:pointer}.rac-mode[aria-pressed=true]{border-color:#00a5c8;background:#eafaff;box-shadow:0 0 0 1px #00a5c8}.rac-mode strong{display:block;font-size:.9rem}.rac-mode small{display:block;margin-top:4px;color:#5d6c80;line-height:1.4}.rac-radio{margin-top:3px;accent-color:#00a5c8}.rac-submit{border:0;border-radius:10px;padding:12px 16px;background:#00b4d8;color:#06263a;font-weight:800;cursor:pointer}.rac-submit:disabled{opacity:.6;cursor:wait}.rac-notice{border-radius:10px;padding:12px 14px;background:#fff7e6;border:1px solid #f4d58d;color:#694b0a;font-size:.88rem;line-height:1.5}.rac-error{color:#a11b1b;background:#fff1f1;border:1px solid #f1baba;border-radius:10px;padding:11px}.rac-result{white-space:pre-wrap;line-height:1.7;border:1px solid #d9e6ef;border-radius:12px;padding:16px;background:#f7fbff;overflow-wrap:anywhere}.rac-result h3{margin:0 0 8px;font-size:1rem;color:#0b1e3a}@media(max-width:560px){.rac-modes{grid-template-columns:1fr}.rac-body{padding:16px}.rac-head{padding:18px}}
      `}</style>
      <header className="rac-head"><h2 id="rac-title">AI Assessment Coach</h2><p>Build your understanding, review your own attempts, and practise independently. The coach supports learning rather than completing graded work for you.</p></header>
      <form className="rac-body" onSubmit={submit}>
        <div className="rac-notice">Do not paste private information. For live, timed, or graded assessments, the coach will provide learning guidance rather than solve the question.</div>
        <div className="rac-field"><label htmlFor="rac-topic">Topic or skill</label><input id="rac-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={240} placeholder="e.g. Excel formulas, AI literacy, data interpretation" required /></div>
        <div className="rac-field"><label htmlFor="rac-question">Practice question or concept</label><textarea id="rac-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={6000} placeholder="Enter a practice question or describe the concept you are working on." required /></div>
        <div className="rac-field"><label htmlFor="rac-attempt">Your attempt (recommended for feedback)</label><textarea id="rac-attempt" value={learnerAnswer} onChange={(event) => setLearnerAnswer(event.target.value)} maxLength={6000} placeholder="Explain your reasoning or enter your own attempt." /></div>
        <div className="rac-field"><span className="rac-label">Choose coaching support</span><div className="rac-modes">{ACTIONS.map((action) => <button type="button" key={action.value} className="rac-mode" aria-pressed={mode === action.value} onClick={() => setMode(action.value)}><input className="rac-radio" type="radio" checked={mode === action.value} readOnly aria-label={action.label} /><span><strong>{action.label}</strong><small>{action.description}</small></span></button>)}</div></div>
        <button className="rac-submit" type="submit" disabled={busy}>{busy ? "Preparing guidance…" : "Get coaching"}</button>
        {error && <div className="rac-error" role="alert">{error}</div>}
        {answer && <div className="rac-result" aria-live="polite"><h3>Coaching feedback</h3>{answer}</div>}
      </form>
    </section>
  );
}
