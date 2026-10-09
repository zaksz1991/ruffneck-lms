"use client";

import { useState } from "react";

type Assessment = {
  id: string;
  title: string;
  area: string;
  level: string;
  task: string;
  criteria: string[];
};

type Review = {
  attemptId?: string;
  score: number;
  result: string;
  criteria: { name: string; score: number; feedback: string }[];
  strengths: string[];
  improvements: string[];
  nextStep: string;
  disclaimer: string;
};

const ASSESSMENTS: Assessment[] = [
  {
    id: "prompt-design",
    title: "Design a reliable AI prompt",
    area: "Prompt Engineering",
    level: "Beginner",
    task: "Write a reusable prompt that asks an AI assistant to draft a professional weekly operations report. The report must separate verified facts from assumptions, summarise key figures, flag missing information, and use clear headings. Include the role, context, inputs, constraints, and expected output format.",
    criteria: ["Clear objective and context", "Useful inputs and constraints", "Specific output format", "Accuracy and uncertainty safeguards"],
  },
  {
    id: "business-report",
    title: "Prepare an executive report outline",
    area: "Office Administration",
    level: "Intermediate",
    task: "A small distribution business experienced delayed deliveries, incomplete stock records, and an increase in customer complaints last month. Prepare an executive report outline with an issue summary, evidence to collect, root-cause investigation, practical recommendations, responsible roles, and measurable follow-up indicators. Do not invent figures.",
    criteria: ["Logical structure", "Evidence-based reasoning", "Actionable recommendations", "Measurable follow-up"],
  },
  {
    id: "data-quality",
    title: "Plan a spreadsheet data-quality check",
    area: "Excel and Reporting",
    level: "Intermediate",
    task: "You receive a spreadsheet containing customer names, phone numbers, order dates, quantities, unit prices, and order totals. Describe a practical validation workflow to find missing values, duplicate orders, invalid dates, non-numeric quantities, and totals that do not equal quantity multiplied by unit price. Include example Excel formulas where useful.",
    criteria: ["Coverage of data-quality risks", "Correct validation methods", "Appropriate formulas", "Repeatable review process"],
  },
  {
    id: "lesson-plan",
    title: "Build an outcomes-based lesson plan",
    area: "Teaching and Lesson Planning",
    level: "Intermediate",
    task: "Create a 40-minute lesson plan that teaches beginners how to identify phishing messages. Include measurable learning outcomes, an opening activity, explanation, guided practice, an individual assessment, materials, accessibility considerations, and a short reflection. Do not ask learners to open suspicious links.",
    criteria: ["Measurable learning outcomes", "Practical lesson sequence", "Assessment alignment", "Safety and accessibility"],
  },
  {
    id: "records-workflow",
    title: "Design a digital records workflow",
    area: "Records Management",
    level: "Intermediate",
    task: "Design a digital filing and retrieval workflow for a small office that stores invoices, staff records, supplier documents, and correspondence. Cover naming conventions, folder structure, access permissions, retention review, backups, version control, and a simple retrieval test. Avoid exposing confidential personal data.",
    criteria: ["Consistent classification and naming", "Access and confidentiality controls", "Retention and backup controls", "Retrieval and auditability"],
  },
];

