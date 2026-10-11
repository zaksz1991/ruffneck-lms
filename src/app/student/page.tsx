import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Enrollment = {
  id: string;
  course_id: string;
  enrollment_status: string;
  payment_status: string | null;
  enrolled_at: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

export default async function StudentDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: enrollmentData } = await supabase
    .from("enrollments")
    .select(
      "id, course_id, enrollment_status, payment_status, enrolled_at"
    )
    .eq("student_id", user.id)
    .order("enrolled_at", { ascending: false });

  const enrollments = (enrollmentData ?? []) as Enrollment[];

  const courseIds = Array.from(
    new Set(enrollments.map((enrollment) => enrollment.course_id))
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data: courseData } = await supabase
      .from("courses")
      .select("id, title, slug")
      .in("id", courseIds);

    courses = (courseData ?? []) as Course[];
  }

  const courseMap = new Map(
    courses.map((course) => [course.id, course])
  );

  const activeEnrollments = enrollments.filter(
    (enrollment) =>
      enrollment.enrollment_status === "active" ||
      enrollment.enrollment_status === "completed"
  );

  const completedCount = enrollments.filter(
    (enrollment) => enrollment.enrollment_status === "completed"
  ).length;

  const pendingCount = enrollments.filter(
    (enrollment) =>
      enrollment.enrollment_status !== "active" &&
      enrollment.enrollment_status !== "completed"
  ).length;

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  const enrolledCourses = activeEnrollments
    .map((enrollment) => ({
      enrollment,
      course: courseMap.get(enrollment.course_id),
    }))
    .filter(
      (
        item
      ): item is {
        enrollment: Enrollment;
        course: Course;
      } => Boolean(item.course)
    );

  return (
    <main className="rn-dashboard">
      <style>{`
        .rn-dashboard {
          --rn-navy: #0b1e3a;
          --rn-cyan: #00b4d8;
          --rn-gold: #fbbf24;
          max-width: 1240px;
          margin: 0 auto;
          padding: 32px 24px 56px;
          color: #172033;
        }

        .rn-dashboard * {
          box-sizing: border-box;
        }

        .rn-dashboard a {
          text-decoration: none;
        }

        .rn-dashboard-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
          padding: 38px;
          border-radius: 24px;
          background: linear-gradient(125deg, #0b1e3a 0%, #12365c 68%, #075b75 100%);
          color: #ffffff;
          margin-bottom: 24px;
        }

        .rn-dashboard-hero::after {
          content: "";
          position: absolute;
          width: 280px;
          height: 280px;
          right: -80px;
          top: -130px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 50%;
          box-shadow: 0 0 0 30px rgba(255,255,255,.035),
                      0 0 0 65px rgba(255,255,255,.025);
          pointer-events: none;
        }

        .rn-dashboard-hero-content {
          position: relative;
          z-index: 1;
          max-width: 650px;
        }

        .rn-dashboard-eyebrow {
          margin: 0 0 12px;
          color: #67e8f9;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .rn-dashboard-hero h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(30px, 4vw, 43px);
          line-height: 1.15;
          letter-spacing: -1.3px;
        }

        .rn-dashboard-hero-description {
          max-width: 520px;
          margin: 14px 0 0;
          color: #d5e5f5;
          font-size: 15px;
          line-height: 1.8;
        }

        .rn-dashboard-hero-actions {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          flex-shrink: 0;
        }

        .rn-dashboard-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          min-height: 43px;
          padding: 11px 17px;
          border: 1px solid #dce4ee;
          border-radius: 10px;
          background: #ffffff;
          color: #0b1e3a;
          font-size: 13px;
          font-weight: 750;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .rn-dashboard-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(11,30,58,.12);
        }

        .rn-dashboard-button-primary {
          border-color: #00b4d8;
          background: #00b4d8;
          color: #06223b;
        }

        .rn-dashboard-button-primary:hover {
          background: #38c9e5;
        }

        .rn-dashboard-button-hero {
          border-color: rgba(255,255,255,.35);
          background: rgba(255,255,255,.1);
          color: #ffffff;
        }

        .rn-dashboard-button-hero:hover {
          background: rgba(255,255,255,.18);
        }

        .rn-dashboard-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 28px;
        }

        .rn-dashboard-stat {
          position: relative;
          overflow: hidden;
          padding: 23px;
          border: 1px solid #e5eaf1;
          border-radius: 17px;
          background: #ffffff;
          box-shadow: 0 4px 18px rgba(11,30,58,.035);
        }

        .rn-dashboard-stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .rn-dashboard-stat-label {
          color: #657187;
          font-size: 13px;
          font-weight: 650;
        }

        .rn-dashboard-stat-icon {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #e7faff;
          color: #087c99;
          font-size: 19px;
          font-weight: 800;
        }

        .rn-dashboard-stat:nth-child(2) .rn-dashboard-stat-icon {
          background: #fff5d8;
          color: #926400;
        }

        .rn-dashboard-stat:nth-child(3) .rn-dashboard-stat-icon {
          background: #e7f8ee;
          color: #16814a;
        }

        .rn-dashboard-stat-value {
          display: block;
          margin-top: 15px;
          color: #0b1e3a;
          font-size: 34px;
          font-weight: 850;
          line-height: 1;
          letter-spacing: -1px;
        }

        .rn-dashboard-stat-note {
          display: block;
          margin-top: 10px;
          color: #778196;
          font-size: 12px;
        }

        .rn-dashboard-section {
          margin-top: 28px;
          padding: 27px;
          border: 1px solid #e5eaf1;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(11,30,58,.035);
        }

        .rn-dashboard-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 22px;
        }

        .rn-dashboard-section-header h2 {
          margin: 0;
          color: #0b1e3a;
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -.4px;
        }

        .rn-dashboard-section-header p {
          margin: 7px 0 0;
          color: #738096;
          font-size: 13px;
          line-height: 1.6;
        }

        .rn-dashboard-course-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
        }

        .rn-dashboard-course {
          display: flex;
          flex-direction: column;
          min-width: 0;
          padding: 22px;
          border: 1px solid #e6ebf2;
          border-radius: 16px;
          background: linear-gradient(145deg, #ffffff, #f9fbfe);
          transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
        }

        .rn-dashboard-course:hover {
          transform: translateY(-2px);
          border-color: #9be7f4;
          box-shadow: 0 9px 24px rgba(11,30,58,.07);
        }

        .rn-dashboard-course-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .rn-dashboard-course-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 47px;
          height: 47px;
          border-radius: 14px;
          background: #e5faff;
          color: #086a88;
          font-size: 21px;
          font-weight: 850;
        }

        .rn-dashboard-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 999px;
          background: #e5f8ec;
          color: #187344;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .rn-dashboard-status-completed {
          background: #e7f0ff;
          color: #244d91;
        }

        .rn-dashboard-course h3 {
          margin: 19px 0 8px;
          color: #10233e;
          font-size: 17px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .rn-dashboard-course-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
          color: #748095;
          font-size: 12px;
        }

        .rn-dashboard-course-meta span {
          padding: 5px 8px;
          border: 1px solid #e7ebf2;
          border-radius: 6px;
          background: #ffffff;
        }

        .rn-dashboard-course-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: auto;
          padding-top: 17px;
          border-top: 1px solid #edf0f5;
        }

        .rn-dashboard-enrolled-date {
          color: #7b8798;
          font-size: 11px;
          line-height: 1.5;
        }

        .rn-dashboard-empty {
          padding: 42px 22px;
          border: 1px dashed #cfd9e6;
          border-radius: 15px;
          background: #fafcff;
          text-align: center;
        }

        .rn-dashboard-empty-icon {
          display: grid;
          place-items: center;
          width: 58px;
          height: 58px;
          margin: 0 auto 15px;
          border-radius: 18px;
          background: #e5faff;
          color: #087c99;
          font-size: 26px;
          font-weight: 800;
        }

        .rn-dashboard-empty h3 {
          margin: 0;
          color: #0b1e3a;
          font-size: 19px;
        }

        .rn-dashboard-empty p {
          margin: 9px auto 20px;
          color: #718096;
          font-size: 13px;
          line-height: 1.7;
        }

        .rn-dashboard-tools {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 15px;
        }

        .rn-dashboard-tool {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          min-width: 0;
          padding: 20px;
          border: 1px solid #e6ebf2;
          border-radius: 15px;
          background: #ffffff;
          transition: border-color .18s ease, background .18s ease;
        }

        .rn-dashboard-tool:hover {
          border-color: #8ee2f1;
          background: #f7fdff;
        }

        .rn-dashboard-tool-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 43px;
          height: 43px;
          border-radius: 12px;
          background: #e8faff;
          color: #087c99;
          font-size: 19px;
          font-weight: 850;
        }

        .rn-dashboard-tool h3 {
          margin: 1px 0 7px;
          color: #10233e;
          font-size: 14px;
          font-weight: 800;
        }

        .rn-dashboard-tool p {
          margin: 0;
          color: #758196;
          font-size: 12px;
          line-height: 1.7;
        }

        .rn-dashboard-tool-arrow {
          display: block;
          margin-top: 12px;
          color: #0783a0;
          font-size: 12px;
          font-weight: 800;
        }

        .rn-dashboard-notice {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          margin-top: 24px;
          padding: 17px 19px;
          border: 1px solid #f2dfa1;
          border-radius: 13px;
          background: #fffaf0;
        }

        .rn-dashboard-notice-icon {
          color: #986900;
          font-size: 19px;
          font-weight: 900;
        }

        .rn-dashboard-notice p {
          margin: 0;
          color: #755b19;
          font-size: 12px;
          line-height: 1.8;
        }

        @media (max-width: 850px) {
          .rn-dashboard-hero {
            align-items: flex-start;
            flex-direction: column;
            padding: 29px;
          }

          .rn-dashboard-hero-actions {
            width: 100%;
          }

          .rn-dashboard-tools {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .rn-dashboard {
            padding: 20px 14px 38px;
          }

          .rn-dashboard-hero {
            padding: 25px 21px;
            border-radius: 18px;
          }

          .rn-dashboard-hero h1 {
            font-size: 31px;
          }

          .rn-dashboard-hero-description {
            font-size: 13px;
          }

          .rn-dashboard-hero-actions {
            flex-direction: column;
          }

          .rn-dashboard-hero-actions .rn-dashboard-button {
            width: 100%;
          }

          .rn-dashboard-stats {
            gap: 9px;
          }

          .rn-dashboard-stat {
            padding: 14px 11px;
            border-radius: 13px;
          }

          .rn-dashboard-stat-label {
            font-size: 11px;
            line-height: 1.5;
          }

          .rn-dashboard-stat-icon {
            width: 30px;
            height: 30px;
            border-radius: 9px;
            font-size: 14px;
          }

          .rn-dashboard-stat-value {
            margin-top: 12px;
            font-size: 28px;
          }

          .rn-dashboard-stat-note {
            font-size: 10px;
            line-height: 1.5;
          }

          .rn-dashboard-section {
            padding: 19px 14px;
            border-radius: 16px;
          }

          .rn-dashboard-section-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .rn-dashboard-course-grid,
          .rn-dashboard-tools {
            grid-template-columns: 1fr;
          }

          .rn-dashboard-course {
            padding: 18px;
          }

          .rn-dashboard-course-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .rn-dashboard-course-footer .rn-dashboard-button {
            width: 100%;
          }
        }
      `}</style>

      <section className="rn-dashboard-hero">
        <div className="rn-dashboard-hero-content">
          <p className="rn-dashboard-eyebrow">
            RUFFNECK ENTERTAINMENT · LEARNING
          </p>

          <h1>
            {firstName
              ? `Welcome back, ${firstName}.`
              : "Your learning starts here."}
          </h1>

          <p className="rn-dashboard-hero-description">
            Build practical skills, continue your courses, and keep
            moving towards your learning goals.
          </p>
        </div>

        <div className="rn-dashboard-hero-actions">
          <Link
            href="/student/courses"
            className="rn-dashboard-button rn-dashboard-button-primary"
          >
            My Courses <span aria-hidden="true">→</span>
          </Link>

          <Link
            href="/courses"
            className="rn-dashboard-button rn-dashboard-button-hero"
          >
            Explore Courses
          </Link>
        </div>
      </section>

      <section
        className="rn-dashboard-stats"
        aria-label="Learning overview"
      >
        <div className="rn-dashboard-stat">
          <div className="rn-dashboard-stat-top">
            <span className="rn-dashboard-stat-label">
              Total Enrollments
            </span>
            <span className="rn-dashboard-stat-icon" aria-hidden="true">
              C
            </span>
          </div>

          <strong className="rn-dashboard-stat-value">
            {enrollments.length}
          </strong>

          <span className="rn-dashboard-stat-note">
            Courses linked to your account
          </span>
        </div>

        <div className="rn-dashboard-stat">
          <div className="rn-dashboard-stat-top">
            <span className="rn-dashboard-stat-label">
              Active Learning
            </span>
            <span className="rn-dashboard-stat-icon" aria-hidden="true">
              ↗
            </span>
          </div>

          <strong className="rn-dashboard-stat-value">
            {activeEnrollments.length - completedCount < 0
              ? 0
              : activeEnrollments.length -
                activeEnrollments.filter(
                  (enrollment) =>
                    enrollment.enrollment_status === "completed"
                ).length}
          </strong>

          <span className="rn-dashboard-stat-note">
            Courses still in progress
          </span>
        </div>

        <div className="rn-dashboard-stat">
          <div className="rn-dashboard-stat-top">
            <span className="rn-dashboard-stat-label">
              Completed Courses
            </span>
            <span className="rn-dashboard-stat-icon" aria-hidden="true">
              ✓
            </span>
          </div>

          <strong className="rn-dashboard-stat-value">
            {completedCount}
          </strong>

          <span className="rn-dashboard-stat-note">
            Courses marked completed
          </span>
        </div>
      </section>

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <h2>Continue Learning</h2>
            <p>
              Your enrolled courses, organised for quick access.
            </p>
          </div>

          <Link
            href="/student/courses"
            className="rn-dashboard-button"
          >
            View All Courses <span aria-hidden="true">→</span>
          </Link>
        </div>

        {enrolledCourses.length === 0 ? (
          <div className="rn-dashboard-empty">
            <div className="rn-dashboard-empty-icon" aria-hidden="true">
              +
            </div>

            <h3>Your learning journey starts here</h3>

            <p>
              You do not have any active course enrollments yet.
              Explore the course catalogue to find a course that fits
              your goals.
            </p>

            <Link
              href="/courses"
              className="rn-dashboard-button rn-dashboard-button-primary"
            >
              Browse Available Courses
            </Link>
          </div>
        ) : (
          <div className="rn-dashboard-course-grid">
            {enrolledCourses.slice(0, 6).map(({ enrollment, course }) => {
              const completed =
                enrollment.enrollment_status === "completed";

              return (
                <article
                  className="rn-dashboard-course"
                  key={enrollment.id}
                >
                  <div className="rn-dashboard-course-top">
                    <div
                      className="rn-dashboard-course-icon"
                      aria-hidden="true"
                    >
                      {completed ? "✓" : "L"}
                    </div>

                    <span
                      className={
                        completed
                          ? "rn-dashboard-status rn-dashboard-status-completed"
                          : "rn-dashboard-status"
                      }
                    >
                      <span aria-hidden="true">
                        {completed ? "✓" : "●"}
                      </span>
                      {completed ? "Completed" : "Enrolled"}
                    </span>
                  </div>

                  <h3>{course.title}</h3>

                  <div className="rn-dashboard-course-meta">
                    <span>RuffNeck Learn</span>
                    <span>
                      {completed ? "Course finished" : "Ready to continue"}
                    </span>
                  </div>

                  <div className="rn-dashboard-course-footer">
                    <span className="rn-dashboard-enrolled-date">
                      Enrolled{" "}
                      {new Date(
                        enrollment.enrolled_at
                      ).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>

                    <Link
                      href={`/courses/${course.slug}`}
                      className="rn-dashboard-button rn-dashboard-button-primary"
                    >
                      {completed ? "Review Course" : "Open Course"}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <h2>Your Learning Tools</h2>
            <p>
              Access useful tools and account records from one place.
            </p>
          </div>
        </div>

        <div className="rn-dashboard-tools">
          <Link
            href="/student/scan"
            className="rn-dashboard-tool"
          >
            <span className="rn-dashboard-tool-icon" aria-hidden="true">
              AI
            </span>

            <span>
              <h3>Scan &amp; Learn</h3>
              <p>
                Turn learning materials into useful AI-assisted study
                drafts.
              </p>
              <span className="rn-dashboard-tool-arrow">
                Open tool →
              </span>
            </span>
          </Link>

          <Link
            href="/student/ai-drafts"
            className="rn-dashboard-tool"
          >
            <span className="rn-dashboard-tool-icon" aria-hidden="true">
              D
            </span>

            <span>
              <h3>My AI Drafts</h3>
              <p>
                Return to your saved learning drafts and study materials.
              </p>
              <span className="rn-dashboard-tool-arrow">
                View drafts →
              </span>
            </span>
          </Link>

          <Link
            href="/student/payments"
            className="rn-dashboard-tool"
          >
            <span className="rn-dashboard-tool-icon" aria-hidden="true">
              ₦
            </span>

            <span>
              <h3>Payment History</h3>
              <p>
                Review your course payment records and transaction history.
              </p>
              <span className="rn-dashboard-tool-arrow">
                View payments →
              </span>
            </span>
          </Link>
        </div>
      </section>

      {pendingCount > 0 && (
        <aside className="rn-dashboard-notice">
          <span className="rn-dashboard-notice-icon" aria-hidden="true">
            !
          </span>

          <p>
            <strong>Enrollment status:</strong> {pendingCount}{" "}
            {pendingCount === 1 ? "enrollment needs" : "enrollments need"}{" "}
            attention. Visit My Courses or Payment History to review
            the relevant records.
          </p>
        </aside>
      )}
    </main>
  );
}