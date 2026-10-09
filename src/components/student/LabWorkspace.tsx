"use client";

import { useMemo, useState } from "react";

export type LabCard = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  difficulty: string;
  estimated_minutes: number;
  instructions: string;
  deliverable: string;
  is_published: boolean;
  sort_order: number;
  course_title: string;
  course_slug: string;
};

export type LabSubmission = {
  id: string;
  lab_id: string;
  status: string;
  score: number | null;
  feedback: string | null;
  answer_text: string | null;
  updated_at: string;
};

const categories = ["All tasks", "AI & Prompting", "Office & Data", "Education", "Marketing", "Business Operations"];

function statusLabel(status?: string) {
  if (!status) return "Not started";
  if (status === "approved") return "Approved";
  if (status === "submitted") return "Submitted";
  if (status === "revision_required") return "Revision requested";
  if (status === "draft") return "Draft saved";
  return status.replaceAll("_", " ");
}

function categoryMatches(lab: LabCard, filter: string) {
  if (filter === "All tasks") return true;
  const value = `${lab.category} ${lab.title} ${lab.course_title}`.toLowerCase();
  if (filter === "AI & Prompting") return /ai|prompt|literacy|automation/.test(value);
  if (filter === "Office & Data") return /excel|power bi|data|office|records|productivity/.test(value);
  if (filter === "Education") return /teacher|education|lesson plan|classroom/.test(value);
  if (filter === "Marketing") return /marketing|campaign|content|social media/.test(value);
  if (filter === "Business Operations") return /business|record|workflow|operations|admin/.test(value);
  return true;
}

