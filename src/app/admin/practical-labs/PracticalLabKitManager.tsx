"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Course = { id: string; title: string };
type StarterResource = {
  title: string;
  description: string;
  filename: string;
  content: string;
  url: string;
};
type RubricCriterion = {
  criterion: string;
  points: number;
  description: string;
};
type PracticalLab = {
  id: string;
  course_id: string;
  title: string;
  category: string | null;
  difficulty: string | null;
  summary: string | null;
  instructions: string;
  deliverable: string | null;
  is_published: boolean;
  practice_steps: string[] | null;
  starter_resources: StarterResource[] | null;
  assessment_rubric: RubricCriterion[] | null;
};

type Props = {
  courses: Course[];
  initialLabs: PracticalLab[];
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function resourceArray(value: unknown): StarterResource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StarterResource[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.title !== "string") return [];
    return [{
      title: row.title,
      description: typeof row.description === "string" ? row.description : "",
      filename: typeof row.filename === "string" ? row.filename : "starter-resource.txt",
      content: typeof row.content === "string" ? row.content : "",
      url: typeof row.url === "string" ? row.url : "",
    }];
  });
}

function rubricArray(value: unknown): RubricCriterion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): RubricCriterion[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.criterion !== "string") return [];
    const points = Number(row.points);
    return [{
      criterion: row.criterion,
      points: Number.isFinite(points) ? points : 0,
      description: typeof row.description === "string" ? row.description : "",
    }];
  });
}

function cleanResource(resource: StarterResource): StarterResource {
  return {
    title: resource.title.trim(),
    description: resource.description.trim(),
    filename: resource.filename.trim() || "starter-resource.txt",
    content: resource.content,
    url: resource.url.trim(),
  };
}

const emptyResource = (): StarterResource => ({
  title: "",
  description: "",
  filename: "starter-resource.txt",
  content: "",
  url: "",
});

const emptyRubricRow = (): RubricCriterion => ({
  criterion: "",
  points: 0,
  description: "",
});

