"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Practice = { title: string; area: string; level: string; task: string; tip: string };

const practices: Practice[] = [
  { title: "Write a reliable prompt", area: "Prompt Engineering", level: "Beginner", task: "A small business owner wants an AI assistant to draft a polite response to a customer whose delivery is late. Write a prompt that gives the AI the role, context, tone, constraints, and expected output format.", tip: "A strong prompt includes context, audience, constraints, and a clear output format." },
  { title: "Improve a business email", area: "AI-Assisted Writing", level: "Beginner", task: "Draft a professional email to a supplier asking for an update on an overdue order. Keep it courteous, specific, and action-oriented. Include a useful subject line.", tip: "State the purpose early, include relevant facts, and make the next action clear." },
  { title: "Analyse a simple sales table", area: "Data Analysis", level: "Intermediate", task: "A shop recorded monthly sales of ₦120,000, ₦150,000, ₦135,000, and ₦195,000 over four months. Calculate the total, average monthly sales, and percentage change from month one to month four. Explain what the figures do and do not tell the owner.", tip: "Show your working, label units, and distinguish an observation from a conclusion." },
  { title: "Build an Excel formula", area: "Excel and Reporting", level: "Beginner", task: "In Excel, column B contains quantity and column C contains unit price. Write a formula in D2 to calculate line total, explain how to fill it down, and describe one validation check you would use.", tip: "Use cell references instead of hard-coded numbers and verify a sample row manually." },
  { title: "Plan a digital campaign", area: "Digital Marketing", level: "Intermediate", task: "Create a one-week social media campaign for a local training centre promoting a beginner computer-skills class. Include audience, objective, three post ideas, a call to action, and two metrics to monitor.", tip: "Tie each post to an audience need and a measurable campaign objective." },
  { title: "Design a lesson activity", area: "Teaching and Lesson Planning", level: "Intermediate", task: "Design a 30-minute lesson introducing spreadsheet formulas to adult beginners. Include a measurable learning objective, materials, a short demonstration, a hands-on activity, and an exit ticket to check understanding.", tip: "Make the objective observable and align the assessment with what learners practise." },
  { title: "Improve a records workflow", area: "Records Management", level: "Intermediate", task: "A small office stores invoices in different folders and sometimes cannot find them. Propose a simple digital filing and naming convention, access-control approach, backup routine, and retrieval procedure.", tip: "Balance findability with privacy, permissions, retention, and reliable backups." },
  { title: "Prioritise office work", area: "Office Administration", level: "Beginner", task: "You have three tasks: submit a report due in one hour, reply to a non-urgent email, and organise next week's meeting. Explain the order you would use, what information you would confirm, and how you would communicate any delay.", tip: "Prioritise by urgency, impact, dependencies, and deadline; communicate risks early." },
  { title: "Solve a business problem", area: "Business Problem Solving", level: "Intermediate", task: "A small retailer says repeat customers have decreased, but has not collected evidence about why. Outline a practical process to investigate the issue, identify likely causes, test one improvement, and measure whether it worked.", tip: "Separate symptoms from causes and define a measurable baseline before testing changes." },
];

const areas = [...new Set(practices.map((item) => item.area))];
const languages = ["English", "Hausa", "Yoruba", "Igbo"];