export default function LabWorkspace({ labs, submissions }: { labs: LabCard[]; submissions: LabSubmission[] }) {
  const [filter, setFilter] = useState("All tasks");
  const [search, setSearch] = useState("");
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const latestByLab = useMemo(() => {
    const map = new Map<string, LabSubmission>();
    for (const submission of submissions) {
      if (!map.has(submission.lab_id)) map.set(submission.lab_id, submission);
    }
    return map;
  }, [submissions]);

  const filtered = useMemo(() => labs.filter((lab) =>
    categoryMatches(lab, filter) &&
    `${lab.title} ${lab.summary} ${lab.course_title}`.toLowerCase().includes(search.toLowerCase().trim())
  ), [labs, filter, search]);

  async function submitLab(lab: LabCard, mode: "draft" | "submitted") {
    const answer = (answers[lab.id] ?? latestByLab.get(lab.id)?.answer_text ?? "").trim();
    if (!answer) {
      setMessages((prev) => ({ ...prev, [lab.id]: { type: "error", text: "Add your work or a brief reflection before saving." } }));
      return;
    }
    setBusyId(lab.id);
    setMessages((prev) => { const next = { ...prev }; delete next[lab.id]; return next; });
    try {
      const response = await fetch(`/api/student/labs/${encodeURIComponent(lab.id)}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerText: answer, action: mode }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Unable to save your work. Please try again.");
      setMessages((prev) => ({ ...prev, [lab.id]: { type: "success", text: mode === "draft" ? "Your draft has been saved." : "Your work has been submitted for review." } }));
      window.location.reload();
    } catch (error) {
      setMessages((prev) => ({ ...prev, [lab.id]: { type: "error", text: error instanceof Error ? error.message : "Something went wrong." } }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rn-lab-list">
      <div className="rn-lab-controls">
        <label className="rn-lab-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search practical tasks..." aria-label="Search practical tasks" /></label>
        <div className="rn-lab-filters" aria-label="Filter tasks by category">
          {categories.map((category) => <button type="button" key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>{category}</button>)}
        </div>
      </div>

      {filtered.length ? (
        <div className="rn-lab-grid">
          {filtered.map((lab, index) => {
            const submission = latestByLab.get(lab.id);
            const active = activeLabId === lab.id;
            const answer = answers[lab.id] ?? submission?.answer_text ?? "";
            const status = submission?.status;
            return (
              <article className={`rn-lab-card ${active ? "is-active" : ""}`} key={lab.id}>
                <div className="rn-lab-card-top"><span className={`rn-lab-card-symbol symbol-${index % 5}`}>{["✦", "▦", "⌘", "↗", "◈"][index % 5]}</span><span className={`rn-lab-status status-${status || "new"}`}>{statusLabel(status)}</span></div>
                <div className="rn-lab-card-category">{lab.category}</div>
                <h3>{lab.title}</h3>
                <p className="rn-lab-card-summary">{lab.summary}</p>
                <div className="rn-lab-card-course">{lab.course_title}</div>
                <div className="rn-lab-card-meta"><span>◷ {lab.estimated_minutes || 30} min</span><span>◆ {lab.difficulty || "Practical"}</span></div>
                {status === "approved" && submission?.score !== null && submission?.score !== undefined ? <div className="rn-lab-score">Score: <strong>{submission.score}/100</strong></div> : null}
                {submission?.feedback ? <div className="rn-lab-feedback"><strong>Reviewer feedback</strong><p>{submission.feedback}</p></div> : null}
                <button className="rn-lab-open-button" type="button" onClick={() => setActiveLabId(active ? null : lab.id)}>{active ? "Close task" : status === "approved" ? "Review task" : status ? "Continue task" : "Open task"} <span>{active ? "↑" : "→"}</span></button>
                {active ? (
                  <div className="rn-lab-detail">
                    <div className="rn-lab-detail-label">THE BRIEF</div>
                    <p className="rn-lab-instructions">{lab.instructions}</p>
                    <div className="rn-lab-deliverable"><strong>What to produce</strong><p>{lab.deliverable}</p></div>
                    <label className="rn-lab-answer-label" htmlFor={`answer-${lab.id}`}>Your work / response</label>
                    <textarea id={`answer-${lab.id}`} value={answer} onChange={(event) => setAnswers((prev) => ({ ...prev, [lab.id]: event.target.value }))} placeholder="Describe your solution, paste your written output, or explain the steps you completed..." rows={7} maxLength={20000} />
                    <div className="rn-lab-answer-hint">Up to 20,000 characters. Do not include passwords or sensitive personal information.</div>
                    {messages[lab.id] ? <div className={`rn-lab-message ${messages[lab.id].type}`}>{messages[lab.id].text}</div> : null}
                    <div className="rn-lab-submit-row">
                      <button type="button" className="rn-lab-save-button" disabled={busyId === lab.id} onClick={() => submitLab(lab, "draft")}>{busyId === lab.id ? "Saving…" : "Save draft"}</button>
                      <button type="button" className="rn-lab-submit-button" disabled={busyId === lab.id} onClick={() => submitLab(lab, "submitted")}>{busyId === lab.id ? "Submitting…" : status === "revision_required" ? "Resubmit work" : "Submit for review"}</button>
                    </div>
                    <p className="rn-lab-review-note">Lab work is separate from lesson tests and final assessments. Submitting here does not automatically award a certificate.</p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rn-lab-no-results"><strong>No matching tasks</strong><span>Try another category or search term.</span></div>
      )}

      <style>{`
        .rn-lab-controls{display:grid;gap:15px;margin-bottom:20px}.rn-lab-search{display:flex;align-items:center;gap:10px;border:1px solid #24415f;background:#0a1b2f;border-radius:11px;padding:0 14px;max-width:430px;color:#64dff1}.rn-lab-search span{font-size:24px}.rn-lab-search input{width:100%;height:44px;background:transparent;border:0;outline:0;color:#e9f4ff;font:inherit;font-size:12px}.rn-lab-search input::placeholder{color:#67809b}
        .rn-lab-filters{display:flex;gap:8px;flex-wrap:wrap}.rn-lab-filters button{border:1px solid #1e3955;background:#0a1a2d;color:#91a9c4;padding:9px 12px;border-radius:9px;font-size:10px;cursor:pointer}.rn-lab-filters button.active{border-color:#00b4d8;background:#00b4d81c;color:#72e6f7}
        .rn-lab-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;align-items:start}.rn-lab-card{min-width:0;padding:20px;border:1px solid #1c3652;background:linear-gradient(155deg,#0d2036,#09182a);border-radius:16px;transition:border-color .18s,transform .18s}.rn-lab-card:hover{border-color:#2a5773;transform:translateY(-2px)}.rn-lab-card.is-active{grid-column:span 2;border-color:#00a9ce;box-shadow:0 0 0 1px #00b4d81c}
        .rn-lab-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:19px}.rn-lab-card-symbol{width:43px;height:43px;border-radius:13px;display:grid;place-items:center;font-size:21px;background:#00b4d81b;color:#46d8ed}.symbol-1{background:#fbbf2419;color:#f5cb61}.symbol-2{background:#a78bfa1b;color:#c4b5fd}.symbol-3{background:#34d3991b;color:#6ee7b7}.symbol-4{background:#fb71851b;color:#fda4af}
        .rn-lab-status{font-size:9px;white-space:nowrap;border:1px solid #29415a;border-radius:30px;padding:6px 8px;color:#9ab2cb}.status-approved{border-color:#236e5c;color:#76e4bd;background:#0d3b302b}.status-submitted{border-color:#235a79;color:#7adcf2;background:#0a34442b}.status-revision_required{border-color:#795b27;color:#f5d078;background:#3c2d112b}.status-draft{color:#b7a3f7;border-color:#51427b}.rn-lab-card-category{font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:#54cfe6;font-weight:800}.rn-lab-card h3{font-size:17px;line-height:1.35;letter-spacing:-.02em;margin:9px 0;color:#edf6ff}.rn-lab-card-summary{min-height:58px;font-size:12px;line-height:1.65;color:#8fa8c4;margin:0 0 15px}.rn-lab-card-course{border-top:1px solid #1a3048;padding-top:12px;font-size:10px;color:#b3c7dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rn-lab-card-meta{display:flex;gap:15px;flex-wrap:wrap;margin:13px 0;color:#7793af;font-size:10px}.rn-lab-score{margin:10px 0;color:#8fa8c4;font-size:11px}.rn-lab-score strong{color:#78e3bd}.rn-lab-feedback{padding:11px;border-radius:9px;background:#102b32;border:1px solid #1d514b;margin:12px 0}.rn-lab-feedback strong{font-size:10px;color:#83e8c9}.rn-lab-feedback p{font-size:11px;line-height:1.6;color:#c1d9d5;margin:5px 0 0;white-space:pre-wrap}
        .rn-lab-open-button{display:flex;align-items:center;justify-content:space-between;width:100%;border:1px solid #254563;background:#102741;color:#cde9f7;border-radius:9px;padding:11px 12px;font-size:11px;font-weight:700;cursor:pointer}.rn-lab-open-button:hover{border-color:#00b4d8;color:#69e2f2}.rn-lab-open-button span{font-size:16px}
        .rn-lab-detail{border-top:1px solid #203c58;margin-top:18px;padding-top:18px}.rn-lab-detail-label{font-size:9px;letter-spacing:.16em;font-weight:800;color:#50d5ec}.rn-lab-instructions{font-size:12px;line-height:1.8;color:#c0d0e2;white-space:pre-wrap}.rn-lab-deliverable{padding:12px;border:1px solid #26445f;border-radius:9px;background:#0a192a;margin:14px 0}.rn-lab-deliverable strong{font-size:11px;color:#e6f3ff}.rn-lab-deliverable p{font-size:11px;line-height:1.7;color:#9eb5cc;margin:6px 0 0}.rn-lab-answer-label{display:block;font-size:11px;font-weight:750;color:#d6e8f8;margin-bottom:8px}.rn-lab-detail textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:150px;border:1px solid #294660;background:#071629;color:#e7f4ff;border-radius:10px;padding:12px;font:inherit;font-size:12px;line-height:1.7;outline:none}.rn-lab-detail textarea:focus{border-color:#00b4d8;box-shadow:0 0 0 3px #00b4d81c}.rn-lab-detail textarea::placeholder{color:#5d7793}.rn-lab-answer-hint{font-size:9px;color:#718aa4;margin-top:6px}.rn-lab-message{font-size:11px;padding:10px;border-radius:8px;margin-top:12px}.rn-lab-message.success{color:#8ce7c9;background:#10372d;border:1px solid #245c4d}.rn-lab-message.error{color:#ffb5b5;background:#3a2028;border:1px solid #69343e}.rn-lab-submit-row{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.rn-lab-save-button,.rn-lab-submit-button{padding:10px 12px;border-radius:9px;font-size:10px;font-weight:800;cursor:pointer}.rn-lab-save-button{border:1px solid #31516e;background:transparent;color:#c2d7ea}.rn-lab-submit-button{border:1px solid #00b4d8;background:#00b4d8;color:#041626}.rn-lab-save-button:disabled,.rn-lab-submit-button:disabled{opacity:.6;cursor:wait}.rn-lab-review-note{font-size:9px;line-height:1.6;color:#6e87a1;margin:13px 0 0}.rn-lab-no-results{padding:36px;text-align:center;border:1px dashed #294562;border-radius:13px;color:#a8bfd7}.rn-lab-no-results strong,.rn-lab-no-results span{display:block}.rn-lab-no-results span{font-size:12px;color:#718aa4;margin-top:7px}
        @media(max-width:1000px){.rn-lab-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rn-lab-card.is-active{grid-column:span 2}}@media(max-width:620px){.rn-lab-grid{grid-template-columns:1fr}.rn-lab-card.is-active{grid-column:span 1}.rn-lab-card-summary{min-height:0}.rn-lab-filters{flex-wrap:nowrap;overflow-x:auto;padding-bottom:5px}.rn-lab-filters button{flex-shrink:0}.rn-lab-card{padding:17px}}
      `}</style>
    </div>
  );
}
