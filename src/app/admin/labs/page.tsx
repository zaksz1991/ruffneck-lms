import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LabReviewForm from "./LabReviewForm";

type Profile = {
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
};

type LabSubmission = {
  id: string;
  lab_id: string;
  student_id: string;
  answer_text: string;
  status: string;
  score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  created_at: string;
};

type Lab = {
  id: string;
  course_id: string;
  title: string;
  category: string | null;
  difficulty: string | null;
  instructions: string | null;
  deliverable: string | null;
};

type Course = {
  id: string;
  title: string;
  instructor_id: string | null;
};

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type StudentNameResult = {
  student_id: string;
  full_name: string | null;
};

type SearchParams = Promise<{
  status?: string;
}>;

const REVIEWABLE_STATUSES = ["submitted", "revision_required"];

function formatDate(value: string | null) {
  if (!value) return "Not submitted";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "submitted":
      return "Awaiting review";
    case "revision_required":
      return "Revision required";
    case "approved":
      return "Approved";
    case "draft":
      return "Draft";
    default:
      return status.replaceAll("_", " ");
  }
}

export default async function AdminLabsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=/admin/labs");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Lab review profile lookup failed:", profileError);
    throw new Error("Unable to verify reviewer permissions.");
  }

  const profile = profileData as Profile | null;

  if (!profile || (profile.role !== "admin" && profile.role !== "instructor")) {
    redirect("/student/dashboard");
  }

  const params = await searchParams;
  const selectedStatus = params.status ?? "all";
  const allowedFilters = [
    "all",
    "submitted",
    "revision_required",
    "approved",
  ];
  const activeFilter = allowedFilters.includes(selectedStatus)
    ? selectedStatus
    : "all";

  let submissionsQuery = supabase
    .from("lab_submissions")
    .select(
      "id, lab_id, student_id, answer_text, status, score, feedback, submitted_at, created_at",
    )
    .in("status", ["submitted", "revision_required", "approved"])
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (activeFilter !== "all") {
    submissionsQuery = submissionsQuery.eq("status", activeFilter);
  }

  const { data: submissionData, error: submissionsError } =
    await submissionsQuery;

  if (submissionsError) {
    console.error("Lab submissions lookup failed:", submissionsError);
    throw new Error(
      "Unable to load lab submissions. Check the Practical Labs database policies.",
    );
  }

  const submissions = (submissionData ?? []) as LabSubmission[];
  const labIds = [...new Set(submissions.map((item) => item.lab_id))];
  const studentIds = [...new Set(submissions.map((item) => item.student_id))];

  const { data: labData, error: labsError } =
    labIds.length > 0
      ? await supabase
          .from("practical_labs")
          .select(
            "id, course_id, title, category, difficulty, instructions, deliverable",
          )
          .in("id", labIds)
      : { data: [], error: null };

  if (labsError) {
    console.error("Practical labs lookup failed:", labsError);
    throw new Error("Unable to load practical lab details.");
  }

  const labs = (labData ?? []) as Lab[];
  const labMap = new Map(labs.map((lab) => [lab.id, lab]));
  const courseIds = [...new Set(labs.map((lab) => lab.course_id))];

  const { data: courseData, error: coursesError } =
    courseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title, instructor_id")
          .in("id", courseIds)
      : { data: [], error: null };

  if (coursesError) {
    console.error("Lab review courses lookup failed:", coursesError);
    throw new Error("Unable to load course details.");
  }

  const courses = (courseData ?? []) as Course[];
  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const students: Student[] = [];

  if (profile.role === "admin" && studentIds.length > 0) {
    const { data: studentData, error: studentsError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", studentIds);

    if (studentsError) {
      console.error("Lab review student lookup failed:", studentsError);
    } else {
      students.push(...((studentData ?? []) as Student[]));
    }
  } else if (profile.role === "instructor" && submissions.length > 0) {
    const { data: studentNamesData, error: studentNamesError } =
      await supabase.rpc("get_lab_submission_student_names", {
        p_submission_ids: submissions.map((submission) => submission.id),
      });

    if (studentNamesError) {
      console.error(
        "Restricted student name lookup failed:",
        studentNamesError,
      );
    } else {
      const studentNames = (studentNamesData ?? []) as StudentNameResult[];
      students.push(
        ...studentNames.map((student) => ({
          id: student.student_id,
          full_name: student.full_name,
          email: null,
        })),
      );
    }
  }

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const pendingCount = submissions.filter(
    (item) => item.status === "submitted",
  ).length;
  const revisionCount = submissions.filter(
    (item) => item.status === "revision_required",
  ).length;
  const approvedCount = submissions.filter(
    (item) => item.status === "approved",
  ).length;

  return (
    <main className="section">
      <div className="container">
        <header
          className="rn-admin-heading"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div>
            <div className="rn-brand-kicker">
              RUFFNECK LEARN · PRACTICAL ASSESSMENT
            </div>
            <h1>Practical Labs Review</h1>
            <p className="muted">
              Review student work against the task requirements, provide feedback,
              and record assessment results.
            </p>
            <p className="muted">
              Reviewer: {profile.full_name || profile.email || user.email} · {profile.role}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link href="/admin/lms" className="btn btn-ghost">
              LMS Dashboard
            </Link>
            <Link href="/admin/projects" className="btn btn-primary">
              Projects &amp; Capstones
            </Link>
          </div>
        </header>

        <section
          className="rn-admin-stats"
          aria-label="Lab submission statistics"
        >
          <Link
            href="/admin/labs?status=all"
            className={`rn-admin-stat ${activeFilter === "all" ? "active" : ""}`}
          >
            <span className="rn-admin-stat-icon">▦</span>
            <span>
              <span className="muted">Loaded submissions</span>
              <strong>{submissions.length}</strong>
            </span>
          </Link>
          <Link
            href="/admin/labs?status=submitted"
            className={`rn-admin-stat ${activeFilter === "submitted" ? "active" : ""}`}
          >
            <span className="rn-admin-stat-icon">◷</span>
            <span>
              <span className="muted">Awaiting review</span>
              <strong>{pendingCount}</strong>
            </span>
          </Link>
          <Link
            href="/admin/labs?status=revision_required"
            className={`rn-admin-stat ${activeFilter === "revision_required" ? "active" : ""}`}
          >
            <span className="rn-admin-stat-icon">↻</span>
            <span>
              <span className="muted">Revision required</span>
              <strong>{revisionCount}</strong>
            </span>
          </Link>
          <Link
            href="/admin/labs?status=approved"
            className={`rn-admin-stat ${activeFilter === "approved" ? "active" : ""}`}
          >
            <span className="rn-admin-stat-icon">✓</span>
            <span>
              <span className="muted">Approved</span>
              <strong>{approvedCount}</strong>
            </span>
          </Link>
        </section>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            margin: "28px 0 20px",
          }}
        >
          {allowedFilters.map((filter) => (
            <Link
              key={filter}
              href={`/admin/labs?status=${filter}`}
              className={activeFilter === filter ? "btn btn-primary" : "btn btn-ghost"}
            >
              {filter === "all" ? "All submissions" : statusLabel(filter)}
            </Link>
          ))}
        </div>

        {submissions.length === 0 ? (
          <section className="rn-admin-list-panel">
            <div className="rn-empty-state">
              <div className="rn-empty-icon">▦</div>
              <strong>No submissions found</strong>
              <p>
                There are no submissions for this filter that you are authorized to review.
              </p>
            </div>
          </section>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 22,
            }}
          >
            {submissions.map((submission) => {
              const lab = labMap.get(submission.lab_id);
              const course = lab ? courseMap.get(lab.course_id) : undefined;
              const student = studentMap.get(submission.student_id);
              const canReview = REVIEWABLE_STATUSES.includes(submission.status);

              return (
                <article
                  key={submission.id}
                  className="rn-admin-list-panel"
                  style={{
                    padding: 24,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 16,
                      marginBottom: 18,
                    }}
                  >
                    <div>
                      <div className="rn-brand-kicker">
                        {course?.title || "Course"}
                      </div>
                      <h2 style={{ margin: "8px 0" }}>
                        {lab?.title || "Practical Lab"}
                      </h2>
                      <p className="muted">
                        {lab?.category || "Practical assessment"}
                        {lab?.difficulty ? ` · ${lab.difficulty}` : ""}
                      </p>
                    </div>
                    <span className="rn-status-pill">
                      {statusLabel(submission.status)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                      marginBottom: 22,
                    }}
                  >
                    <div>
                      <span className="muted">Student</span>
                      <p style={{ margin: "5px 0 0" }}>
                        <strong>
                          {student?.full_name ||
                            (profile.role === "instructor"
                              ? "Enrolled student"
                              : "Student profile unavailable")}
                        </strong>
                      </p>
                      {profile.role === "admin" && student?.email ? (
                        <small>{student.email}</small>
                      ) : null}
                    </div>
                    <div>
                      <span className="muted">Submitted</span>
                      <p style={{ margin: "5px 0 0" }}>
                        {formatDate(submission.submitted_at)}
                      </p>
                    </div>
                    <div>
                      <span className="muted">Current score</span>
                      <p style={{ margin: "5px 0 0" }}>
                        <strong>
                          {submission.score === null
                            ? "Not scored"
                            : `${submission.score}/100`}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <section
                    aria-label="Practical task requirements"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 16,
                      marginBottom: 24,
                    }}
                  >
                    <div
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        border: "1px solid var(--border, #dbe4ef)",
                        background: "var(--surface, #f7f9fc)",
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>Task instructions</h3>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          lineHeight: 1.7,
                        }}
                      >
                        {lab?.instructions || "No task instructions are available."}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        border: "1px solid var(--border, #dbe4ef)",
                        background: "var(--surface, #f7f9fc)",
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>Expected deliverable</h3>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          lineHeight: 1.7,
                        }}
                      >
                        {lab?.deliverable || "No expected deliverable is specified."}
                      </div>
                    </div>
                  </section>

                  <section style={{ marginBottom: 24 }}>
                    <h3>Student response</h3>
                    <div
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        background: "var(--surface, #f5f7fa)",
                        border: "1px solid var(--border, #e1e7ef)",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        lineHeight: 1.75,
                      }}
                    >
                      {submission.answer_text || "No response provided."}
                    </div>
                  </section>

                  {submission.status === "approved" ? (
                    <section>
                      <h3>Recorded review</h3>
                      <p>
                        <strong>Score:</strong> {submission.score ?? "Not recorded"}
                        {submission.score !== null ? "/100" : ""}
                      </p>
                      <p><strong>Feedback:</strong></p>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {submission.feedback || "No feedback recorded."}
                      </div>
                    </section>
                  ) : canReview ? (
                    <section>
                      <h3>Review submission</h3>
                      <LabReviewForm
                        submissionId={submission.id}
                        currentScore={submission.score}
                        currentFeedback={submission.feedback}
                      />
                    </section>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