export default function PracticeStudio() {
  const [area, setArea] = useState(practices[0].area);
  const [level, setLevel] = useState("Beginner");
  const [language, setLanguage] = useState("English");
  const [attempt, setAttempt] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTip, setShowTip] = useState(false);

  const options = useMemo(() => practices.filter((item) => item.area === area), [area]);
  const [selectedTitle, setSelectedTitle] = useState(practices[0].title);
  const current = options.find((item) => item.title === selectedTitle) || options[0];

  function changeArea(nextArea: string) {
    const next = practices.find((item) => item.area === nextArea)!;
    setArea(nextArea);
    setSelectedTitle(next.title);
    setAttempt("");
    setFeedback("");
    setError("");
    setShowTip(false);
  }

  async function reviewAttempt() {
    setError("");
    setFeedback("");
    if (!attempt.trim()) {
      setError("Write your attempt before requesting feedback.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/student/practice-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, level, language, task: current.task, response: attempt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not review your attempt.");
      setFeedback(result.feedback || "No feedback was returned.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not review your attempt.");
    } finally {
      setLoading(false);
    }
  }

  function copyFeedback() {
    if (feedback && navigator.clipboard) void navigator.clipboard.writeText(feedback);
  }

  return (
    <main className="practice-page">
      <style>{`
        .practice-page{min-height:100vh;background:#f3f7fb;color:#13243b;padding:clamp(18px,4vw,42px);font-family:Arial,Helvetica,sans-serif}
        .ps-wrap{max-width:1120px;margin:auto}.ps-hero{background:#0b1e3a;color:#fff;border-radius:22px;padding:clamp(24px,4vw,42px);position:relative;overflow:hidden}
        .ps-hero:after{content:"";position:absolute;width:280px;height:280px;border:1px solid #00b4d844;border-radius:50%;right:-75px;top:-130px;box-shadow:0 0 0 32px #00b4d811,0 0 0 64px #00b4d808;pointer-events:none}
        .ps-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.15em;font-weight:800;color:#67e8f9}.ps-hero h1{font-size:clamp(29px,4vw,43px);letter-spacing:-.04em;margin:12px 0}.ps-hero p{max-width:700px;color:#d0dbea;line-height:1.65;font-size:14px;margin:0}
        .ps-links{display:flex;gap:9px;flex-wrap:wrap;margin-top:22px}.ps-link{display:inline-flex;padding:10px 13px;border-radius:10px;text-decoration:none;background:#ffffff12;border:1px solid #ffffff2c;color:white;font-size:12px;font-weight:700}.ps-link.main{background:#00b4d8;border-color:#00b4d8;color:#06243b}
        .ps-grid{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:18px;margin-top:20px;align-items:start}.ps-card{background:white;border:1px solid #e0e8f0;border-radius:18px;padding:22px;box-shadow:0 7px 22px #0b1e3a08}.ps-card h2{font-size:18px;margin:0 0 7px}.ps-muted{font-size:12px;color:#64748b;line-height:1.6;margin:0 0 18px}.ps-label{display:block;font-size:12px;font-weight:800;margin:16px 0 7px}.ps-select,.ps-textarea{box-sizing:border-box;width:100%;border:1px solid #cbd5e1;border-radius:11px;padding:12px;background:#fff;color:#13243b;font:inherit;font-size:13px;outline:none}.ps-select:focus,.ps-textarea:focus{border-color:#00a4c7;box-shadow:0 0 0 3px #00b4d81c}.ps-task{border-radius:13px;background:#f2f8fb;border:1px solid #dceef4;padding:16px;font-size:13px;line-height:1.7;white-space:pre-wrap}.ps-tip{font-size:12px;line-height:1.6;color:#53677e;background:#fff9e8;border:1px solid #f4e4b5;border-radius:10px;padding:12px;margin-top:12px}.ps-btn{display:inline-flex;justify-content:center;align-items:center;border:0;border-radius:11px;padding:12px 16px;background:#0b1e3a;color:#fff;font-size:13px;font-weight:800;cursor:pointer}.ps-btn:disabled{opacity:.55;cursor:wait}.ps-btn.alt{background:#eaf8fb;color:#087f9e;border:1px solid #ccecf3}.ps-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.ps-error{margin-top:12px;padding:12px;border:1px solid #fecdd3;border-radius:10px;background:#fff1f2;color:#9f1239;font-size:12px;line-height:1.5}.ps-feedback{margin-top:18px;padding:18px;border-radius:13px;background:#f7fafc;border:1px solid #dfe8ef}.ps-feedback h3{font-size:15px;margin:0 0 12px}.ps-feedback-body{font-size:13px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}.ps-note{font-size:11px;color:#718096;line-height:1.6;margin-top:14px}.ps-textarea{min-height:210px;resize:vertical;line-height:1.65}.ps-count{text-align:right;font-size:11px;color:#718096;margin-top:5px}
        @media(max-width:800px){.ps-grid{grid-template-columns:1fr}.ps-card{padding:18px}}@media(max-width:450px){.ps-hero{border-radius:16px}.ps-links{display:grid;grid-template-columns:1fr 1fr}.ps-link{justify-content:center;text-align:center}.ps-row .ps-btn{width:100%}}
      `}</style>
      <div className="ps-wrap">
        <header className="ps-hero">
          <div className="ps-eyebrow">RuffNeck Learn · Guided skill practice</div>
          <h1>AI Practice Studio</h1>
          <p>Practise real professional tasks, submit your attempt for formative AI feedback, and improve through repetition. This is a learning aid, not a formal assessment or certification.</p>
          <div className="ps-links">
            <Link className="ps-link main" href="/student/learning-path">Personalized learning path</Link>
            <Link className="ps-link" href="/student/labs">Practical Learning Lab</Link>
            <Link className="ps-link" href="/student/competencies">Competency dashboard</Link>
            <Link className="ps-link" href="/student/courses">My learning</Link>
          </div>
        </header>

        <div className="ps-grid">
          <section className="ps-card">
            <h2>1. Choose a practice</h2>
            <p className="ps-muted">Pick a skill area and work through the task at your own pace.</p>
            <label className="ps-label" htmlFor="ps-area">Skill area</label>
            <select id="ps-area" className="ps-select" value={area} onChange={(event) => changeArea(event.target.value)}>
              {areas.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="ps-label" htmlFor="ps-task">Practice task</label>
            <select id="ps-task" className="ps-select" value={current.title} onChange={(event) => { setSelectedTitle(event.target.value); setFeedback(""); setError(""); setShowTip(false); }}>
              {options.map((item) => <option key={item.title} value={item.title}>{item.title}</option>)}
            </select>
            <label className="ps-label" htmlFor="ps-level">Your current level</label>
            <select id="ps-level" className="ps-select" value={level} onChange={(event) => setLevel(event.target.value)}>
              <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
            </select>
            <label className="ps-label" htmlFor="ps-language">Feedback language</label>
            <select id="ps-language" className="ps-select" value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languages.map((item) => <option key={item}>{item}</option>)}
            </select>
            <label className="ps-label">Your task</label>
            <div className="ps-task">{current.task}</div>
            <div className="ps-row">
              <button type="button" className="ps-btn alt" onClick={() => setShowTip((value) => !value)}>{showTip ? "Hide hint" : "Show hint"}</button>
            </div>
            {showTip && <div className="ps-tip">{current.tip}</div>}
          </section>

          <section className="ps-card">
            <h2>2. Submit your attempt</h2>
            <p className="ps-muted">Explain your reasoning where useful. Your attempt is sent to the configured Gemini API for feedback and is not saved to a portfolio by this feature.</p>
            <label className="ps-label" htmlFor="ps-attempt">Your answer or work</label>
            <textarea id="ps-attempt" className="ps-textarea" maxLength={12000} value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="Write your answer here. For a spreadsheet task, include the formula and explain how you would check it…" />
            <div className="ps-count">{attempt.length.toLocaleString()} / 12,000 characters</div>
            {error && <div className="ps-error" role="alert">{error}</div>}
            <div className="ps-row">
              <button type="button" className="ps-btn" disabled={loading} onClick={() => void reviewAttempt()}>{loading ? "Reviewing your attempt…" : "Get AI feedback"}</button>
              <button type="button" className="ps-btn alt" onClick={() => { setAttempt(""); setFeedback(""); setError(""); }}>Clear work</button>
            </div>
            {feedback && <div className="ps-feedback" aria-live="polite"><h3>Feedback on your attempt</h3><div className="ps-feedback-body">{feedback}</div><div className="ps-row"><button type="button" className="ps-btn alt" onClick={copyFeedback}>Copy feedback</button><button type="button" className="ps-btn" onClick={() => { setAttempt(""); setFeedback(""); setError(""); }}>Try again</button></div></div>}
            <p className="ps-note">AI feedback can be incorrect or incomplete. Review suggestions critically, verify calculations, and avoid entering confidential, personal, or sensitive information.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
