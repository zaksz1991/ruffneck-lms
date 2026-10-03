import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LearningIntelligence from "@/components/LearningIntelligence";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  category: string | null;
  level: "beginner" | "intermediate" | "advanced";
  thumbnail_url: string | null;
  duration_minutes: number | null;
  is_free: boolean;
  price_ngn: number;
  status: "draft" | "published" | "archived";
};

type Enrollment = {
  id: string;
  student_id: string;
  course_id: string;
  payment_status: string;
  enrollment_status: string;
  progress_percent: number;
  enrolled_at: string;
  completed_at: string | null;
  last_accessed_at: string | null;
};

type SkillProfile = {
  id: string;
  student_id: string;
  skill_id: string;
  confidence_score: number;
  skill_level: string;
  evidence: string | null;
  strengths: string | null;
  gaps: string | null;
  updated_at: string;
};

function formatLevel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function formatDate(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getProgressLabel(progress: number) {
  if (progress >= 100) return "Completed";
  if (progress > 0) return "In progress";
  return "Not started";
}

export default async function StudentDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/dashboard");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as Profile | null;

  const { data: enrollmentData } = await supabase
    .from("enrollments")
    .select(
      `
        id,
        student_id,
        course_id,
        payment_status,
        enrollment_status,
        progress_percent,
        enrolled_at,
        completed_at,
        last_accessed_at
      `
    )
    .eq("student_id", user.id)
    .order("last_accessed_at", {
      ascending: false,
      nullsFirst: false,
    });

  const enrollments =
    (enrollmentData || []) as Enrollment[];

  const enrolledCourseIds = [
    ...new Set(
      enrollments.map(
        (item) => item.course_id
      )
    ),
  ];

  let enrolledCourses: Course[] = [];

  if (enrolledCourseIds.length > 0) {
    const { data: courseData } =
      await supabase
        .from("courses")
        .select(
          `
            id,
            title,
            slug,
            short_description,
            category,
            level,
            thumbnail_url,
            duration_minutes,
            is_free,
            price_ngn,
            status
          `
        )
        .in("id", enrolledCourseIds);

    enrolledCourses =
      (courseData || []) as Course[];
  }

  const courseMap = new Map<string, Course>();

  enrolledCourses.forEach((course) => {
    courseMap.set(course.id, course);
  });

  const { data: skillProfileData } =
    await supabase
      .from("learner_skill_profiles")
      .select(
        `
          id,
          student_id,
          skill_id,
          confidence_score,
          skill_level,
          evidence,
          strengths,
          gaps,
          updated_at
        `
      )
      .eq("student_id", user.id)
      .order("confidence_score", {
        ascending: false,
      });

  const skillProfiles =
    (skillProfileData || []) as SkillProfile[];

  const totalCourses =
    enrollments.length;

  const completedCourses =
    enrollments.filter(
      (enrollment) =>
        enrollment.progress_percent >= 100 ||
        enrollment.enrollment_status ===
          "completed"
    ).length;

  const strengthCount =
    skillProfiles.filter(
      (skill) =>
        Number(skill.confidence_score) >=
        80
    ).length;

  const developmentCount =
    skillProfiles.filter(
      (skill) =>
        Number(skill.confidence_score) <
        50
    ).length;

  const displayName =
    profile?.full_name ||
    user.email?.split("@")[0] ||
    "Learner";

  const averageSkillScore =
    skillProfiles.length > 0
      ? Math.round(
          skillProfiles.reduce(
            (total, skill) =>
              total +
              Number(
                skill.confidence_score || 0
              ),
            0
          ) /
            skillProfiles.length
        )
      : 0;

  const hasLearningProfile =
    skillProfiles.length > 0;

  return (
    <main className="container rn-dashboard-shell">
      <section className="rn-dashboard-header">
        <div>
          <div className="rn-eyebrow">
            RUFFNECK LEARN
          </div>

          <h1>Learning Dashboard</h1>

          <p className="rn-dashboard-intro">
            Welcome
            {profile?.full_name
              ? `, ${profile.full_name}`
              : ""}
            . Your learning dashboard tracks
            progress, skills and development.
          </p>
        </div>

        <div className="rn-dashboard-header-actions">
          <Link
            href="/courses"
            className="rn-button rn-button-primary"
          >
            Browse Courses
          </Link>

          <Link
            href="/student/projects"
            className="rn-button rn-button-secondary"
          >
            Projects & Capstones
          </Link>

          <Link
            href="/student/assessment"
            className="rn-button rn-button-secondary"
          >
            Skill Assessment
          </Link>
        </div>
      </section>

      <section className="rn-dashboard-stats">
        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Courses
          </span>

          <strong>{totalCourses}</strong>

          <small>
            Enrolled courses
          </small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Completed
          </span>

          <strong>
            {completedCourses}
          </strong>

          <small>
            Courses completed
          </small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Strengths
          </span>

          <strong>
            {strengthCount}
          </strong>

          <small>
            Skills at 80%+
          </small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Development
          </span>

          <strong>
            {developmentCount}
          </strong>

          <small>
            Skills below 50%
          </small>
        </article>
      </section>

      <section className="rn-dashboard-grid">
        <article className="rn-dashboard-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">
                LEARNER PROFILE
              </span>

              <h2>{displayName}</h2>
            </div>

            <Link
              href="/student/skills"
              className="rn-text-link"
            >
              View skills
            </Link>
          </div>

          <div className="rn-profile-summary">
            <div className="rn-profile-score">
              <strong>
                {averageSkillScore}%
              </strong>

              <span>
                Average skill confidence
              </span>
            </div>

            <div className="rn-profile-details">
              <p>
                <strong>Email:</strong>{" "}
                {profile?.email ||
                  user.email}
              </p>

              <p>
                <strong>Role:</strong>{" "}
                {profile?.role ||
                  "student"}
              </p>

              <p>
                <strong>
                  Skills tracked:
                </strong>{" "}
                {skillProfiles.length}
              </p>
            </div>
          </div>
        </article>

        <article className="rn-dashboard-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">
                {hasLearningProfile
                  ? "CONTINUE ADVANCING"
                  : "NEXT STEP"}
              </span>

              <h2>
                {hasLearningProfile
                  ? "Continue advancing your skills"
                  : "Build your learning profile"}
              </h2>
            </div>
          </div>

          <p className="rn-dashboard-card-text">
            {hasLearningProfile
              ? "Your current learning profile shows strong foundational skills across the areas assessed. Continue with advanced courses to deepen your capabilities and expand your practical digital skills."
              : "Complete the diagnostic assessment to identify your current strengths and development areas. Your results can be used to personalize your learning path."}
          </p>

          <div className="rn-dashboard-inline-actions">
            {hasLearningProfile ? (
              <>
                <Link
                  href="/student/skills"
                  className="rn-button rn-button-primary"
                >
                  View Skills
                </Link>

                <Link
                  href="/courses"
                  className="rn-button rn-button-secondary"
                >
                  Explore Advanced Courses
                </Link>
              </>
            ) : (
              <Link
                href="/student/assessment"
                className="rn-button rn-button-primary"
              >
                Take Diagnostic Assessment
              </Link>
            )}
          </div>
        </article>
      </section>

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">
              MY LEARNING
            </span>

            <h2>My Courses</h2>

            <p>
              Continue your courses and
              track your progress.
            </p>
          </div>

          <Link
            href="/courses"
            className="rn-text-link"
          >
            Browse all courses
          </Link>
        </div>

        {enrollments.length === 0 ? (
          <article className="rn-empty-state">
            <h3>No courses yet</h3>

            <p>
              You have not enrolled in a
              course yet. Explore the
              RuffNeck Learn catalog to get
              started.
            </p>

            <Link
              href="/courses"
              className="rn-button rn-button-primary"
            >
              Explore Courses
            </Link>
          </article>
        ) : (
          <div className="rn-course-grid">
            {enrollments.map(
              (enrollment) => {
                const course =
                  courseMap.get(
                    enrollment.course_id
                  );

                if (!course) {
                  return null;
                }

                const progress =
                  Math.min(
                    100,
                    Math.max(
                      0,
                      Number(
                        enrollment.progress_percent ||
                          0
                      )
                    )
                  );

                return (
                  <article
                    key={enrollment.id}
                    className="rn-course-card"
                  >
                    {course.thumbnail_url ? (
                      <div className="rn-course-card-image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            course.thumbnail_url
                          }
                          alt={course.title}
                        />
                      </div>
                    ) : (
                      <div className="rn-course-card-placeholder">
                        RN
                      </div>
                    )}

                    <div className="rn-course-card-body">
                      <div className="rn-course-card-meta">
                        <span>
                          {formatLevel(
                            course.level
                          )}
                        </span>

                        {course.category ? (
                          <span>
                            {course.category}
                          </span>
                        ) : null}
                      </div>

                      <h3>
                        {course.title}
                      </h3>

                      <p>
                        {course.short_description ||
                          "Continue learning and build practical skills."}
                      </p>

                      <div className="rn-progress-block">
                        <div className="rn-progress-header">
                          <span>
                            {getProgressLabel(
                              progress
                            )}
                          </span>

                          <strong>
                            {progress}%
                          </strong>
                        </div>

                        <div className="rn-progress-track">
                          <div
                            className="rn-progress-fill"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="rn-course-card-footer">
                        <span>
                          {course.duration_minutes
                            ? `${course.duration_minutes} min`
                            : "Self-paced"}
                        </span>

                        <Link
                          href={`/courses/${course.slug}`}
                          className="rn-button rn-button-primary"
                        >
                          {progress >=
                          100
                            ? "Review Course"
                            : progress > 0
                              ? "Continue"
                              : "Start Course"}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>

      <LearningIntelligence />

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">
              QUICK ACTIONS
            </span>

            <h2>Continue Learning</h2>
          </div>
        </div>

        <div className="rn-dashboard-actions-grid">
          <Link
            href="/courses"
            className="rn-dashboard-action"
          >
            <strong>
              Browse Courses
            </strong>

            <span>
              Explore AI, data, digital
              marketing, teaching and
              productivity courses.
            </span>
          </Link>

          <Link
            href="/student/assessment"
            className="rn-dashboard-action"
          >
            <strong>
              Course Assessments
            </strong>

            <span>
              Test your knowledge and
              update your course-specific
              skills profile.
            </span>
          </Link>

          <Link
            href="/student/projects"
            className="rn-dashboard-action"
          >
            <strong>
              Projects & Capstones
            </strong>

            <span>
              Complete practical projects,
              submit your work and track
              project reviews.
            </span>
          </Link>

          <Link
            href="/student/skills"
            className="rn-dashboard-action"
          >
            <strong>
              View Skills
            </strong>

            <span>
              Review your learning profile
              and skill confidence levels.
            </span>
          </Link>
        </div>
      </section>

      <section className="rn-dashboard-footer-note">
        <p>
          RuffNeck Learn helps you build
          practical digital skills through
          structured courses, assessments,
          practical projects and personalized
          learning recommendations.
        </p>

        <p>
          Last profile update:{" "}
          {formatDate(
            skillProfiles[0]?.updated_at ||
              null
          )}
        </p>
      </section>
    </main>
  );
}