export default function PracticeAssessmentStudio() {
  const [selectedId, setSelectedId] = useState(ASSESSMENTS[0].id);
  const [answer, setAnswer] = useState("");
  const [language, setLanguage] = useState("English");
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const assessment = ASSESSMENTS.find((item) => item.id === selectedId) ?? ASSESSMENTS[0];

  function selectAssessment(id: string) {
    setSelectedId(id);
    setAnswer("");
    setReview(null);
    setError("");
  }

  async function submit() {
    setError("");
    setReview(null);
    if (answer.trim().length < 30) {
      setError("Write a more complete attempt before requesting a review (at least 30 characters). ");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/student/assessment-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: assessment.id, answer: answer.trim(), language }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Assessment review failed.");
      setReview(payload.review as Review);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not review this attempt. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pas-page">
      <style>{`
        .pas-page{min-height:100vh;background:#f3f7fb;color:#13243b;padding:clamp(16px,4vw,40px);font-family:Arial,Helvetica,sans-serif}
        .pas-wrap{max-width:1160px;margin:auto}.pas-eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#0785a4}
        .pas-title{font-size:clamp(28px,4vw,42px);letter-spacing:-.04em;margin:9px 0}.pas-sub{max-width:760px;color:#64748b;line-height:1.65;margin:0 0 24px}
        .pas-grid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px}.pas-card{background:white;border:1px solid #e0e8f0;border-radius:18px;padding:22px;box-shadow:0 7px 22px #0b1e3a08;margin-bottom:18px}
        .pas-card h2{font-size:18px;margin:0 0 8px}.pas-muted{font-size:13px;color:#64748b;line-height:1.6;margin:0 0 15px}.pas-choice{display:block;width:100%;text-align:left;border:1px solid #e0e8f0;background:white;border-radius:12px;padding:13px;margin:9px 0;cursor:pointer;color:#13243b}.pas-choice.active{border-color:#00b4d8;background:#effbfe;box-shadow:inset 3px 0 #00b4d8}.pas-choice strong{display:block;font-size:13px}.pas-choice span{display:block;color:#64748b;font-size:11px;margin-top:6px}.pas-task{background:#f7fafc;border:1px solid #e4ebf2;padding:16px;border-radius:12px;line-height:1.7;font-size:14px;white-space:pre-wrap}
        .pas-criteria{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:14px 0 20px}.pas-criterion{background:#f6f9fc;border-radius:9px;padding:10px;font-size:12px;color:#42536a}.pas-label{display:block;font-size:12px;font-weight:800;margin:14px 0 7px}.pas-select,.pas-textarea{width:100%;border:1px solid #cbd5e1;border-radius:11px;padding:12px;background:white;color:#13243b;font:inherit}.pas-textarea{min-height:220px;resize:vertical;line-height:1.6}.pas-btn{border:0;border-radius:11px;padding:12px 17px;background:#0b1e3a;color:white;font-weight:800;cursor:pointer;margin-top:13px}.pas-btn:disabled{opacity:.55;cursor:wait}.pas-error{padding:12px;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;border-radius:10px;font-size:13px;margin:12px 0}.pas-review{border-top:1px solid #e6edf4;margin-top:22px;padding-top:22px}.pas-score{display:flex;align-items:center;gap:14px;margin:10px 0 20px}.pas-score-number{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;background:#e7f8fc;border:4px solid #00b4d8;font-size:22px;font-weight:900}.pas-small{font-size:11px;color:#64748b}.pas-criterion-result{padding:13px 0;border-top:1px solid #edf2f7}.pas-criterion-result strong{font-size:13px}.pas-criterion-result p{font-size:13px;line-height:1.6;color:#526277;margin:6px 0 0}.pas-list{padding-left:20px;line-height:1.7;font-size:13px;color:#42536a}.pas-notice{font-size:11px;line-height:1.6;color:#718096;margin-top:16px}
        @media(max-width:800px){.pas-grid{grid-template-columns:1fr}.pas-criteria{grid-template-columns:1fr 1fr}.pas-card{padding:17px}}@media(max-width:440px){.pas-criteria{grid-template-columns:1fr}}
      `}</style>
      <div className="pas-wrap">
        <div className="pas-eyebrow">RuffNeck Learn · Skills in action</div>
        <h1 className="pas-title">Practical Assessment Studio</h1>
        <p className="pas-sub">Complete realistic professional tasks, receive rubric-based formative feedback, and identify the next improvement to make. Your work is sent to the configured AI service for review.</p>
        <div className="pas-grid">
          <aside className="pas-card">
            <h2>Choose an assessment</h2>
            <p className="pas-muted">Select a task that matches a professional skill you want to practise.</p>
            {ASSESSMENTS.map((item) => <button key={item.id} className={`pas-choice ${item.id === selectedId ? "active" : ""}`} onClick={() => selectAssessment(item.id)}><strong>{item.title}</strong><span>{item.area} · {item.level}</span></button>)}
          </aside>
          <section className="pas-card">
            <h2>{assessment.title}</h2>
            <p className="pas-muted">Skill area: {assessment.area} · Level: {assessment.level}</p>
            <div className="pas-task">{assessment.task}</div>
            <h2 style={{ marginTop: 20 }}>Assessment rubric</h2>
            <p className="pas-muted">The AI reviewer will consider these criteria and provide a score out of 100.</p>
            <div className="pas-criteria">{assessment.criteria.map((criterion) => <div className="pas-criterion" key={criterion}>✓ &nbsp;{criterion}</div>)}</div>
            <label className="pas-label" htmlFor="pas-language">Feedback language</label>
            <select id="pas-language" className="pas-select" value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Hausa</option><option>Yoruba</option><option>Igbo</option></select>
            <label className="pas-label" htmlFor="pas-answer">Your submission</label>
            <textarea id="pas-answer" className="pas-textarea" maxLength={12000} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Write your solution here. Explain your reasoning and include practical details where appropriate." />
            <div className="pas-small">{answer.length.toLocaleString()} / 12,000 characters</div>
            {error && <div className="pas-error" role="alert">{error}</div>}
            <button className="pas-btn" disabled={loading || answer.trim().length < 30} onClick={() => void submit()}>{loading ? "Reviewing your submission…" : "Submit for AI review"}</button>
            {review && <div className="pas-review" aria-live="polite">
              <h2>Assessment feedback</h2>
              <div className="pas-score"><div className="pas-score-number">{review.score}</div><div><strong>{review.result}</strong><div className="pas-small">Formative score out of 100 · Not a formal grade</div></div></div>
              <h3>Criteria feedback</h3>
              {review.criteria.map((item, index) => <div className="pas-criterion-result" key={`${item.name}-${index}`}><strong>{item.name} — {item.score}/25</strong><p>{item.feedback}</p></div>)}
              <h3>Strengths</h3><ul className="pas-list">{review.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul>
              <h3>Improvements</h3><ul className="pas-list">{review.improvements.map((item, index) => <li key={index}>{item}</li>)}</ul>
              <h3>Recommended next step</h3><p className="pas-muted">{review.nextStep}</p>
              <p className="pas-notice">{review.disclaimer}</p>
            </div>}
            <p className="pas-notice">Do not submit passwords, confidential business records, or sensitive personal information. AI feedback can be mistaken and should be reviewed by a qualified instructor for consequential grading. This feature does not issue certificates or change course completion requirements.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
