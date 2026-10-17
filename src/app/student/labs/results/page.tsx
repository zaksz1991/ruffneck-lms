import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RubricCriterionResult = {
  criterion: string;
  description?: string;
  maxPoints: number;
  earnedPoints: number;
};

type RubricReview = {
  rubric_scores: RubricCriterionResult[];
  total_score: number;
  updated_at?: string;
};

type SubmissionRow = {
  id: string;
  lab_id: string;
  status: string;
  score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  updated_at: string | null;
};

type LabRow = {
  id: string;
  title: string;
  course_id: string;
};

type CourseRow = {
  id: string;
  title: string;
};

function parseReview(value: unknown): RubricReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.rubric_scores) || typeof row.total_score !== "number") return null;
  const rubricScores = row.rubric_scores.flatMap((item): RubricCriterionResult[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const criterion = item as Record<string, unknown>;
    if (typeof criterion.criterion !== "string") return [];
    const maxPoints = Number(criterion.maxPoints);
    const earnedPoints = Number(criterion.earnedPoints);
    if (!Number.isInteger(maxPoints) || maxPoints < 0 || !Number.isInteger(earnedPoints) || earnedPoints < 0 || earnedPoints > maxPoints) return [];
    return [{
      criterion: criterion.criterion,
      description: typeof criterion.description === "string" ? criterion.description : "",
      maxPoints,
      earnedPoints,
    }];
  });
  return {
    rubric_scores: rubricScores,
    total_score: Math.max(0, Math.min(100, Math.round(row.total_score))),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusText(status: string): string {
  return status === "approved" ? "Approved" : "Revision requested";
}

export default async function StudentLabResultsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=/student/labs/results");
  }

  const { data: submissionData, error: submissionsError } = await supabase
    .from("lab_submissions")
    .select("id, lab_id, status, score, feedback, submitted_at, updated_at")
    .eq("student_id", user.id)
    .in("status", ["approved", "revision_required"])
    .order("updated_at", { ascending: false })
    .limit(50);

  if (submissionsError) {
    console.error("Student lab results lookup failed:", submissionsError);
  }

  const submissions = (submissionData ?? []) as SubmissionRow[];
  const labIds = [...new Set(submissions.map((submission) => submission.lab_id))];
  const { data: labData, error: labsError } = labIds.length > 0
    ? await supabase.from("practical_labs").select("id, title, course_id").in("id", labIds)
    : { data: [], error: null };

  if (labsError) console.error("Student lab title lookup failed:", labsError);
  const labs = (labData ?? []) as LabRow[];
  const labMap = new Map(labs.map((lab) => [lab.id, lab]));
  const courseIds = [...new Set(labs.map((lab) => lab.course_id))];

  const { data: courseData, error: coursesError } = courseIds.length > 0
    ? await supabase.from("courses").select("id, title").in("id", courseIds)
    : { data: [], error: null };

  if (coursesError) console.error("Student lab result course lookup failed:", coursesError);
  const courses = (courseData ?? []) as CourseRow[];
  const courseMap = new Map(courses.map((course) => [course.id, course.title]));

  const resultRows = await Promise.all(submissions.map(async (submission) => {
    let rubricReview: RubricReview | null = null;
    let rubricAvailable = true;
    const { data, error } = await (supabase as any).rpc(
      "get_student_lab_rubric_review",
      { p_submission_id: submission.id },
    );

    if (error) {
      rubricAvailable = false;
      console.error("Student rubric detail is unavailable:", error.message);
    } else {
      rubricReview = parseReview(data);
    }

    const lab = labMap.get(submission.lab_id);
    return {
      submission,
      labTitle: lab?.title ?? "Practical Lab",
      courseTitle: lab ? courseMap.get(lab.course_id) ?? "Course" : "Course",
      rubricReview,
      rubricAvailable,
    };
  }));

  return (
    <main className="student-lab-results">
      <style>{`
        .student-lab-results{max-width:1080px;margin:0 auto;padding:32px 18px 56px;color:#eaf3fc}
        .slr-kicker{font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#60d7eb}
        .slr-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:28px}
        .slr-header h1{font-size:clamp(26px,4vw,38px);line-height:1.12;letter-spacing:-.03em;margin:9px 0 10px}
        .slr-header p{max-width:650px;color:#93abc4;font-size:13px;line-height:1.8;margin:0}
        .slr-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .slr-back{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 14px;border:1px solid #284663;border-radius:10px;color:#c7e9f4;text-decoration:none;font-size:12px;font-weight:700;background:#0d2136}
        .slr-empty{padding:30px 22px;border:1px dashed #2b4762;border-radius:16px;background:#0a1a2b;text-align:center}
        .slr-empty h2{margin:0 0 8px;font-size:18px}.slr-empty p{color:#92a9c0;font-size:13px;line-height:1.8;margin:0 auto 18px;max-width:550px}
        .slr-list{display:grid;gap:18px}
        .slr-card{min-width:0;border:1px solid #223d59;border-radius:16px;background:linear-gradient(150deg,#0e2238,#091929);padding:22px}
        .slr-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;border-bottom:1px solid #20384f;padding-bottom:16px;margin-bottom:16px}
        .slr-course{font-size:10px;color:#69dceb;font-weight:750;letter-spacing:.08em;text-transform:uppercase}
        .slr-card h2{font-size:19px;line-height:1.4;margin:6px 0}.slr-date{font-size:11px;color:#7995b0}
        .slr-status{display:inline-flex;border:1px solid #285e53;border-radius:999px;padding:7px 10px;background:#10362f;color:#90e5c9;font-size:10px;font-weight:800;white-space:nowrap}
        .slr-status.revision{border-color:#785c2b;background:#342914;color:#f6d487}
        .slr-summary{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:14px 0 20px}
        .slr-score{font-size:30px;line-height:1;font-weight:850;letter-spacing:-.04em;color:#f6d477}.slr-score small{font-size:13px;color:#8299b2;font-weight:600;letter-spacing:0}
        .slr-feedback{border:1px solid #274761;border-radius:11px;background:#0a1a2b;padding:14px;margin:16px 0 20px}
        .slr-feedback h3{font-size:11px;color:#7adce9;margin:0 0 7px;text-transform:uppercase;letter-spacing:.08em}.slr-feedback p{font-size:12px;line-height:1.8;color:#c4d5e7;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
        .slr-rubric h3{font-size:12px;margin:0 0 11px}.slr-rubric-note{font-size:12px;line-height:1.8;color:#90a7bf;margin:0}
        .slr-criterion{padding:12px 0;border-top:1px solid #1e374f;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}
        .slr-criterion strong{font-size:12px;color:#e2effa}.slr-criterion p{font-size:11px;line-height:1.7;color:#8fa7c0;margin:4px 0 0}
        .slr-points{font-size:12px;font-weight:800;color:#80e0c3;white-space:nowrap}.slr-total{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid #2a4560;padding-top:14px;margin-top:8px;font-size:12px;color:#b7cadd}.slr-total strong{font-size:16px;color:#f6d477}
        @media(max-width:540px){.student-lab-results{padding:24px 12px 40px}.slr-card{padding:16px}.slr-criterion{grid-template-columns:minmax(0,1fr) auto}.slr-score{font-size:26px}}
      `}</style>
      <header className="slr-header">
        <div>
          <div className="slr-kicker">RuffNeck Learn · Practical assessment</div>
          <h1>My Practical Lab Results</h1>
          <p>Review your score, read your instructor&apos;s feedback, and see how each rubric criterion contributed to your result. Revision requests include the feedback you need to improve your work.</p>
        </div>
        <div className="slr-actions">
          <Link className="slr-back" href="/student/labs/history">Revision history</Link>
          <Link className="slr-back" href="/student/labs">← Back to Practical Labs</Link>
        </div>
      </header>
      {submissionsError ? (
        <section className="slr-empty">
          <h2>Results could not be loaded</h2>
          <p>Your results are not available right now. Refresh the page later. Your existing submissions have not been changed.</p>
        </section>
      ) : resultRows.length === 0 ? (
        <section className="slr-empty">
          <h2>No reviewed lab submissions yet</h2>
          <p>Once an instructor approves your work or requests a revision, the result and feedback will appear here.</p>
          <Link className="slr-back" href="/student/labs">Explore Practical Labs</Link>
        </section>
      ) : (
        <div className="slr-list">
          {resultRows.map(({ submission, labTitle, courseTitle, rubricReview, rubricAvailable }) => (
            <article className="slr-card" key={submission.id}>
              <div className="slr-card-head">
                <div>
                  <div className="slr-course">{courseTitle}</div>
                  <h2>{labTitle}</h2>
                  <div className="slr-date">Last updated: {formatDate(submission.updated_at ?? submission.submitted_at)}</div>
                </div>
                <span className={`slr-status ${submission.status === "revision_required" ? "revision" : ""}`}>{statusText(submission.status)}</span>
              </div>
              <div className="slr-summary">
                <div className="slr-score">{submission.score === null ? "—" : submission.score}<small> / 100</small></div>
              </div>
              <section className="slr-feedback">
                <h3>Instructor feedback</h3>
                <p>{submission.feedback?.trim() || "No written feedback was recorded for this review."}</p>
              </section>
              <section className="slr-rubric">
                <h3>Criterion-level score breakdown</h3>
                {rubricReview && rubricReview.rubric_scores.length > 0 ? (
                  <>
                    {rubricReview.rubric_scores.map((criterion, index) => (
                      <div className="slr-criterion" key={`${submission.id}-${criterion.criterion}-${index}`}>
                        <div>
                          <strong>{criterion.criterion}</strong>
                          {criterion.description && <p>{criterion.description}</p>}
                        </div>
                        <span className="slr-points">{criterion.earnedPoints}/{criterion.maxPoints}</span>
                      </div>
                    ))}
                    <div className="slr-total"><span>Rubric total</span><strong>{rubricReview.total_score}/100</strong></div>
                  </>
                ) : (
                  <p className="slr-rubric-note">
                    {rubricAvailable
                      ? "A criterion-level breakdown is not available for this review. Older reviews may contain only the overall score and written feedback."
                      : "Detailed rubric results are temporarily unavailable. Your overall score and instructor feedback are shown above."}
                  </p>
                )}
              </section>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
