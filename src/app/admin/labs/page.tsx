import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LabReviewForm from "./LabReviewForm";

type Profile = {
  role: "admin" | "instructor" | "student";
  full_name: string | null;
};

type Submission = {
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
  title: string;
  course_id: string;
};

type Course = {
  id: string;
  title: string;
};

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default async function AdminLabsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/labs");
  }

  const { data: profileData, error: profileError } =
    await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    console.error("Lab review profile lookup failed:", profileError);
    throw new Error("Unable to verify reviewer permissions.");
  }

  const profile = profileData as Profile | null;

  if (!profile || !["admin", "instructor"].includes(profile.role)) {
    redirect("/student/dashboard");
  }

  const { data: submissionData, error: submissionError } =
    await supabase
      .from("lab_submissions")
      .select(
        "id, lab_id, student_id, answer_text, status, score, feedback, submitted_at, created_at",
      )
      .in("status", ["submitted", "revision_required", "approved"])
      .order("submitted_at", { ascending: false, nullsFirst: false });

  if (submissionError) {
    console.error("Lab review submissions lookup failed:", submissionError);
    throw new Error("Unable to load lab submissions.");
  }

  const submissions = (submissionData ?? []) as Submission[];

  const labIds = [...new Set(submissions.map((item) => item.lab_id))];
  const studentIds = [
    ...new Set(submissions.map((item) => item.student_id)),
  ];

  const { data: labData, error: labError } =
    labIds.length > 0
      ? await supabase
          .from("practical_labs")
          .select("id, title, course_id")
          .in("id", labIds)
      : { data: [], error: null };

  if (labError) {
    console.error("Lab review lab lookup failed:", labError);
    throw new Error("Unable to load practical lab details.");
  }

  const labs = (labData ?? []) as Lab[];
  const courseIds = [...new Set(labs.map((lab) => lab.course_id))];

  const { data: courseData, error: courseError } =
    courseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title")
          .in("id", courseIds)
      : { data: [], error: null };

  if (courseError) {
    console.error("Lab review course lookup failed:", courseError);
    throw new Error("Unable to load course details.");
  }

  const { data: studentData, error: studentError } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentIds)
      : { data: [], error: null };

  if (studentError) {
    console.error("Lab review student lookup failed:", studentError);
    throw new Error("Unable to load learner details.");
  }

  const labMap = new Map(
    ((labs ?? []) as Lab[]).map((lab) => [lab.id, lab]),
  );

  const courseMap = new Map(
    ((courseData ?? []) as Course[]).map((course) => [
      course.id,
      course,
    ]),
  );

  const studentMap = new Map(
    ((studentData ?? []) as Student[]).map((student) => [
      student.id,
      student,
    ]),
  );

  const pendingCount = submissions.filter(
    (item) =>
      item.status === "submitted" ||
      item.status === "revision_required",
  ).length;

  return (
    <section className="section">
      <div className="container">
        <div className="rn-admin-heading">
          <div>
            <div className="rn-brand-kicker">RuffNeck Learn</div>
            <h2>Practical Labs Review</h2>
            <p className="muted">
              Review learner submissions, provide feedback, and approve
              completed practical work.
            </p>
            <p className="muted">
              Signed in as {profile.full_name || user.email} (
              {profile.role}).
            </p>
          </div>

          <div className="rn-admin-heading-actions">
            <Link href="/admin/lms" className="btn btn-ghost">
              Back to LMS Admin
            </Link>
          </div>
        </div>

        <div className="rn-admin-stats">
          <div className="rn-admin-stat">
            <span className="rn-admin-stat-icon">▤</span>
            <span>
              <span className="muted">Visible submissions</span>
              <strong>{submissions.length}</strong>
            </span>
          </div>

          <div className="rn-admin-stat">
            <span className="rn-admin-stat-icon">◷</span>
            <span>
              <span className="muted">Awaiting review</span>
              <strong>{pendingCount}</strong>
            </span>
          </div>

          <div className="rn-admin-stat">
            <span className="rn-admin-stat-icon">✓</span>
            <span>
              <span className="muted">Approved</span>
              <strong>
                {
                  submissions.filter(
                    (item) => item.status === "approved",
                  ).length
                }
              </strong>
            </span>
          </div>
        </div>

        <section className="rn-admin-list-panel">
          <div className="rn-admin-list-header">
            <div>
              <div className="rn-brand-kicker">Learner submissions</div>
              <h3>Review queue</h3>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="rn-empty-state">
              <div className="rn-empty-icon">▤</div>
              <strong>No visible submissions</strong>
              <p>
                Submissions will appear here when learners submit practical
                work for courses you manage.
              </p>
            </div>
          ) : (
            <div className="rn-lab-review-list">
              {submissions.map((submission) => {
                const lab = labMap.get(submission.lab_id);
                const course = lab
                  ? courseMap.get(lab.course_id)
                  : undefined;
                const student = studentMap.get(submission.student_id);
                const canReview =
                  submission.status === "submitted" ||
                  submission.status === "revision_required";

                return (
                  <article
                    key={submission.id}
                    className="rn-admin-list-panel"
                    style={{ marginBottom: 20 }}
                  >
                    <div className="rn-admin-list-header">
                      <div>
                        <div className="rn-brand-kicker">
                          {course?.title || "Course"}
                        </div>
                        <h3>{lab?.title || "Practical Lab"}</h3>
                        <p className="muted">
                          Learner: {student?.full_name || "Unnamed learner"}
                          {student?.email ? ` · ${student.email}` : ""}
                        </p>
                      </div>

                      <span className="rn-status-pill">
                        {submission.status.replaceAll("_", " ")}
                      </span>
                    </div>

                    <div style={{ margin: "16px 0" }}>
                      <strong>Learner response</strong>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          marginTop: 8,
                          padding: 16,
                          borderRadius: 12,
                          background: "var(--surface, #f5f7fa)",
                          lineHeight: 1.65,
                        }}
                      >
                        {submission.answer_text}
                      </div>
                    </div>

                    {submission.submitted_at ? (
                      <p className="muted">
                        Submitted:{" "}
                        {new Date(submission.submitted_at).toLocaleString(
                          "en-NG",
                        )}
                      </p>
                    ) : null}

                    {submission.status === "approved" ? (
                      <div>
                        <p>
                          <strong>Score:</strong>{" "}
                          {submission.score ?? "Not recorded"}
                        </p>
                        <p>
                          <strong>Feedback:</strong>{" "}
                          {submission.feedback || "No feedback recorded."}
                        </p>
                      </div>
                    ) : canReview ? (
                      <LabReviewForm
                        submissionId={submission.id}
                        initialScore={submission.score}
                        initialFeedback={submission.feedback}
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}