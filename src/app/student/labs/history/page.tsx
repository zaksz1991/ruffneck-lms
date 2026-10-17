import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HistoryRow = {
  id: string;
  submission_id: string;
  lab_id: string;
  student_id: string;
  answer_text: string | null;
  status: string | null;
  score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  previous_updated_at: string | null;
  snapshot_at: string;
  event_type: string;
};

type LabRow = { id: string; title: string; course_id: string };
type CourseRow = { id: string; title: string };

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function eventLabel(value: string): string {
  const labels: Record<string, string> = {
    revision_resubmitted: "Student resubmitted revised work",
    revision_requested: "Instructor requested a revision",
    approved: "Instructor approved the submission",
    submitted: "Submission sent for review",
    response_updated: "Response content changed",
    review_updated: "Review details changed",
    status_changed: "Submission status changed",
    submission_updated: "Submission record updated",
  };
  return labels[value] ?? "Submission updated";
}

function statusLabel(value: string | null): string {
  if (!value) return "Status unavailable";
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Awaiting review",
    revision_required: "Revision required",
    approved: "Approved",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export default async function StudentLabHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=/student/labs/history");
  }

  // The migration creates this table. `any` keeps this page compatible with
  // projects whose generated Supabase types have not yet been regenerated.
  const historyClient = supabase as any;
  const {
    data: historyData,
    error: historyError,
  } = await historyClient
    .from("lab_submission_history")
    .select(
      "id, submission_id, lab_id, student_id, answer_text, status, score, feedback, submitted_at, reviewed_at, reviewed_by, previous_updated_at, snapshot_at, event_type",
    )
    .eq("student_id", user.id)
    .order("snapshot_at", { ascending: false })
    .limit(100);

  const historyRows = (historyData ?? []) as HistoryRow[];
  const labIds = [...new Set(historyRows.map((row) => row.lab_id))];

  const { data: labData } = labIds.length
    ? await supabase
        .from("practical_labs")
        .select("id, title, course_id")
        .in("id", labIds)
    : { data: [], error: null };

  const labs = (labData ?? []) as LabRow[];
  const labMap = new Map(labs.map((lab) => [lab.id, lab]));
  const courseIds = [...new Set(labs.map((lab) => lab.course_id))];

  const { data: courseData } = courseIds.length
    ? await supabase
        .from("courses")
        .select("id, title")
        .in("id", courseIds)
    : { data: [], error: null };

  const courses = (courseData ?? []) as CourseRow[];
  const courseMap = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <main className="lab-history-page">
      <style>{`
        .lab-history-page{max-width:1080px;margin:0 auto;padding:32px 18px 56px;color:#eaf3fc}
        .lh-kicker{font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#60d7eb}
        .lh-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
        .lh-head h1{font-size:clamp(27px,4vw,38px);line-height:1.12;letter-spacing:-.03em;margin:9px 0 10px}
        .lh-head p{max-width:680px;color:#93abc4;font-size:13px;line-height:1.8;margin:0}
        .lh-actions{display:flex;gap:8px;flex-wrap:wrap}
        .lh-link{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 14px;border:1px solid #284663;border-radius:10px;color:#c7e9f4;text-decoration:none;font-size:12px;font-weight:700;background:#0d2136}
        .lh-empty{padding:30px 22px;border:1px dashed #2b4762;border-radius:16px;background:#0a1a2b;text-align:center}
        .lh-empty h2{margin:0 0 8px;font-size:18px}.lh-empty p{color:#92a9c0;font-size:13px;line-height:1.8;margin:0 auto 18px;max-width:620px}
        .lh-list{display:grid;gap:14px}.lh-entry{min-width:0;border:1px solid #223d59;border-radius:15px;background:linear-gradient(150deg,#0e2238,#091929);padding:20px}
        .lh-entry-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:1px solid #20384f;padding-bottom:13px;margin-bottom:14px}
        .lh-course{font-size:10px;color:#69dceb;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.lh-entry h2{font-size:17px;line-height:1.45;margin:5px 0}.lh-date{font-size:11px;color:#7995b0}
        .lh-event{display:inline-flex;border:1px solid #285e53;border-radius:999px;padding:7px 10px;background:#10362f;color:#90e5c9;font-size:10px;font-weight:800;max-width:100%}
        .lh-meta{display:flex;gap:10px;flex-wrap:wrap;color:#9eb3c9;font-size:12px;margin:0 0 12px}.lh-meta strong{color:#eef5fd}
        .lh-detail{border:1px solid #274761;border-radius:10px;background:#0a1a2b;padding:12px 14px;margin-top:12px}.lh-detail summary{cursor:pointer;color:#8edeea;font-size:12px;font-weight:750}.lh-content{white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto;color:#c8d8e8;font-size:12px;line-height:1.7;margin:14px 0 0}
        .lh-feedback{white-space:pre-wrap;overflow-wrap:anywhere;color:#c8d8e8;font-size:12px;line-height:1.7;margin:12px 0 0}
        @media(max-width:540px){.lab-history-page{padding:24px 12px 40px}.lh-entry{padding:15px}.lh-event{white-space:normal}}
      `}</style>

      <header className="lh-head">
        <div>
          <div className="lh-kicker">RuffNeck Learn · Practical assessment</div>
          <h1>My Practical Lab History</h1>
          <p>
            Review previous versions of your Practical Lab submissions. The timeline records the state of your work before later edits or review decisions. History starts when this feature is enabled; older changes are not reconstructed.
          </p>
        </div>
        <div className="lh-actions">
          <Link className="lh-link" href="/student/labs/results">My results</Link>
          <Link className="lh-link" href="/student/labs">Back to Practical Labs</Link>
        </div>
      </header>

      {historyError ? (
        <section className="lh-empty">
          <h2>Revision history is not available yet</h2>
          <p>
            The history table could not be read. Confirm that the Practical Lab submission history migration has been applied and that the deployed application is using the updated database schema. Your current submissions have not been changed.
          </p>
        </section>
      ) : historyRows.length === 0 ? (
        <section className="lh-empty">
          <h2>No previous versions recorded yet</h2>
          <p>
            When a submission or its review changes after the history feature is installed, the previous version will appear here. Your current submission and results remain available in the Practical Labs pages.
          </p>
          <Link className="lh-link" href="/student/labs">Open Practical Labs</Link>
        </section>
      ) : (
        <div className="lh-list">
          {historyRows.map((row) => {
            const lab = labMap.get(row.lab_id);
            const courseTitle = lab ? courseMap.get(lab.course_id) ?? "Course" : "Course";
            return (
              <article className="lh-entry" key={row.id}>
                <div className="lh-entry-head">
                  <div>
                    <div className="lh-course">{courseTitle}</div>
                    <h2>{lab?.title ?? "Practical Lab"}</h2>
                    <div className="lh-date">Snapshot recorded: {formatDate(row.snapshot_at)}</div>
                  </div>
                  <span className="lh-event">{eventLabel(row.event_type)}</span>
                </div>
                <div className="lh-meta">
                  <span>Previous status: <strong>{statusLabel(row.status)}</strong></span>
                  <span>Previous score: <strong>{row.score === null ? "Not scored" : `${row.score}/100`}</strong></span>
                  <span>Previous update: <strong>{formatDate(row.previous_updated_at)}</strong></span>
                </div>
                {row.feedback?.trim() ? (
                  <div className="lh-detail">
                    <strong style={{ color: "#8edeea", fontSize: 12 }}>Feedback in this version</strong>
                    <p className="lh-feedback">{row.feedback}</p>
                  </div>
                ) : null}
                <details className="lh-detail">
                  <summary>View previous submitted response</summary>
                  <pre className="lh-content">{row.answer_text?.trim() || "This version did not contain a response."}</pre>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
