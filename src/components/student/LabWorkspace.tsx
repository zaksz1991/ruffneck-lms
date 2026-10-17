"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

type StarterResource = {
  title: string;
  description?: string;
  filename?: string;
  content?: string;
  url?: string;
};

type RubricCriterion = {
  criterion: string;
  points: number;
  description?: string;
};

type LabKit = {
  practice_steps: string[];
  starter_resources: StarterResource[];
  assessment_rubric: RubricCriterion[];
};

type WorkspaceMessage = {
  type: "success" | "error";
  text: string;
};

const EMPTY_KIT: LabKit = {
  practice_steps: [],
  starter_resources: [],
  assessment_rubric: [],
};

const categories = [
  "All tasks",
  "AI & Prompting",
  "Office & Data",
  "Education",
  "Marketing",
  "Business Operations",
];

function statusLabel(status?: string): string {
  if (!status) return "Not started";
  const labels: Record<string, string> = {
    approved: "Approved",
    submitted: "Awaiting review",
    revision_required: "Revision requested",
    draft: "Draft saved",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function categoryMatches(lab: LabCard, filter: string): boolean {
  if (filter === "All tasks") return true;
  const value = `${lab.category} ${lab.title} ${lab.course_title}`.toLowerCase();
  if (filter === "AI & Prompting") return /ai|prompt|literacy|automation/.test(value);
  if (filter === "Office & Data") return /excel|power bi|data|office|records|productivity/.test(value);
  if (filter === "Education") return /teacher|education|lesson plan|classroom/.test(value);
  if (filter === "Marketing") return /marketing|campaign|content|social media/.test(value);
  if (filter === "Business Operations") return /business|record|workflow|operations|admin/.test(value);
  return true;
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function parseKitRow(value: Record<string, unknown>): LabKit {
  const practiceSteps = Array.isArray(value.practice_steps)
    ? value.practice_steps.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const starterResources = Array.isArray(value.starter_resources)
    ? value.starter_resources.flatMap((item): StarterResource[] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        if (typeof row.title !== "string" || !row.title.trim()) return [];
        return [{
          title: row.title,
          description: typeof row.description === "string" ? row.description : "",
          filename: typeof row.filename === "string" ? row.filename : "starter-resource.txt",
          content: typeof row.content === "string" ? row.content : "",
          url: typeof row.url === "string" ? row.url : "",
        }];
      })
    : [];

  const assessmentRubric = Array.isArray(value.assessment_rubric)
    ? value.assessment_rubric.flatMap((item): RubricCriterion[] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        if (typeof row.criterion !== "string" || !row.criterion.trim()) return [];
        const points = Number(row.points);
        return [{
          criterion: row.criterion,
          points: Number.isFinite(points) ? points : 0,
          description: typeof row.description === "string" ? row.description : "",
        }];
      })
    : [];

  return { practice_steps: practiceSteps, starter_resources: starterResources, assessment_rubric: assessmentRubric };
}

function downloadResource(resource: StarterResource): void {
  if (!resource.content) return;
  const blob = new Blob([resource.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeFilename = (resource.filename || `${resource.title}.txt`).replace(/[^A-Za-z0-9._-]/g, "-");
  anchor.href = url;
  anchor.download = safeFilename || "starter-resource.txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function LabWorkspace({
  labs,
  submissions,
}: {
  labs: LabCard[];
  submissions: LabSubmission[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("All tasks");
  const [search, setSearch] = useState("");
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, WorkspaceMessage>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [kitsByLab, setKitsByLab] = useState<Record<string, LabKit>>({});
  const [kitLoadFailed, setKitLoadFailed] = useState(false);
  const [kitsLoading, setKitsLoading] = useState(false);

  const labIdsKey = labs.map((lab) => lab.id).filter(Boolean).sort().join(",");

  useEffect(() => {
    const ids = labIdsKey.split(",").filter(Boolean);
    if (ids.length === 0) {
      setKitsByLab({});
      setKitLoadFailed(false);
      setKitsLoading(false);
      return;
    }

    let cancelled = false;
    setKitsLoading(true);
    setKitLoadFailed(false);

    async function loadKits() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("practical_labs")
        .select("id, practice_steps, starter_resources, assessment_rubric")
        .in("id", ids)
        .eq("is_published", true);

      if (cancelled) return;
      if (error) {
        console.error("Practical Lab Kit lookup failed:", error);
        setKitLoadFailed(true);
        setKitsByLab({});
      } else {
        const result: Record<string, LabKit> = {};
        for (const row of (data ?? []) as Array<Record<string, unknown> & { id: string }>) {
          result[row.id] = parseKitRow(row);
        }
        setKitsByLab(result);
      }
      setKitsLoading(false);
    }

    void loadKits();
    return () => { cancelled = true; };
  }, [labIdsKey]);

  const latestByLab = useMemo(() => {
    const map = new Map<string, LabSubmission>();
    for (const submission of submissions) {
      const existing = map.get(submission.lab_id);
      const submissionTime = new Date(submission.updated_at).getTime();
      const existingTime = existing ? new Date(existing.updated_at).getTime() : Number.NEGATIVE_INFINITY;
      if (!existing || submissionTime >= existingTime) map.set(submission.lab_id, submission);
    }
    return map;
  }, [submissions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return labs.filter((lab) => {
      const matchesCategory = categoryMatches(lab, filter);
      const searchableText = `${lab.title} ${lab.summary} ${lab.course_title}`.toLowerCase();
      return matchesCategory && searchableText.includes(query);
    });
  }, [labs, filter, search]);

  async function submitLab(lab: LabCard, mode: "draft" | "submitted"): Promise<void> {
    const existingSubmission = latestByLab.get(lab.id);
    const currentStatus = existingSubmission?.status;

    if (currentStatus === "approved") {
      setMessages((previous) => ({ ...previous, [lab.id]: { type: "error", text: "This task has already been approved and cannot be changed." } }));
      return;
    }
    if (currentStatus === "submitted") {
      setMessages((previous) => ({ ...previous, [lab.id]: { type: "error", text: "Your work is awaiting review. You cannot change it until the reviewer responds." } }));
      return;
    }

    const answer = (answers[lab.id] ?? existingSubmission?.answer_text ?? "").trim();
    if (!answer) {
      setMessages((previous) => ({ ...previous, [lab.id]: { type: "error", text: "Add your work or a brief reflection before saving." } }));
      return;
    }
    if (answer.length > 20_000) {
      setMessages((previous) => ({ ...previous, [lab.id]: { type: "error", text: "Your response exceeds the 20,000-character limit." } }));
      return;
    }

    setBusyId(lab.id);
    setMessages((previous) => {
      const next = { ...previous };
      delete next[lab.id];
      return next;
    });

    try {
      const response = await fetch(`/api/student/labs/${encodeURIComponent(lab.id)}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerText: answer, action: mode }),
      });
      const payload: { ok?: boolean; error?: string } | null = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Unable to save your work. Please try again.");
      }
      setAnswers((previous) => ({ ...previous, [lab.id]: answer }));
      setMessages((previous) => ({
        ...previous,
        [lab.id]: {
          type: "success",
          text: mode === "draft"
            ? "Your draft has been saved."
            : currentStatus === "revision_required"
              ? "Your revised work has been resubmitted for review."
              : "Your work has been submitted for review.",
        },
      }));
      router.refresh();
    } catch (error: unknown) {
      setMessages((previous) => ({
        ...previous,
        [lab.id]: {
          type: "error",
          text: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        },
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rn-lab-list">
      <div className="rn-lab-controls">
        <label className="rn-lab-search">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search practical tasks..." aria-label="Search practical tasks" />
        </label>
        <div className="rn-lab-filters" aria-label="Filter tasks by category">
          {categories.map((category) => (
            <button type="button" key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>
              {category}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="rn-lab-grid">
          {filtered.map((lab, index) => {
            const submission = latestByLab.get(lab.id);
            const status = submission?.status;
            const isActive = activeLabId === lab.id;
            const isApproved = status === "approved";
            const isRevisionRequired = status === "revision_required";
            const isAwaitingReview = status === "submitted";
            const isBusy = busyId === lab.id;
            const answer = answers[lab.id] ?? submission?.answer_text ?? "";
            const updatedAt = formatDate(submission?.updated_at);
            const kit = kitsByLab[lab.id] ?? EMPTY_KIT;
            const rubricTotal = kit.assessment_rubric.reduce((sum, row) => sum + row.points, 0);

            return (
              <article className={`rn-lab-card ${isActive ? "is-active" : ""}`} key={lab.id}>
                <div className="rn-lab-card-top">
                  <span className={`rn-lab-card-symbol symbol-${index % 5}`} aria-hidden="true">{["✦", "▦", "⌘", "↗", "◈"][index % 5]}</span>
                  <span className={`rn-lab-status status-${status ?? "new"}`}>{statusLabel(status)}</span>
                </div>
                <div className="rn-lab-card-category">{lab.category}</div>
                <h3>{lab.title}</h3>
                <p className="rn-lab-card-summary">{lab.summary}</p>
                <div className="rn-lab-card-course">{lab.course_title}</div>
                <div className="rn-lab-card-meta">
                  <span>◷ {lab.estimated_minutes || 30} min</span>
                  <span>◆ {lab.difficulty || "Practical"}</span>
                  {kit.practice_steps.length > 0 && <span>☑ {kit.practice_steps.length} guided steps</span>}
                  {kit.starter_resources.length > 0 && <span>↧ {kit.starter_resources.length} resources</span>}
                </div>
                {updatedAt && <div className="rn-lab-updated">Last updated: {updatedAt}</div>}
                {isApproved && submission?.score !== null && submission?.score !== undefined && (
                  <div className="rn-lab-score">Score: <strong>{submission.score}/100</strong></div>
                )}
                {submission?.feedback ? (
                  <div className={`rn-lab-feedback ${isRevisionRequired ? "needs-revision" : ""}`}>
                    <strong>{isRevisionRequired ? "Reviewer feedback — revision needed" : "Reviewer feedback"}</strong>
                    <p>{submission.feedback}</p>
                    {isRevisionRequired && <span className="rn-lab-revision-hint">Update your response below and resubmit it for review.</span>}
                  </div>
                ) : isRevisionRequired ? (
                  <div className="rn-lab-feedback needs-revision"><strong>Revision requested</strong><p>Your reviewer has requested changes. Open this task, update your work, and resubmit it.</p></div>
                ) : null}

                <button className="rn-lab-open-button" type="button" aria-expanded={isActive} onClick={() => setActiveLabId(isActive ? null : lab.id)}>
                  {isActive ? "Close task" : isApproved ? "Review task" : isRevisionRequired ? "Revise and resubmit" : status ? "Continue task" : "Open task"}
                  <span aria-hidden="true">{isActive ? "↑" : "→"}</span>
                </button>

                {isActive && (
                  <div className="rn-lab-detail">
                    <div className="rn-lab-detail-label">PRACTICAL LAB KIT</div>
                    <section className="rn-lab-kit-section">
                      <span className="rn-lab-section-kicker">01 · THE SCENARIO</span>
                      <p className="rn-lab-instructions">{lab.summary}</p>
                    </section>
                    <section className="rn-lab-kit-section">
                      <span className="rn-lab-section-kicker">02 · TASK BRIEF</span>
                      <p className="rn-lab-instructions">{lab.instructions}</p>
                    </section>

                    <section className="rn-lab-kit-section">
                      <span className="rn-lab-section-kicker">03 · STEP-BY-STEP PRACTICE</span>
                      {kitsLoading ? (
                        <p className="rn-lab-kit-note">Loading your practical kit…</p>
                      ) : kit.practice_steps.length > 0 ? (
                        <ol className="rn-lab-steps">
                          {kit.practice_steps.map((step, stepIndex) => <li key={`${lab.id}-step-${stepIndex}`}>{step}</li>)}
                        </ol>
                      ) : (
                        <p className="rn-lab-kit-note">Guided steps have not been added to this lab yet. Follow the task brief and expected deliverable below.</p>
                      )}
                    </section>

                    <section className="rn-lab-kit-section">
                      <span className="rn-lab-section-kicker">04 · STARTER RESOURCES</span>
                      {kitLoadFailed ? (
                        <p className="rn-lab-kit-note">Starter resources could not be loaded. The teaching team may need to check the Lab Kit setup.</p>
                      ) : kit.starter_resources.length > 0 ? (
                        <div className="rn-lab-resource-list">
                          {kit.starter_resources.map((resource, resourceIndex) => (
                            <article className="rn-lab-resource" key={`${lab.id}-resource-${resourceIndex}`}>
                              <div className="rn-lab-resource-icon" aria-hidden="true">↧</div>
                              <div className="rn-lab-resource-copy">
                                <strong>{resource.title}</strong>
                                {resource.description && <p>{resource.description}</p>}
                                <div className="rn-lab-resource-actions">
                                  {resource.content && <button type="button" onClick={() => downloadResource(resource)}>Download starter file</button>}
                                  {resource.url && /^https?:\/\//i.test(resource.url) && <a href={resource.url} target="_blank" rel="noreferrer">Open resource ↗</a>}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="rn-lab-kit-note">No starter files are attached yet. Use the scenario and brief to begin.</p>
                      )}
                    </section>

                    <section className="rn-lab-deliverable">
                      <span className="rn-lab-section-kicker">05 · REQUIRED DELIVERABLE</span>
                      <strong>What to produce</strong>
                      <p>{lab.deliverable || "Submit the completed work and briefly explain your approach."}</p>
                    </section>

                    <section className="rn-lab-kit-section">
                      <span className="rn-lab-section-kicker">ASSESSMENT RUBRIC</span>
                      {kit.assessment_rubric.length > 0 ? (
                        <>
                          <div className="rn-lab-rubric-head"><span>Criterion</span><span>Points</span></div>
                          <div className="rn-lab-rubric-list">
                            {kit.assessment_rubric.map((row, rowIndex) => (
                              <div className="rn-lab-rubric-row" key={`${lab.id}-rubric-${rowIndex}`}>
                                <div><strong>{row.criterion}</strong>{row.description && <p>{row.description}</p>}</div>
                                <b>{row.points}</b>
                              </div>
                            ))}
                          </div>
                          <div className={`rn-lab-rubric-total ${rubricTotal === 100 ? "is-complete" : ""}`}>Rubric total <strong>{rubricTotal}/100</strong></div>
                        </>
                      ) : (
                        <p className="rn-lab-kit-note">The instructor has not added a scoring rubric yet. Your work will be reviewed against the task brief and deliverable.</p>
                      )}
                    </section>

                    {isApproved ? (
                      <div className="rn-lab-approved-notice">This submission has been approved. Your work and reviewer feedback are available above. The approved submission cannot be changed.</div>
                    ) : isAwaitingReview ? (
                      <div className="rn-lab-awaiting-notice">Your work is awaiting instructor review. Editing is locked until the reviewer responds.</div>
                    ) : (
                      <>
                        <label className="rn-lab-answer-label" htmlFor={`answer-${lab.id}`}>
                          {isRevisionRequired ? "Revise your work" : "Your work / response"}
                        </label>
                        <textarea
                          id={`answer-${lab.id}`}
                          value={answer}
                          onChange={(event) => setAnswers((previous) => ({ ...previous, [lab.id]: event.target.value }))}
                          placeholder={isRevisionRequired ? "Address the reviewer's feedback and explain the changes you made…" : "Describe your solution, include calculations or output, and explain the steps you completed…"}
                          rows={7}
                          maxLength={20_000}
                          disabled={isBusy}
                        />
                        <div className="rn-lab-answer-hint">Up to 20,000 characters. Do not include passwords or sensitive personal information.</div>
                        <div className="rn-lab-character-count">{answer.length.toLocaleString()} / 20,000 characters</div>
                        {messages[lab.id] && (
                          <div className={`rn-lab-message ${messages[lab.id].type}`} role={messages[lab.id].type === "error" ? "alert" : "status"}>{messages[lab.id].text}</div>
                        )}
                        <div className="rn-lab-submit-row">
                          <button type="button" className="rn-lab-save-button" disabled={isBusy} onClick={() => submitLab(lab, "draft")}>{isBusy ? "Saving…" : "Save draft"}</button>
                          <button type="button" className="rn-lab-submit-button" disabled={isBusy} onClick={() => submitLab(lab, "submitted")}>{isBusy ? "Submitting…" : isRevisionRequired ? "Resubmit work" : "Submit for review"}</button>
                        </div>
                      </>
                    )}
                    <p className="rn-lab-review-note">Lab work is separate from lesson tests and final assessments. Submitting here does not automatically award a certificate.</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rn-lab-no-results"><strong>No matching tasks</strong><span>Try another category or search term.</span></div>
      )}

      <style>{`
        .rn-lab-list,.rn-lab-list *{box-sizing:border-box}
        .rn-lab-controls{display:grid;gap:15px;margin-bottom:20px}
        .rn-lab-search{display:flex;align-items:center;gap:10px;border:1px solid #24415f;background:#0a1b2f;border-radius:11px;padding:0 14px;max-width:430px;color:#64dff1}
        .rn-lab-search span{font-size:24px}
        .rn-lab-search input{min-width:0;width:100%;height:44px;background:transparent;border:0;outline:0;color:#e9f4ff;font:inherit;font-size:12px}
        .rn-lab-search input::placeholder{color:#67809b}
        .rn-lab-filters{display:flex;gap:8px;flex-wrap:wrap}
        .rn-lab-filters button{border:1px solid #1e3955;background:#0a1a2d;color:#91a9c4;padding:9px 12px;border-radius:9px;font-size:10px;cursor:pointer}
        .rn-lab-filters button.active{border-color:#00b4d8;background:#00b4d81c;color:#72e6f7}
        .rn-lab-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;align-items:start}
        .rn-lab-card{min-width:0;padding:20px;border:1px solid #1c3652;background:linear-gradient(155deg,#0d2036,#09182a);border-radius:16px;transition:border-color .18s,transform .18s}
        .rn-lab-card:hover{border-color:#2a5773;transform:translateY(-2px)}
        .rn-lab-card.is-active{grid-column:span 2;border-color:#00a9ce;box-shadow:0 0 0 1px #00b4d81c}
        .rn-lab-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:19px}
        .rn-lab-card-symbol{width:43px;height:43px;border-radius:13px;display:grid;place-items:center;font-size:21px;background:#00b4d81b;color:#46d8ed}
        .symbol-1{background:#fbbf2419;color:#f5cb61}.symbol-2{background:#a78bfa1b;color:#c4b5fd}.symbol-3{background:#34d3991b;color:#6ee7b7}.symbol-4{background:#fb71851b;color:#fda4af}
        .rn-lab-status{font-size:9px;white-space:nowrap;border:1px solid #29415a;border-radius:30px;padding:6px 8px;color:#9ab2cb}
        .status-approved{border-color:#236e5c;color:#76e4bd;background:#0d3b302b}.status-submitted{border-color:#235a79;color:#7adcf2;background:#0a34442b}.status-revision_required{border-color:#795b27;color:#f5d078;background:#3c2d112b}.status-draft{color:#b7a3f7;border-color:#51427b}
        .rn-lab-card-category{font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:#54cfe6;font-weight:800}
        .rn-lab-card h3{font-size:17px;line-height:1.35;letter-spacing:-.02em;margin:9px 0;color:#edf6ff}
        .rn-lab-card-summary{min-height:58px;font-size:12px;line-height:1.65;color:#8fa8c4;margin:0 0 15px}
        .rn-lab-card-course{border-top:1px solid #1a3048;padding-top:12px;font-size:10px;color:#b3c7dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rn-lab-card-meta{display:flex;gap:10px;flex-wrap:wrap;margin:13px 0;color:#7793af;font-size:10px}
        .rn-lab-updated{font-size:9px;color:#718aa4;margin:8px 0}.rn-lab-score{margin:10px 0;color:#8fa8c4;font-size:11px}.rn-lab-score strong{color:#78e3bd}
        .rn-lab-feedback{padding:11px;border-radius:9px;background:#102b32;border:1px solid #1d514b;margin:12px 0}.rn-lab-feedback.needs-revision{background:#332713;border-color:#795b27}.rn-lab-feedback strong{font-size:10px;color:#83e8c9}.rn-lab-feedback.needs-revision strong{color:#f5d078}.rn-lab-feedback p{font-size:11px;line-height:1.6;color:#c1d9d5;margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.rn-lab-feedback.needs-revision p{color:#ead8b0}.rn-lab-revision-hint{display:block;margin-top:9px;font-size:10px;line-height:1.6;color:#f5d078}
        .rn-lab-open-button{display:flex;align-items:center;justify-content:space-between;width:100%;border:1px solid #254563;background:#102741;color:#cde9f7;border-radius:9px;padding:11px 12px;font-size:11px;font-weight:700;cursor:pointer}.rn-lab-open-button:hover{border-color:#00b4d8;color:#69e2f2}.rn-lab-open-button span{font-size:16px}
        .rn-lab-detail{border-top:1px solid #203c58;margin-top:18px;padding-top:18px}.rn-lab-detail-label{display:block;font-size:9px;letter-spacing:.16em;font-weight:800;color:#50d5ec;margin-bottom:14px}
        .rn-lab-kit-section{padding:14px 0;border-bottom:1px solid #20374e}.rn-lab-section-kicker{display:block;font-size:9px;letter-spacing:.12em;font-weight:800;color:#6ddded;margin-bottom:9px}.rn-lab-instructions{font-size:12px;line-height:1.8;color:#c0d0e2;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}
        .rn-lab-steps{list-style:none;counter-reset:lab-step;margin:0;padding:0;display:grid;gap:10px}.rn-lab-steps li{counter-increment:lab-step;position:relative;padding:10px 12px 10px 44px;background:#0a192a;border:1px solid #1d3852;border-radius:9px;color:#b7cbe0;font-size:11px;line-height:1.7}.rn-lab-steps li::before{content:counter(lab-step,decimal-leading-zero);position:absolute;left:12px;top:12px;color:#fbbf24;font-size:10px;font-weight:800}
        .rn-lab-kit-note{font-size:11px;line-height:1.7;color:#8ba5bf;margin:0;padding:10px 12px;border:1px dashed #29445e;border-radius:9px;background:#0a192a}
        .rn-lab-resource-list{display:grid;gap:9px}.rn-lab-resource{display:flex;gap:11px;padding:12px;border:1px solid #24425e;border-radius:10px;background:#0a192a}.rn-lab-resource-icon{flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:#00b4d81b;color:#68deee}.rn-lab-resource-copy{min-width:0;flex:1}.rn-lab-resource-copy strong{font-size:11px;color:#e2effb}.rn-lab-resource-copy p{margin:5px 0 0;font-size:10px;line-height:1.6;color:#8ea7c1;white-space:pre-wrap}.rn-lab-resource-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:9px}.rn-lab-resource-actions button,.rn-lab-resource-actions a{border:1px solid #2a506d;border-radius:7px;padding:7px 9px;background:#102741;color:#8ce4f2;font-size:10px;text-decoration:none;cursor:pointer}.rn-lab-resource-actions button:hover,.rn-lab-resource-actions a:hover{border-color:#00b4d8}
        .rn-lab-deliverable{padding:14px;border:1px solid #26445f;border-radius:9px;background:#0a192a;margin:14px 0}.rn-lab-deliverable strong{display:block;font-size:11px;color:#e6f3ff}.rn-lab-deliverable p{font-size:11px;line-height:1.7;color:#9eb5cc;margin:6px 0 0;overflow-wrap:anywhere}
        .rn-lab-rubric-head,.rn-lab-rubric-row{display:grid;grid-template-columns:minmax(0,1fr) 56px;gap:12px;align-items:start}.rn-lab-rubric-head{padding:7px 10px;color:#6688a6;font-size:9px;text-transform:uppercase;border-bottom:1px solid #20374e}.rn-lab-rubric-list{display:grid}.rn-lab-rubric-row{padding:11px 10px;border-bottom:1px solid #172f46}.rn-lab-rubric-row strong{color:#d9e8f6;font-size:11px}.rn-lab-rubric-row p{color:#8fa8c1;font-size:10px;line-height:1.6;margin:5px 0 0}.rn-lab-rubric-row b{color:#f4cc6c;font-size:12px;text-align:right}.rn-lab-rubric-total{display:flex;justify-content:space-between;padding:10px;color:#90aac4;font-size:11px}.rn-lab-rubric-total strong{color:#f4cc6c}.rn-lab-rubric-total.is-complete strong{color:#76e4bd}
        .rn-lab-answer-label{display:block;font-size:11px;font-weight:750;color:#d6e8f8;margin:18px 0 8px}.rn-lab-detail textarea{display:block;width:100%;max-width:100%;box-sizing:border-box;resize:vertical;min-height:150px;border:1px solid #294660;background:#071629;color:#e7f4ff;border-radius:10px;padding:12px;font:inherit;font-size:12px;line-height:1.7;outline:none}.rn-lab-detail textarea:focus{border-color:#00b4d8;box-shadow:0 0 0 3px #00b4d81c}.rn-lab-detail textarea:disabled{opacity:.7;cursor:wait}.rn-lab-detail textarea::placeholder{color:#5d7793}.rn-lab-answer-hint,.rn-lab-character-count{font-size:9px;color:#718aa4;margin-top:6px}.rn-lab-character-count{text-align:right}
        .rn-lab-message{font-size:11px;padding:10px;border-radius:8px;margin-top:12px;overflow-wrap:anywhere}.rn-lab-message.success{color:#8ce7c9;background:#10372d;border:1px solid #245c4d}.rn-lab-message.error{color:#ffb5b5;background:#3a2028;border:1px solid #69343e}.rn-lab-submit-row{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.rn-lab-save-button,.rn-lab-submit-button{padding:10px 12px;border-radius:9px;font-size:10px;font-weight:800;cursor:pointer}.rn-lab-save-button{border:1px solid #31516e;background:transparent;color:#c2d7ea}.rn-lab-submit-button{border:1px solid #00b4d8;background:#00b4d8;color:#041626}.rn-lab-save-button:disabled,.rn-lab-submit-button:disabled{opacity:.6;cursor:wait}.rn-lab-approved-notice,.rn-lab-awaiting-notice{padding:12px;border-radius:9px;font-size:11px;line-height:1.7}.rn-lab-approved-notice{border:1px solid #236e5c;background:#0d3b302b;color:#a8ead3}.rn-lab-awaiting-notice{border:1px solid #235a79;background:#0a34442b;color:#9be7f3}.rn-lab-list button:focus-visible,.rn-lab-list input:focus-visible,.rn-lab-list textarea:focus-visible{outline:2px solid #63e5f5;outline-offset:3px}.rn-lab-card h3,.rn-lab-card p,.rn-lab-card-category,.rn-lab-detail-label{overflow-wrap:anywhere}.rn-lab-review-note{font-size:9px;line-height:1.6;color:#6e87a1;margin:13px 0 0}.rn-lab-no-results{padding:36px;text-align:center;border:1px dashed #294562;border-radius:13px;color:#a8bfd7}.rn-lab-no-results strong,.rn-lab-no-results span{display:block}.rn-lab-no-results span{font-size:12px;color:#718aa4;margin-top:7px}
        @media(max-width:1000px){.rn-lab-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rn-lab-card.is-active{grid-column:span 2}}
        @media(max-width:620px){.rn-lab-grid{grid-template-columns:1fr}.rn-lab-card.is-active{grid-column:span 1}.rn-lab-card-summary{min-height:0}.rn-lab-filters{flex-wrap:nowrap;overflow-x:auto;padding-bottom:5px}.rn-lab-filters button{flex-shrink:0}.rn-lab-card{padding:17px}}
      `}</style>
    </div>
  );
}
