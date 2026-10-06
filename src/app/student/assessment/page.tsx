import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssessmentClient from "./AssessmentClient";

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  category: string | null;
  level: "beginner" | "intermediate" | "advanced";
};

type Enrollment = {
  course_id: string;
  progress_percent: number;
  enrollment_status:
    | "active"
    | "completed"
    | "cancelled";
};

type AssessmentQuestionRow = {
  id: string;
  course_id: string;
  skill_id: string;
  question: string | null;
  question_text: string | null;
  question_type: string | null;
  options: unknown;
  correct_answer: string;
  explanation: string | null;
  difficulty: string | null;
  sort_order: number;
};

type AssessmentQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string | null;
  difficulty: string;
};

function normalizeOptions(
  value: unknown
): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch {
      // Fall through to delimiter handling.
    }

    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.values(
      value as Record<string, unknown>
    ).map(String);
  }

  return [];
}

function formatLevel(level: string) {
  return (
    level.charAt(0).toUpperCase() +
    level.slice(1)
  );
}

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    course?: string;
  }>;
}) {
  const { course: courseSlug } =
    await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/assessment"
    );
  }

  const { data: enrollmentData } =
    await supabase
      .from("enrollments")
      .select(
        "course_id, progress_percent, enrollment_status"
      )
      .eq("student_id", user.id)
      .in("enrollment_status", [
        "active",
        "completed",
      ]);

  const enrollments =
    (enrollmentData as unknown as Enrollment[]) ||
    [];

  const enrolledCourseIds = enrollments.map(
    (item) => item.course_id
  );

  if (enrolledCourseIds.length === 0) {
    return (
      <main className="rn-assessment-hub">
        <div className="container">
          <section className="rn-assessment-info">
            <span className="rn-eyebrow">
              ASSESSMENTS
            </span>

            <h1>Course assessments</h1>

            <p>
              Enroll in a course to access its
              assessment and build your learning
              profile.
            </p>

            <Link
              href="/courses"
              className="rn-button rn-button-primary"
            >
              Explore Courses
            </Link>
          </section>
        </div>
      </main>
    );
  }

  /*
   * No course selected:
   * show the assessment catalogue.
   */
  if (!courseSlug) {
    const { data: courseData } =
      await supabase
        .from("courses")
        .select(
          [
            "id",
            "title",
            "slug",
            "short_description",
            "category",
            "level",
          ].join(", ")
        )
        .in("id", enrolledCourseIds)
        .eq("status", "published")
        .order("title");

    const courses =
      (courseData as unknown as Course[]) || [];

    return (
      <main className="rn-assessment-hub">
        <div className="container">
          <section className="rn-assessment-hub-header">
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 260,
                }}
              >
                <span className="rn-eyebrow">
                  LEARNING ASSESSMENTS
                </span>

                <h1>
                  Choose your course assessment
                </h1>

                <p>
                  Assess your knowledge, identify
                  skill strengths and find areas to
                  develop. Each assessment is aligned
                  with the course curriculum.
                </p>
              </div>

              <Link
                href="/student/assessment/results"
                className="rn-button rn-button-secondary"
              >
                Assessment Results
              </Link>
            </div>
          </section>

          <section className="rn-assessment-course-grid">
            {courses.map((course) => {
              const enrollment =
                enrollments.find(
                  (item) =>
                    item.course_id === course.id
                );

              const progress =
                enrollment?.progress_percent || 0;

              const assessmentUnlocked =
                progress >= 100;

              return (
                <article
                  key={course.id}
                  className="rn-assessment-course-card"
                >
                  <div className="rn-assessment-course-top">
                    <span className="rn-eyebrow">
                      {course.category ||
                        "PROFESSIONAL LEARNING"}
                    </span>

                    <span className="rn-assessment-level">
                      {formatLevel(
                        course.level
                      )}
                    </span>
                  </div>

                  <h2>{course.title}</h2>

                  <p>
                    {course.short_description ||
                      "Assess the knowledge and practical skills covered in this course."}
                  </p>

                  <div className="rn-assessment-course-meta">
                    <span>
                      Progress: {progress}%
                    </span>
                  </div>

                  {assessmentUnlocked ? (
                    <Link
                      href={`/student/assessment?course=${course.slug}`}
                      className="rn-button rn-button-primary"
                    >
                      Start Assessment
                    </Link>
                  ) : (
                    <div>
                      <button
                        type="button"
                        className="rn-button rn-button-secondary"
                        disabled
                        aria-disabled="true"
                      >
                        Assessment Locked
                      </button>

                      <p
                        style={{
                          marginTop: 10,
                          fontSize: 14,
                        }}
                      >
                        Complete all course lessons
                        to unlock the assessment.
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <div className="rn-assessment-hub-actions">
            <Link
              href="/student/dashboard"
              className="rn-button rn-button-secondary"
            >
              Back to Dashboard
            </Link>

            <Link
              href="/student/skills"
              className="rn-button rn-button-secondary"
            >
              View Skills
            </Link>

            <Link
              href="/student/assessment/results"
              className="rn-button rn-button-secondary"
            >
              Assessment Results
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /*
   * Selected course assessment.
   */
  const { data: selectedCourseData } =
    await supabase
      .from("courses")
      .select(
        [
          "id",
          "title",
          "slug",
          "short_description",
          "category",
          "level",
        ].join(", ")
      )
      .eq("slug", courseSlug)
      .eq("status", "published")
      .maybeSingle();

  const selectedCourse =
    selectedCourseData as unknown as Course | null;

  if (!selectedCourse) {
    redirect("/student/assessment");
  }

  const enrollment = enrollments.find(
    (item) =>
      item.course_id === selectedCourse.id
  );

  if (!enrollment) {
    redirect(
      `/courses/${selectedCourse.slug}`
    );
  }

  const progress =
    enrollment.progress_percent || 0;

  /*
   * Assessment is available only after the
   * learner has completed the entire course.
   */
  if (progress < 100) {
    return (
      <main className="rn-assessment-shell">
        <div className="container">
          <section className="rn-empty-state">
            <span className="rn-eyebrow">
              ASSESSMENT LOCKED
            </span>

            <h1>
              Complete the course first
            </h1>

            <p>
              The final assessment for{" "}
              <strong>
                {selectedCourse.title}
              </strong>{" "}
              becomes available after all
              published lessons are completed.
            </p>

            <div
              style={{
                marginTop: 20,
                padding: 18,
                border:
                  "1px solid rgba(11, 30, 58, 0.12)",
                borderRadius: 12,
                background:
                  "rgba(11, 30, 58, 0.03)",
              }}
            >
              <strong>
                Course progress: {progress}%
              </strong>

              <div
                style={{
                  marginTop: 10,
                  height: 8,
                  borderRadius: 999,
                  background:
                    "rgba(11, 30, 58, 0.10)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, progress)
                    )}%`,
                    height: "100%",
                    background:
                      "var(--cyan, #00b4d8)",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 20,
              }}
            >
              <Link
                href={`/courses/${selectedCourse.slug}`}
                className="rn-button rn-button-primary"
              >
                Continue Course
              </Link>

              <Link
                href="/student/assessment"
                className="rn-button rn-button-secondary"
              >
                All Assessments
              </Link>

              <Link
                href="/student/dashboard"
                className="rn-button rn-button-secondary"
              >
                Dashboard
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const { data: questionData } =
    await supabase
      .from("assessment_questions")
      .select(
        [
          "id",
          "course_id",
          "skill_id",
          "question",
          "question_text",
          "question_type",
          "options",
          "correct_answer",
          "explanation",
          "difficulty",
          "sort_order",
        ].join(", ")
      )
      .eq("course_id", selectedCourse.id)
      .order("sort_order");

  const rows =
    (questionData as unknown as AssessmentQuestionRow[]) ||
    [];

  const questions: AssessmentQuestion[] =
    rows.map((row) => ({
      id: row.id,
      question:
        row.question_text ||
        row.question ||
        "Assessment question",
      options: normalizeOptions(
        row.options
      ),
      explanation: row.explanation,
      difficulty:
        row.difficulty || "intermediate",
    }));

  if (questions.length === 0) {
    return (
      <main className="rn-assessment-shell">
        <div className="container">
          <section className="rn-empty-state">
            <span className="rn-eyebrow">
              {selectedCourse.title}
            </span>

            <h1>
              Assessment is being prepared
            </h1>

            <p>
              The course curriculum is available,
              but its assessment bank has not yet
              been populated.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 18,
              }}
            >
              <Link
                href={`/courses/${selectedCourse.slug}`}
                className="rn-button rn-button-primary"
              >
                View Course
              </Link>

              <Link
                href="/student/assessment/results"
                className="rn-button rn-button-secondary"
              >
                Assessment Results
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="rn-assessment-shell">
      <div className="container">
        <div className="rn-assessment-course-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <Link
              href="/student/assessment"
              className="rn-learning-back"
            >
              ← All assessments
            </Link>

            <Link
              href="/student/assessment/results"
              className="rn-button rn-button-secondary"
            >
              Assessment Results
            </Link>
          </div>

          <div className="rn-assessment-course-heading">
            <span className="rn-eyebrow">
              {selectedCourse.category ||
                "COURSE ASSESSMENT"}
            </span>

            <h1>{selectedCourse.title}</h1>

            <p>
              Test your understanding of the
              course material and generate an
              updated skills profile.
            </p>

            <div className="rn-assessment-course-summary">
              <span>
                {questions.length} Questions
              </span>

              <span>
                {formatLevel(
                  selectedCourse.level
                )}
              </span>

              <span>
                Progress: {progress}%
              </span>
            </div>
          </div>
        </div>

        <AssessmentClient
          courseId={selectedCourse.id}
          courseTitle={selectedCourse.title}
          questions={questions}
        />
      </div>
    </main>
  );
}