export default function PracticalLabKitManager({ courses, initialLabs }: Props) {
  const [labs, setLabs] = useState<PracticalLab[]>(initialLabs);
  const [selectedLabId, setSelectedLabId] = useState(initialLabs[0]?.id ?? "");
  const [stepsText, setStepsText] = useState("");
  const [resources, setResources] = useState<StarterResource[]>([]);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course.title])), [courses]);
  const selectedLab = labs.find((lab) => lab.id === selectedLabId) ?? null;

  useEffect(() => {
    if (!selectedLab) {
      setStepsText("");
      setResources([]);
      setRubric([]);
      return;
    }
    setStepsText(stringArray(selectedLab.practice_steps).join("\n"));
    setResources(resourceArray(selectedLab.starter_resources));
    setRubric(rubricArray(selectedLab.assessment_rubric));
    setError("");
    setMessage("");
  }, [selectedLabId, selectedLab?.id, selectedLab?.practice_steps, selectedLab?.starter_resources, selectedLab?.assessment_rubric]);

  const parsedSteps = stepsText.split(/\r?\n/).map((step) => step.trim()).filter(Boolean);
  const rubricTotal = rubric.filter((row) => row.criterion.trim()).reduce((sum, row) => sum + Number(row.points || 0), 0);
  const resourceCount = resources.filter((resource) => resource.title.trim()).length;
  const rubricCount = rubric.filter((row) => row.criterion.trim()).length;
  const kitComplete = parsedSteps.length > 0 && resourceCount > 0 && rubricCount > 0 && rubricTotal === 100;

  function updateResource(index: number, field: keyof StarterResource, value: string) {
    setResources((current) => current.map((resource, i) => i === index ? { ...resource, [field]: value } : resource));
  }

  function updateRubric(index: number, field: keyof RubricCriterion, value: string | number) {
    setRubric((current) => current.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  async function saveKit() {
    if (!selectedLab) {
      setError("Select a practical lab first.");
      return;
    }
    setError("");
    setMessage("");

    if (parsedSteps.length === 0) {
      setError("Add at least one practice step before saving the kit.");
      return;
    }
    if (parsedSteps.length > 20 || parsedSteps.some((step) => step.length > 1000)) {
      setError("Use no more than 20 practice steps, each up to 1,000 characters.");
      return;
    }

    const cleanedResources = resources.map(cleanResource).filter((resource) => resource.title || resource.content.trim() || resource.url);
    if (cleanedResources.length === 0) {
      setError("Add at least one starter resource before saving the kit.");
      return;
    }
    if (cleanedResources.length > 20) {
      setError("A lab can contain no more than 20 starter resources.");
      return;
    }
    for (const resource of cleanedResources) {
      if (!resource.title) {
        setError("Every starter resource needs a title.");
        return;
      }
      if (!resource.content.trim() && !resource.url) {
        setError(`Add downloadable content or a link for “${resource.title}”.`);
        return;
      }
      if (resource.url && !/^https?:\/\//i.test(resource.url)) {
        setError(`The link for “${resource.title}” must begin with http:// or https://.`);
        return;
      }
      if (resource.filename && !/^[A-Za-z0-9._-]+$/.test(resource.filename)) {
        setError(`The filename for “${resource.title}” may use letters, numbers, dots, hyphens and underscores only.`);
        return;
      }
    }

    const cleanedRubric = rubric
      .map((row) => ({ ...row, criterion: row.criterion.trim(), description: row.description.trim(), points: Number(row.points) }))
      .filter((row) => row.criterion);
    if (cleanedRubric.length === 0) {
      setError("Add an assessment rubric before saving the kit.");
      return;
    }
    if (cleanedRubric.length > 20) {
      setError("A lab can contain no more than 20 rubric criteria.");
      return;
    }
    if (cleanedRubric.some((row) => !Number.isInteger(row.points) || row.points < 0 || row.points > 100)) {
      setError("Each rubric score must be a whole number between 0 and 100.");
      return;
    }
    if (cleanedRubric.length > 0 && cleanedRubric.reduce((sum, row) => sum + row.points, 0) !== 100) {
      setError("Rubric criteria must add up to exactly 100 points.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: saveError } = await supabase.rpc("update_practical_lab_kit", {
        p_lab_id: selectedLab.id,
        p_practice_steps: parsedSteps,
        p_starter_resources: cleanedResources,
        p_assessment_rubric: cleanedRubric,
      });
      if (saveError) throw new Error(saveError.message || "Unable to save the Lab Kit.");

      const nextLab: PracticalLab = {
        ...selectedLab,
        practice_steps: parsedSteps,
        starter_resources: cleanedResources,
        assessment_rubric: cleanedRubric,
      };
      setLabs((current) => current.map((lab) => lab.id === nextLab.id ? nextLab : lab));
      setMessage("Practical Lab Kit saved.");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the Lab Kit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rn-kit-manager">
      <div className="rn-kit-hero">
        <div>
          <span className="rn-kit-eyebrow">RUFFNECK LEARN · HANDS-ON LEARNING</span>
          <h1>Practical Lab Kit Manager</h1>
          <p>Add guided steps, downloadable starter material, and a 100-point rubric to each published lab.</p>
        </div>
        <span className={`rn-kit-completion ${kitComplete ? "complete" : "incomplete"}`}>{kitComplete ? "Kit complete" : "Kit needs work"}</span>
      </div>

      {labs.length === 0 ? (
        <section className="rn-kit-panel">
          <h2>No practical labs available</h2>
          <p>There are no labs in the courses available to your account. Create or assign a Practical Lab first.</p>
        </section>
      ) : (
        <div className="rn-kit-layout">
          <aside className="rn-kit-panel rn-kit-sidebar">
            <label className="rn-kit-field">
              <span>Select a lab</span>
              <select value={selectedLabId} onChange={(event) => setSelectedLabId(event.target.value)}>
                {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.title} — {courseMap.get(lab.course_id) ?? "Course"}</option>)}
              </select>
            </label>
            <div className="rn-kit-selected-summary">
              <span className="rn-kit-status-dot" />
              <div>
                <strong>{selectedLab?.is_published ? "Published lab" : "Unpublished lab"}</strong>
                <p>{selectedLab?.category || "Practical assessment"}{selectedLab?.difficulty ? ` · ${selectedLab.difficulty}` : ""}</p>
              </div>
            </div>
            <h3>Kit checklist</h3>
            <div className="rn-kit-check"><span>{parsedSteps.length > 0 ? "✓" : "1"}</span><div><strong>Practice steps</strong><small>{parsedSteps.length} configured</small></div></div>
            <div className="rn-kit-check"><span>{resourceCount > 0 ? "✓" : "2"}</span><div><strong>Starter resources</strong><small>{resourceCount} configured</small></div></div>
            <div className="rn-kit-check"><span>{rubricCount > 0 && rubricTotal === 100 ? "✓" : "3"}</span><div><strong>Assessment rubric</strong><small>{rubricCount} criteria · {rubricTotal}/100 points</small></div></div>
            <p className="rn-kit-sidebar-note">The student page continues to show the existing scenario, task brief and deliverable. This manager adds the missing practice materials without changing those fields.</p>
          </aside>

          <div className="rn-kit-main">
            {selectedLab && (
              <>
                <section className="rn-kit-panel">
                  <div className="rn-kit-section-heading"><span>01</span><div><h2>Step-by-step practice</h2><p>One action per line. Keep steps specific and observable.</p></div></div>
                  <label className="rn-kit-field"><span>Practice steps</span><textarea rows={7} value={stepsText} onChange={(event) => setStepsText(event.target.value)} placeholder={'Read the scenario and identify the objective.\nOpen the starter dataset.\nComplete the required calculations.\nCheck your work against the rubric.'} /></label>
                  <small className="rn-kit-help">{parsedSteps.length}/20 steps · Maximum 1,000 characters per step</small>
                </section>

                <section className="rn-kit-panel">
                  <div className="rn-kit-section-heading"><span>02</span><div><h2>Starter resources</h2><p>Attach text/CSV templates students can download, or link to a trusted external resource.</p></div></div>
                  <div className="rn-kit-resource-editor">
                    {resources.map((resource, index) => (
                      <article className="rn-kit-resource-card" key={`resource-${index}`}>
                        <div className="rn-kit-card-heading"><strong>Resource {index + 1}</strong><button type="button" className="rn-kit-remove" onClick={() => setResources((current) => current.filter((_, i) => i !== index))}>Remove</button></div>
                        <div className="rn-kit-two-col">
                          <label className="rn-kit-field"><span>Title</span><input value={resource.title} onChange={(event) => updateResource(index, "title", event.target.value)} maxLength={160} placeholder="e.g. Practice dataset" /></label>
                          <label className="rn-kit-field"><span>Download filename</span><input value={resource.filename} onChange={(event) => updateResource(index, "filename", event.target.value)} maxLength={120} placeholder="practice-data.csv" /></label>
                        </div>
                        <label className="rn-kit-field"><span>Description</span><input value={resource.description} onChange={(event) => updateResource(index, "description", event.target.value)} maxLength={1000} placeholder="Explain how the student should use this file." /></label>
                        <label className="rn-kit-field"><span>Starter file content</span><textarea rows={5} value={resource.content} onChange={(event) => updateResource(index, "content", event.target.value)} maxLength={20000} placeholder="Paste plain text, CSV rows, a worksheet template, a fictional case file, or a sample response." /></label>
                        <label className="rn-kit-field"><span>External URL (optional)</span><input value={resource.url} onChange={(event) => updateResource(index, "url", event.target.value)} placeholder="https://..." type="url" /></label>
                      </article>
                    ))}
                  </div>
                  <button type="button" className="rn-kit-secondary-button" disabled={resources.length >= 20} onClick={() => setResources((current) => [...current, emptyResource()])}>+ Add starter resource</button>
                  <small className="rn-kit-help">Use fictional data only. Each resource needs starter content or an http(s) link. Maximum 20 resources, 20,000 characters per resource.</small>
                </section>

                <section className="rn-kit-panel">
                  <div className="rn-kit-section-heading"><span>03</span><div><h2>Assessment rubric</h2><p>Criteria should add up to exactly 100 points.</p></div></div>
                  <div className="rn-kit-rubric-editor">
                    {rubric.map((row, index) => (
                      <article className="rn-kit-rubric-card" key={`rubric-${index}`}>
                        <div className="rn-kit-card-heading"><strong>Criterion {index + 1}</strong><button type="button" className="rn-kit-remove" onClick={() => setRubric((current) => current.filter((_, i) => i !== index))}>Remove</button></div>
                        <div className="rn-kit-two-col rubric-fields">
                          <label className="rn-kit-field"><span>Criterion</span><input value={row.criterion} onChange={(event) => updateRubric(index, "criterion", event.target.value)} maxLength={160} placeholder="e.g. Calculation accuracy" /></label>
                          <label className="rn-kit-field"><span>Points</span><input type="number" min={0} max={100} step={1} value={row.points} onChange={(event) => updateRubric(index, "points", event.target.value === "" ? 0 : Number(event.target.value))} /></label>
                        </div>
                        <label className="rn-kit-field"><span>What good work demonstrates</span><textarea rows={2} value={row.description} onChange={(event) => updateRubric(index, "description", event.target.value)} maxLength={1000} placeholder="Describe the evidence that earns these points." /></label>
                      </article>
                    ))}
                  </div>
                  <div className={`rn-kit-points-total ${rubricTotal === 100 ? "valid" : "invalid"}`}><span>Total rubric points</span><strong>{rubricTotal}/100</strong></div>
                  <button type="button" className="rn-kit-secondary-button" disabled={rubric.length >= 20} onClick={() => setRubric((current) => [...current, emptyRubricRow()])}>+ Add rubric criterion</button>
                </section>

                {error && <div className="rn-kit-alert error" role="alert">{error}</div>}
                {message && <div className="rn-kit-alert success" role="status">{message}</div>}
                <div className="rn-kit-save-row"><button type="button" className="rn-kit-save-button" onClick={() => void saveKit()} disabled={saving}>{saving ? "Saving Lab Kit…" : "Save Practical Lab Kit"}</button><span>Only kit fields are updated. Existing submissions, scores and feedback are not changed.</span></div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .rn-kit-manager{color:#e5eef8;display:grid;gap:18px}.rn-kit-manager *{box-sizing:border-box}.rn-kit-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:24px;border:1px solid #1c3a57;border-radius:16px;background:linear-gradient(135deg,#0c2036,#101d31)}.rn-kit-eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:#56d6eb}.rn-kit-hero h1{margin:9px 0 7px;font-size:clamp(24px,3vw,34px);letter-spacing:-.035em}.rn-kit-hero p{margin:0;color:#9fb3c9;line-height:1.65;font-size:13px;max-width:650px}.rn-kit-completion{display:inline-flex;white-space:nowrap;border-radius:99px;padding:8px 11px;font-size:10px;font-weight:800}.rn-kit-completion.complete{background:#123d32;color:#8ae8c7;border:1px solid #286b58}.rn-kit-completion.incomplete{background:#3b2d13;color:#f2d180;border:1px solid #775c2c}.rn-kit-layout{display:grid;grid-template-columns:minmax(230px,300px) minmax(0,1fr);gap:18px;align-items:start}.rn-kit-panel{min-width:0;border:1px solid #203a54;border-radius:14px;background:#0a1b2f;padding:20px}.rn-kit-sidebar{position:sticky;top:16px}.rn-kit-field{display:grid;gap:7px;margin:0 0 13px}.rn-kit-field>span{font-size:11px;font-weight:750;color:#cbdced}.rn-kit-field input,.rn-kit-field select,.rn-kit-field textarea{display:block;width:100%;min-width:0;border:1px solid #2a4561;border-radius:9px;background:#071629;color:#e5f1ff;padding:11px 12px;font:inherit;font-size:12px;line-height:1.6}.rn-kit-field textarea{resize:vertical}.rn-kit-field input:focus,.rn-kit-field select:focus,.rn-kit-field textarea:focus{outline:2px solid #00b4d8;outline-offset:1px}.rn-kit-selected-summary{display:flex;gap:10px;align-items:center;border-top:1px solid #20374e;border-bottom:1px solid #20374e;padding:15px 0;margin:12px 0 18px}.rn-kit-status-dot{width:9px;height:9px;border-radius:50%;background:#00b4d8;box-shadow:0 0 0 4px #00b4d81b}.rn-kit-selected-summary strong{font-size:12px}.rn-kit-selected-summary p{margin:4px 0 0;font-size:10px;color:#8ea7c0}.rn-kit-sidebar h3{font-size:12px;margin:0 0 12px}.rn-kit-check{display:flex;gap:10px;align-items:center;margin:11px 0}.rn-kit-check>span{display:grid;place-items:center;width:25px;height:25px;border:1px solid #31506d;border-radius:8px;color:#f5cf6b;font-size:11px;font-weight:800}.rn-kit-check strong,.rn-kit-check small{display:block}.rn-kit-check strong{font-size:11px}.rn-kit-check small{font-size:10px;color:#819bb6;margin-top:3px}.rn-kit-sidebar-note{font-size:10px;line-height:1.7;color:#819bb5;margin:19px 0 0}.rn-kit-main{display:grid;gap:16px;min-width:0}.rn-kit-section-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:17px}.rn-kit-section-heading>span{display:grid;place-items:center;flex:0 0 33px;width:33px;height:33px;border-radius:10px;background:#00b4d81a;border:1px solid #1f536b;color:#63deed;font-size:10px;font-weight:800}.rn-kit-section-heading h2{font-size:17px;margin:0 0 5px}.rn-kit-section-heading p{font-size:11px;line-height:1.6;color:#8ca7c0;margin:0}.rn-kit-help{display:block;font-size:10px;line-height:1.65;color:#7d98b2;margin-top:6px}.rn-kit-resource-editor,.rn-kit-rubric-editor{display:grid;gap:12px}.rn-kit-resource-card,.rn-kit-rubric-card{padding:15px;border:1px solid #203d58;border-radius:12px;background:#0c2035}.rn-kit-card-heading{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}.rn-kit-card-heading strong{font-size:11px;color:#e7f2ff}.rn-kit-remove{border:1px solid #693b42;border-radius:7px;padding:6px 8px;background:#361c26;color:#ffb4b7;font-size:10px;cursor:pointer}.rn-kit-two-col{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.rn-kit-secondary-button{border:1px solid #27516d;border-radius:9px;padding:9px 12px;background:#102840;color:#82e2f0;font-size:11px;font-weight:750;cursor:pointer;margin-top:12px}.rn-kit-secondary-button:disabled{opacity:.5;cursor:not-allowed}.rn-kit-rubric-card .rn-kit-field:last-child{margin-bottom:0}.rn-kit-points-total{display:flex;align-items:center;justify-content:space-between;padding:12px 13px;border-radius:9px;margin-top:12px;background:#101f31;border:1px solid #29415a;color:#9db5cc;font-size:11px}.rn-kit-points-total strong{font-size:13px}.rn-kit-points-total.valid strong{color:#88e7c5}.rn-kit-points-total.invalid strong{color:#f4d07b}.rn-kit-alert{border-radius:9px;padding:12px 14px;font-size:12px;line-height:1.6}.rn-kit-alert.error{background:#381f29;border:1px solid #703744;color:#ffb9bf}.rn-kit-alert.success{background:#0f352d;border:1px solid #255f4e;color:#9ae7ce}.rn-kit-save-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:16px;border:1px solid #203a54;background:#0a1b2f;border-radius:12px}.rn-kit-save-button{border:1px solid #00b4d8;border-radius:9px;background:#00b4d8;color:#041626;font-weight:850;font-size:12px;padding:12px 16px;cursor:pointer}.rn-kit-save-button:disabled{opacity:.6;cursor:wait}.rn-kit-save-row>span{font-size:10px;color:#7e98b3;line-height:1.6;max-width:400px}
        @media(max-width:760px){.rn-kit-layout{grid-template-columns:1fr}.rn-kit-sidebar{position:static}.rn-kit-two-col{grid-template-columns:1fr}.rn-kit-panel{padding:15px}.rn-kit-hero{padding:18px}}
      `}</style>
    </div>
  );
}
