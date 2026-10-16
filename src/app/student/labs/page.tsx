import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LabWorkspace, {
  type LabCard,
  type LabSubmission,
} from "@/components/student/LabWorkspace";

type Enrollment = {
  course_id: string;
  enrollment_status: string | null;
  payment_status: string | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

type LabRow = {
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
};

const REVIEWABLE_STATUSES = [
  "draft",
  "submitted",
  "revision_required",
  "approved",
];

function formatStatus(status: string) {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Awaiting review";
    case "revision_required":
      return "Revision required";
    case "approved":
      return "Approved";
    default:
      return status.replaceAll("_", " ");
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function StudentLabsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/labs");
  }

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select("course_id, enrollment_status, payment_status")
    .eq("student_id", user.id);

  if (enrollmentError) {
    console.error(
      "Practical Lab enrollment lookup failed:",
      enrollmentError,
    );
  }

  const enrollments = (enrollmentData ?? []) as Enrollment[];

  const eligibleCourseIds = [
    ...new Set(
      enrollments
        .filter(
          (item) =>
            ["active", "completed"].includes(
              item.enrollment_status ?? "",
            ) &&
            ["free", "paid"].includes(item.payment_status ?? ""),
        )
        .map((item) => item.course_id),
    ),
  ];

  let courses: Course[] = [];
  let labs: LabRow[] = [];
  let submissions: LabSubmission[] = [];
  let setupRequired = false;
  let loadError = false;

  if (eligibleCourseIds.length > 0) {
    const {
      data: courseData,
      error: courseError,
    } = await supabase
      .from("courses")
      .select("id, title, slug")
      .in("id", eligibleCourseIds)
      .eq("status", "published");

    if (courseError) {
      console.error(
        "Practical Lab course lookup failed:",
        courseError,
      );
      loadError = true;
    } else {
      courses = (courseData ?? []) as Course[];
    }

    if (courses.length > 0) {
      const {
        data: labData,
        error: labError,
      } = await supabase
        .from("practical_labs")
        .select(
          "id, course_id, slug, title, summary, category, difficulty, estimated_minutes, instructions, deliverable, is_published, sort_order",
        )
        .in(
          "course_id",
          courses.map((course) => course.id),
        )
        .eq("is_published", true)
        .order("sort_order", { ascending: true });

      if (labError) {
        console.error(
          "Practical Lab list lookup failed:",
          labError,
        );

        setupRequired =
          labError.code === "42P01" ||
          labError.code === "PGRST205";

        loadError = !setupRequired;
      } else {
        labs = (labData ?? []) as LabRow[];
      }
    }

    const {
      data: submissionData,
      error: submissionError,
    } = await supabase
      .from("lab_submissions")
      .select(
        "id, lab_id, status, score, feedback, answer_text, updated_at",
      )
      .eq("student_id", user.id)
      .order("updated_at", { ascending: false });

    if (submissionError) {
      console.error(
        "Practical Lab submission lookup failed:",
        submissionError,
      );

      setupRequired =
        setupRequired ||
        submissionError.code === "42P01" ||
        submissionError.code === "PGRST205";

      loadError = !setupRequired;
    } else {
      submissions = (submissionData ?? []) as LabSubmission[];
    }
  }

  const courseMap = new Map(
    courses.map((course) => [course.id, course]),
  );

  const labCards: LabCard[] = labs.map((lab) => ({
    ...lab,
    course_title:
      courseMap.get(lab.course_id)?.title ?? "Your course",
    course_slug:
      courseMap.get(lab.course_id)?.slug ?? "",
  }));

  const submittedCount = submissions.filter((item) =>
    ["submitted", "revision_required", "approved"].includes(
      item.status,
    ),
  ).length;

  const approvedCount = submissions.filter(
    (item) => item.status === "approved",
  ).length;

  const awaitingReviewCount = submissions.filter(
    (item) => item.status === "submitted",
  ).length;

  const revisionCount = submissions.filter(
    (item) => item.status === "revision_required",
  ).length;

  const scoredSubmissions = submissions.filter(
    (item) =>
      item.score !== null &&
      item.score !== undefined &&
      Number.isFinite(Number(item.score)),
  );

  const averageScore =
    scoredSubmissions.length > 0
      ? Math.round(
          scoredSubmissions.reduce(
            (sum, item) => sum + Number(item.score),
            0,
          ) / scoredSubmissions.length,
        )
      : null;

  const latestReviewed = submissions
    .filter(
      (item) =>
        item.status === "approved" ||
        item.status === "revision_required",
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() -
        new Date(a.updated_at).getTime(),
    )[0];

  const labMap = new Map(labs.map((lab) => [lab.id, lab]));

  return (
    <main className="rn-lab-page">
      <div className="rn-lab-shell">
        <div className="rn-lab-topline">
          <Link href="/student" className="rn-lab-back">
            ← Student dashboard
          </Link>

          <span className="rn-lab-brand">
            RUFFNECK <b>LEARN</b>
          </span>
        </div>

        <header className="rn-lab-hero">
          <div className="rn-lab-hero-copy">
            <span className="rn-lab-eyebrow">
              <span className="rn-lab-live-dot" />
              PRACTICE • APPLY • IMPROVE
            </span>

            <h1>
              Practical Learning <em>Lab</em>
            </h1>

            <p>
              Turn course knowledge into work you can demonstrate.
              Complete realistic tasks, submit your work, respond to
              feedback, and build evidence of your skills.
            </p>

            <div className="rn-lab-hero-actions">
              <a href="#lab-workspace" className="rn-lab-primary">
                Explore practical tasks <span>↘</span>
              </a>

              <span className="rn-lab-safe-note">
                Your submissions are private to your account.
              </span>
            </div>
          </div>

          <div className="rn-lab-hero-art" aria-hidden="true">
            <div className="rn-lab-orbit rn-lab-orbit-one" />
            <div className="rn-lab-orbit rn-lab-orbit-two" />

            <div className="rn-lab-art-card rn-lab-art-card-main">
              <div className="rn-lab-art-icon">⌘</div>

              <div className="rn-lab-art-lines">
                <i />
                <i />
                <i />
              </div>

              <div className="rn-lab-art-progress">
                <span />
              </div>

              <small>LEARNING BY DOING</small>
            </div>

            <div className="rn-lab-art-badge rn-lab-art-badge-top">
              ✦ Real-world tasks
            </div>

            <div className="rn-lab-art-badge rn-lab-art-badge-bottom">
              ✓ Skills in action
            </div>
          </div>
        </header>

        <section className="rn-lab-stats" aria-label="Lab overview">
          <div className="rn-lab-stat">
            <span className="rn-lab-stat-icon">▦</span>
            <div>
              <strong>{labCards.length}</strong>
              <span>Available tasks</span>
            </div>
          </div>

          <div className="rn-lab-stat">
            <span className="rn-lab-stat-icon">◷</span>
            <div>
              <strong>
                {labCards.reduce(
                  (sum, lab) =>
                    sum + (lab.estimated_minutes || 0),
                  0,
                )}
              </strong>
              <span>Practice minutes</span>
            </div>
          </div>

          <div className="rn-lab-stat">
            <span className="rn-lab-stat-icon">✓</span>
            <div>
              <strong>{submittedCount}</strong>
              <span>Tasks submitted</span>
            </div>
          </div>

          <div className="rn-lab-stat">
            <span className="rn-lab-stat-icon">◎</span>
            <div>
              <strong>{approvedCount}</strong>
              <span>Tasks approved</span>
            </div>
          </div>
        </section>

        {setupRequired ? (
          <section className="rn-lab-notice">
            <strong>
              The Practical Lab database setup is required.
            </strong>

            <p>
              Apply the Supabase migration{" "}
              <code>
                supabase/migrations/202610090001_practical_learning_lab.sql
              </code>{" "}
              and the subsequent security migrations, then refresh
              this page.
            </p>
          </section>
        ) : null}

        {loadError && !setupRequired ? (
          <section className="rn-lab-notice rn-lab-error-notice">
            <strong>Some lab information could not be loaded.</strong>
            <p>
              Refresh the page. If the problem continues, check the
              Supabase logs and row-level security policies.
            </p>
          </section>
        ) : null}

        {eligibleCourseIds.length === 0 ? (
          <section className="rn-lab-empty">
            <div className="rn-lab-empty-icon">▤</div>

            <h2>Start with an enrolled course</h2>

            <p>
              Practical tasks appear here for courses you are
              actively enrolled in. Enrol in a course to unlock
              its lab activities.
            </p>

            <Link href="/courses" className="rn-lab-primary">
              Browse courses <span>→</span>
            </Link>
          </section>
        ) : (
          <>
            <section className="rn-lab-progress-panel">
              <div className="rn-lab-section-heading">
                <div>
                  <span className="rn-lab-eyebrow">
                    YOUR ASSESSMENT PROGRESS
                  </span>

                  <h2>Submission overview</h2>

                  <p>
                    Track reviews and see which tasks need your
                    attention.
                  </p>
                </div>
              </div>

              <div className="rn-lab-review-grid">
                <div className="rn-lab-review-stat">
                  <span className="rn-lab-review-indicator pending" />
                  <div>
                    <strong>{awaitingReviewCount}</strong>
                    <span>Awaiting review</span>
                  </div>
                </div>

                <div className="rn-lab-review-stat">
                  <span className="rn-lab-review-indicator revision" />
                  <div>
                    <strong>{revisionCount}</strong>
                    <span>Needs revision</span>
                  </div>
                </div>

                <div className="rn-lab-review-stat">
                  <span className="rn-lab-review-indicator approved" />
                  <div>
                    <strong>{approvedCount}</strong>
                    <span>Approved</span>
                  </div>
                </div>

                <div className="rn-lab-review-stat">
                  <span className="rn-lab-review-indicator score" />
                  <div>
                    <strong>
                      {averageScore === null
                        ? "—"
                        : `${averageScore}%`}
                    </strong>
                    <span>Average score</span>
                  </div>
                </div>
              </div>
            </section>

            {latestReviewed ? (
              <section className="rn-lab-feedback-panel">
                <div className="rn-lab-feedback-heading">
                  <div>
                    <span className="rn-lab-eyebrow">
                      LATEST REVIEW
                    </span>

                    <h2>
                      {labMap.get(latestReviewed.lab_id)?.title ??
                        "Practical task"}
                    </h2>

                    <p>
                      Updated{" "}
                      {formatDate(latestReviewed.updated_at)}
                    </p>
                  </div>

                  <span
                    className={`rn-lab-review-badge ${
                      latestReviewed.status === "approved"
                        ? "approved"
                        : "revision"
                    }`}
                  >
                    {formatStatus(latestReviewed.status)}
                  </span>
                </div>

                <div className="rn-lab-feedback-details">
                  <div className="rn-lab-feedback-score">
                    <span>Your score</span>

                    <strong>
                      {latestReviewed.score === null
                        ? "Not scored"
                        : `${latestReviewed.score}/100`}
                    </strong>
                  </div>

                  <div className="rn-lab-feedback-copy">
                    <strong>Reviewer feedback</strong>

                    <p>
                      {latestReviewed.feedback ||
                        "No written feedback has been provided yet."}
                    </p>
                  </div>
                </div>

                {latestReviewed.status === "revision_required" ? (
                  <div className="rn-lab-revision-hint">
                    <strong>Action required</strong>

                    <p>
                      Review the feedback and update your work in the
                      task workspace below before submitting it again.
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section
              id="lab-workspace"
              className="rn-lab-workspace"
            >
              <div className="rn-lab-section-heading">
                <div>
                  <span className="rn-lab-eyebrow">
                    YOUR WORKSPACE
                  </span>

                  <h2>Choose a practical task</h2>

                  <p>
                    Work through the brief, create your deliverable,
                    and submit it for review.
                  </p>
                </div>

                <span className="rn-lab-course-count">
                  {courses.length} enrolled{" "}
                  {courses.length === 1 ? "course" : "courses"}
                </span>
              </div>

              {labCards.length > 0 ? (
                <LabWorkspace
                  labs={labCards}
                  submissions={submissions}
                />
              ) : (
                <div className="rn-lab-empty rn-lab-empty-compact">
                  <div className="rn-lab-empty-icon">✦</div>

                  <h2>No published tasks yet</h2>

                  <p>
                    Your enrolled courses are connected. Lab
                    activities will appear here when published.
                  </p>

                  <Link
                    href="/student/courses"
                    className="rn-lab-secondary"
                  >
                    Return to My Learning →
                  </Link>
                </div>
              )}
            </section>
          </>
        )}

        <footer className="rn-lab-footer">
          <span>RUFFNECK LEARN</span>
          <span>
            Practice builds confidence. Evidence builds competence.
          </span>
        </footer>
      </div>

      <style>{`
        .rn-lab-page,.rn-lab-page *{box-sizing:border-box}
        .rn-lab-page{min-height:100vh;background:#071426;color:#eaf3ff;padding:28px 22px 48px;font-family:inherit}
        .rn-lab-shell{max-width:1200px;margin:0 auto}
        .rn-lab-topline{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
        .rn-lab-back{display:inline-flex;align-items:center;min-height:36px;color:#9db3ce;text-decoration:none;font-size:13px}
        .rn-lab-back:hover{color:#00b4d8}
        .rn-lab-brand{font-size:12px;letter-spacing:.16em;color:#dbeafe;font-weight:700}
        .rn-lab-brand b{color:#00b4d8}
        .rn-lab-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.25fr .75fr;align-items:center;min-height:340px;padding:46px 48px;border:1px solid #1b3654;border-radius:26px;background:radial-gradient(ellipse at 82% 30%,rgba(0,180,216,.16),transparent 42%),linear-gradient(125deg,#102542,#09182b 70%);box-shadow:0 24px 70px #02081455}
        .rn-lab-eyebrow{display:inline-flex;align-items:center;gap:9px;font-size:10px;font-weight:800;letter-spacing:.17em;color:#69dff1}
        .rn-lab-live-dot{width:7px;height:7px;border-radius:50%;background:#00b4d8;box-shadow:0 0 12px #00b4d8}
        .rn-lab-hero h1{font-size:clamp(34px,4vw,54px);line-height:1.06;letter-spacing:-.045em;margin:17px 0 15px;color:#f5f9ff}
        .rn-lab-hero h1 em{font-style:normal;color:#00c2e8}
        .rn-lab-hero-copy>p{max-width:600px;color:#a9bdd5;line-height:1.75;font-size:14px;margin:0}
        .rn-lab-hero-actions{display:flex;align-items:center;gap:17px;flex-wrap:wrap;margin-top:26px}
        .rn-lab-primary,.rn-lab-secondary{display:inline-flex;gap:18px;align-items:center;justify-content:center;border-radius:10px;padding:12px 16px;text-decoration:none;font-weight:750;font-size:12px;transition:transform .15s,background .15s}
        .rn-lab-primary{background:#00b4d8;color:#041626;border:1px solid #00b4d8}
        .rn-lab-primary:hover{background:#50d8ef;transform:translateY(-1px)}
        .rn-lab-safe-note{font-size:11px;color:#7991ad}
        .rn-lab-hero-art{height:250px;position:relative;display:flex;align-items:center;justify-content:center}
        .rn-lab-orbit{position:absolute;border:1px solid #1d5370;border-radius:50%;transform:rotate(-25deg)}
        .rn-lab-orbit-one{width:260px;height:170px}
        .rn-lab-orbit-two{width:220px;height:240px;transform:rotate(45deg);border-color:#1b3a5b}
        .rn-lab-art-card{position:relative;z-index:2;background:linear-gradient(145deg,#163451,#0c2038);border:1px solid #2c5975;border-radius:18px;box-shadow:0 20px 45px #02081399}
        .rn-lab-art-card-main{width:180px;padding:18px}
        .rn-lab-art-icon{width:42px;height:42px;border-radius:12px;background:#00b4d822;color:#55dff4;display:grid;place-items:center;font-size:24px;margin-bottom:18px}
        .rn-lab-art-lines{display:grid;gap:7px}
        .rn-lab-art-lines i{height:5px;border-radius:9px;background:#31516e}
        .rn-lab-art-lines i:first-child{width:92%}
        .rn-lab-art-lines i:nth-child(2){width:70%}
        .rn-lab-art-lines i:nth-child(3){width:82%}
        .rn-lab-art-progress{height:6px;border-radius:9px;background:#25415c;margin:18px 0 13px;overflow:hidden}
        .rn-lab-art-progress span{display:block;width:72%;height:100%;background:#00b4d8;border-radius:9px}
        .rn-lab-art-card small{font-size:8px;letter-spacing:.15em;color:#83a7c5}
        .rn-lab-art-badge{position:absolute;z-index:3;background:#132c47;border:1px solid #2a4c6c;color:#d8e9f9;padding:10px 13px;border-radius:10px;font-size:10px;box-shadow:0 8px 25px #02081366}
        .rn-lab-art-badge-top{top:24px;right:0}
        .rn-lab-art-badge-bottom{bottom:17px;left:0;color:#6ce7d1}
        .rn-lab-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:18px 0 38px}
        .rn-lab-stat{display:flex;align-items:center;gap:13px;padding:18px;background:#0b1c31;border:1px solid #1b3450;border-radius:15px}
        .rn-lab-stat-icon{display:grid;place-items:center;flex:0 0 42px;height:42px;border-radius:12px;background:#00b4d817;color:#4ad7ef;font-size:20px}
        .rn-lab-stat strong{display:block;font-size:22px;line-height:1.2;color:#f1f7ff}
        .rn-lab-stat div>span{display:block;margin-top:5px;font-size:11px;color:#8fa8c5}
        .rn-lab-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px}
        .rn-lab-section-heading h2{font-size:26px;letter-spacing:-.03em;margin:9px 0 7px}
        .rn-lab-section-heading p{color:#8fa8c5;font-size:13px;margin:0;line-height:1.7}
        .rn-lab-course-count{font-size:11px;color:#94b1cc;border:1px solid #23405e;border-radius:30px;padding:8px 12px;white-space:nowrap}
        .rn-lab-notice{padding:20px;border:1px solid #80682a;background:#332a12;border-radius:14px;margin:0 0 24px;color:#ffe7a0}
        .rn-lab-notice p{font-size:13px;line-height:1.7;margin-bottom:0}
        .rn-lab-notice code{overflow-wrap:anywhere;color:#fff4cb}
        .rn-lab-error-notice{border-color:#87444b;background:#321b25;color:#ffd9df}
        .rn-lab-empty{text-align:center;padding:52px 24px;border:1px dashed #294562;border-radius:20px;background:#0a1a2e}
        .rn-lab-empty-icon{margin:0 auto 16px;width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:#00b4d81c;color:#39d3ec;font-size:24px}
        .rn-lab-empty h2{margin:0 0 10px;font-size:21px}
        .rn-lab-empty p{max-width:550px;margin:0 auto 20px;color:#91a9c4;line-height:1.7;font-size:13px}
        .rn-lab-secondary{color:#9feeff;border:1px solid #24516d}
        .rn-lab-empty-compact{margin-top:10px}
        .rn-lab-progress-panel,.rn-lab-feedback-panel{padding:25px;border:1px solid #1b3450;border-radius:20px;background:linear-gradient(135deg,#0c2037,#09182a);margin-bottom:22px}
        .rn-lab-review-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .rn-lab-review-stat{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid #1b3450;border-radius:13px;background:#0a192b}
        .rn-lab-review-stat strong{display:block;font-size:21px;color:#f3f8ff}
        .rn-lab-review-stat div>span{display:block;font-size:11px;color:#91a9c4;margin-top:5px}
        .rn-lab-review-indicator{flex:0 0 9px;height:9px;border-radius:50%}
        .rn-lab-review-indicator.pending{background:#fbbf24}
        .rn-lab-review-indicator.revision{background:#fb7185}
        .rn-lab-review-indicator.approved{background:#34d399}
        .rn-lab-review-indicator.score{background:#38bdf8}
        .rn-lab-feedback-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
        .rn-lab-feedback-heading h2{font-size:21px;margin:10px 0 6px}
        .rn-lab-feedback-heading p{font-size:11px;color:#8fa8c5;margin:0}
        .rn-lab-review-badge{display:inline-flex;align-items:center;padding:8px 12px;border-radius:30px;font-size:11px;font-weight:750}
        .rn-lab-review-badge.approved{background:#064e3b66;color:#6ee7b7;border:1px solid #166b50}
        .rn-lab-review-badge.revision{background:#7f1d1d44;color:#fda4af;border:1px solid #87444b}
        .rn-lab-feedback-details{display:grid;grid-template-columns:minmax(130px,.35fr) minmax(0,1fr);gap:20px}
        .rn-lab-feedback-score{padding:17px;border-radius:13px;border:1px solid #21405d;background:#0a192b}
        .rn-lab-feedback-score span{display:block;font-size:11px;color:#8fa8c5}
        .rn-lab-feedback-score strong{display:block;font-size:25px;color:#55dff4;margin-top:8px}
        .rn-lab-feedback-copy{padding:17px;border:1px solid #21405d;border-radius:13px;background:#0a192b;min-width:0}
        .rn-lab-feedback-copy>strong{font-size:12px;color:#dcecff}
        .rn-lab-feedback-copy p{font-size:13px;line-height:1.8;color:#a9bdd5;white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0 0}
        .rn-lab-revision-hint{margin-top:15px;padding:15px 17px;border:1px solid #87444b;border-radius:12px;background:#321b25}
        .rn-lab-revision-hint strong{font-size:12px;color:#fda4af}
        .rn-lab-revision-hint p{font-size:12px;line-height:1.7;color:#e8b7bf;margin:7px 0 0}
        .rn-lab-footer{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;border-top:1px solid #172d46;margin-top:54px;padding-top:20px;font-size:10px;color:#67819e}
        .rn-lab-footer span:first-child{letter-spacing:.15em;font-weight:800;color:#8ca7c4}
        .rn-lab-page a:focus-visible,.rn-lab-page button:focus-visible{outline:2px solid #63e5f5;outline-offset:3px}
        .rn-lab-page p,.rn-lab-page h1,.rn-lab-page h2,.rn-lab-page span{overflow-wrap:anywhere}
        @media(max-width:760px){.rn-lab-page{padding:18px 14px 35px}.rn-lab-hero{grid-template-columns:1fr;padding:30px 24px 20px}.rn-lab-hero-art{height:210px;margin-top:5px}.rn-lab-art-badge-top{right:8%}.rn-lab-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:28px}.rn-lab-stat{padding:14px 12px;gap:10px}.rn-lab-stat-icon{flex-basis:36px;height:36px}.rn-lab-stat strong{font-size:20px}.rn-lab-section-heading{align-items:flex-start;flex-direction:column}.rn-lab-section-heading h2{font-size:23px}.rn-lab-footer{flex-direction:column}.rn-lab-progress-panel,.rn-lab-feedback-panel{padding:18px}.rn-lab-review-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rn-lab-feedback-details{grid-template-columns:1fr}}
        @media(max-width:390px){.rn-lab-hero{padding:25px 18px 16px}.rn-lab-hero-actions{align-items:flex-start;flex-direction:column}.rn-lab-stats{gap:8px}.rn-lab-stat{align-items:flex-start;flex-direction:column}.rn-lab-art-badge{font-size:9px}.rn-lab-review-grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}