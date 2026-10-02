import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LearningRecommendations from "@/components/LearningRecommendations";

type SkillProfile = {
  id: string;
  current_level: number;
  confidence_score: number;
  evidence_count: number;
  strengths: string | null;
  gaps: string | null;
  learning_skills:
    | {
        name: string;
        category: string;
        slug: string;
      }
    | {
        name: string;
        category: string;
        slug: string;
      }[]
    | null;
};

export default async function StudentDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      progress_percent,
      enrollment_status,
      course_id,
      enrolled_at,
      courses (
        id,
        title,
        slug,
        short_description,
        is_free,
        level,
        category,
        duration_minutes
      )
    `
    )
    .eq("student_id", user.id)
    .order("enrolled_at", { ascending: false });

  const { data: skillProfiles } = await supabase
    .from("learner_skill_profiles")
    .select(
      `
      id,
      current_level,
      confidence_score,
      evidence_count,
      strengths,
      gaps,
      learning_skills (
        name,
        category,
        slug
      )
    `
    )
    .eq("student_id", user.id)
    .order("confidence_score", {
      ascending: false,
    });

  const { data: activities } = await supabase
    .from("learning_activity")
    .select(
      "id, activity_type, created_at, course_id, lesson_id"
    )
    .eq("student_id", user.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(8);

  const normalisedSkills =
    (skillProfiles || []) as SkillProfile[];

  const strengths = normalisedSkills.filter(
    (skill) => Number(skill.confidence_score) >= 70
  );

  const developmentAreas = normalisedSkills
    .filter(
      (skill) => Number(skill.confidence_score) < 70
    )
    .sort(
      (a, b) =>
        Number(a.confidence_score) -
        Number(b.confidence_score)
    );

  const enrolledCourseIds = new Set(
    (enrollments || []).map(
      (enrollment) => enrollment.course_id
    )
  );

  let recommendations: Array<{
    course_id: string;
    title: string;
    slug: string;
    level: string;
    category: string | null;
    short_description: string | null;
    matched_skills: string[];
  }> = [];

  if (developmentAreas.length > 0) {
    const skillIds = developmentAreas.map(
      (skill) => skill.id
    );

    const { data: lessonSkills } = await supabase
      .from("lesson_skills")
      .select(
        `
        skill_id,
        lessons (
          course_id,
          courses (
            id,
            title,
            slug,
            level,
            category,
            short_description,
            status
          )
        )
      `
      )
      .in("skill_id", skillIds);

    const recommendationMap = new Map<
      string,
      {
        course_id: string;
        title: string;
        slug: string;
        level: string;
        category: string | null;
        short_description: string | null;
        matched_skills: Set<string>;
      }
    >();

    for (const item of lessonSkills || []) {
      const lesson = Array.isArray(item.lessons)
        ? item.lessons[0]
        : item.lessons;

      if (!lesson) continue;

      const course = Array.isArray(lesson.courses)
        ? lesson.courses[0]
        : lesson.courses;

      if (!course) continue;

      if (course.status !== "published") continue;

      if (enrolledCourseIds.has(course.id)) continue;

      const skill = developmentAreas.find(
        (candidate) =>
          candidate.id === item.skill_id
      );

      if (!skill) continue;

      const existing =
        recommendationMap.get(course.id);

      if (existing) {
        existing.matched_skills.add(
          skill.learning_skills
            ? Array.isArray(skill.learning_skills)
              ? skill.learning_skills[0]?.name || "Skill"
              : skill.learning_skills.name
            : "Skill"
        );
      } else {
        recommendationMap.set(course.id, {
          course_id: course.id,
          title: course.title,
          slug: course.slug,
          level: course.level,
          category: course.category,
          short_description:
            course.short_description,
          matched_skills: new Set([
            skill.learning_skills
              ? Array.isArray(skill.learning_skills)
                ? skill.learning_skills[0]?.name ||
                  "Skill"
                : skill.learning_skills.name
              : "Skill",
          ]),
        });
      }
    }

    recommendations = Array.from(
      recommendationMap.values()
    )
      .map((course) => ({
        ...course,
        matched_skills: Array.from(
          course.matched_skills
        ),
      }))
      .sort(
        (a, b) =>
          b.matched_skills.length -
          a.matched_skills.length
      )
      .slice(0, 4);
  }

  return (
    <section className="section">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <span className="badge">
              RuffNeck Learn
            </span>

            <h1 className="dashboard-title">
              My learning
            </h1>

            <p className="muted">
              Welcome
              {profile?.full_name
                ? `, ${profile.full_name}`
                : ""}
              . Your learning dashboard tracks progress,
              skills and development areas.
            </p>
          </div>

          <div className="dashboard-actions">
            <Link
              href="/courses"
              className="btn btn-primary"
            >
              Browse courses
            </Link>

            <Link
              href="/student/skills"
              className="btn btn-outline"
            >
              My skills
            </Link>
          </div>
        </div>

        <div className="rn-learning-overview">
          <div className="rn-learning-stat">
            <strong>
              {enrollments?.length || 0}
            </strong>
            <span>Courses</span>
          </div>

          <div className="rn-learning-stat">
            <strong>
              {enrollments?.filter(
                (item) =>
                  item.enrollment_status ===
                  "completed"
              ).length || 0}
            </strong>
            <span>Completed</span>
          </div>

          <div className="rn-learning-stat">
            <strong>
              {strengths.length}
            </strong>
            <span>Strengths</span>
          </div>

          <div className="rn-learning-stat">
            <strong>
              {developmentAreas.length}
            </strong>
            <span>Development areas</span>
          </div>
        </div>

        {developmentAreas.length === 0 &&
          strengths.length === 0 && (
            <div className="rn-diagnostic-banner">
              <div>
                <span className="badge">
                  Personalised learning
                </span>

                <h2>
                  Discover your current skill level
                </h2>

                <p>
                  Complete the RuffNeck diagnostic
                  assessment so the platform can identify
                  your strengths, knowledge gaps and
                  suitable learning paths.
                </p>
              </div>

              <Link
                href="/student/assessment"
                className="btn btn-primary"
              >
                Start assessment
              </Link>
            </div>
          )}

        {recommendations.length > 0 && (
          <section className="dashboard-section">
            <div className="section-heading-row">
              <div>
                <span className="badge">
                  Personalised
                </span>

                <h2>Recommended for you</h2>

                <p className="muted">
                  Courses connected to skills you are
                  still developing.
                </p>
              </div>
            </div>

            <div className="grid">
              {recommendations.map((course) => (
                <article
                  key={course.course_id}
                  className="card recommendation-card"
                >
                  <div className="thumb">
                    RN
                  </div>

                  <div className="card-body">
                    <div>
                      <span className="badge">
                        {course.level}
                      </span>

                      {course.category && (
                        <span
                          className="badge"
                          style={{
                            marginLeft: 6,
                          }}
                        >
                          {course.category}
                        </span>
                      )}
                    </div>

                    <h3>{course.title}</h3>

                    <p>
                      {course.short_description ||
                        "Build practical skills with RuffNeck Learn."}
                    </p>

                    <div className="matched-skills">
                      <strong>
                        Helps develop:
                      </strong>

                      <div>
                        {course.matched_skills
                          .slice(0, 3)
                          .map((skill) => (
                            <span
                              key={skill}
                              className="skill-chip"
                            >
                              {skill}
                            </span>
                          ))}
                      </div>
                    </div>

                    <Link
                      href={`/courses/${course.slug}`}
                      className="btn btn-navy"
                    >
                      View course
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="dashboard-section">
          <div className="section-heading-row">
            <div>
              <h2>My courses</h2>
              <p className="muted">
                Continue your active learning.
              </p>
            </div>
          </div>

          {!enrollments?.length ? (
            <div className="panel">
              <p style={{ margin: "0 0 12px" }}>
                You are not enrolled in any course yet.
              </p>

              <Link
                href="/courses"
                className="btn btn-primary"
              >
                Browse courses
              </Link>
            </div>
          ) : (
            <div className="grid">
              {enrollments.map((enrollment) => {
                const course = Array.isArray(
                  enrollment.courses
                )
                  ? enrollment.courses[0]
                  : enrollment.courses;

                if (!course) return null;

                return (
                  <article
                    key={enrollment.id}
                    className="card"
                  >
                    <div className="thumb">
                      RN
                    </div>

                    <div className="card-body">
                      <span className="badge">
                        {enrollment.enrollment_status ===
                        "completed"
                          ? "Completed"
                          : "In progress"}
                      </span>

                      <h3>{course.title}</h3>

                      <p>
                        {course.short_description}
                      </p>

                      <div
                        className="progress"
                        aria-label={`${enrollment.progress_percent}% complete`}
                      >
                        <span
                          style={{
                            width: `${enrollment.progress_percent}%`,
                          }}
                        />
                      </div>

                      <p className="muted">
                        {enrollment.progress_percent}%
                        complete
                      </p>

                      <Link
                        href={`/courses/${course.slug}`}
                        className="btn btn-navy"
                      >
                        {enrollment.progress_percent >
                        0
                          ? "Continue"
                          : "Start"}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <LearningRecommendations />

        {normalisedSkills.length > 0 && (
          <section className="dashboard-section">
            <div className="section-heading-row">
              <div>
                <h2>Skill profile</h2>

                <p className="muted">
                  Your current learning evidence and
                  development areas.
                </p>
              </div>

              <Link
                href="/student/skills"
                className="btn btn-outline"
              >
                View all skills
              </Link>
            </div>

            <div className="skill-profile-grid">
              {normalisedSkills
                .slice(0, 6)
                .map((skill) => {
                  const skillData =
                    Array.isArray(
                      skill.learning_skills
                    )
                      ? skill.learning_skills[0]
                      : skill.learning_skills;

                  const score = Math.round(
                    Number(
                      skill.confidence_score
                    )
                  );

                  return (
                    <div
                      key={skill.id}
                      className="skill-profile-card"
                    >
                      <div className="skill-profile-top">
                        <strong>
                          {skillData?.name ||
                            "Learning skill"}
                        </strong>

                        <span>
                          {score}%
                        </span>
                      </div>

                      <div className="progress">
                        <span
                          style={{
                            width: `${score}%`,
                          }}
                        />
                      </div>

                      <p className="muted">
                        Level{" "}
                        {skill.current_level}/5
                        {" · "}
                        {skill.evidence_count}{" "}
                        evidence
                      </p>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {activities && activities.length > 0 && (
          <section className="dashboard-section">
            <div className="section-heading-row">
              <div>
                <h2>Recent learning activity</h2>
                <p className="muted">
                  Your latest activity on RuffNeck Learn.
                </p>
              </div>
            </div>

            <div className="activity-list">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="activity-row"
                >
                  <span className="activity-dot" />

                  <div>
                    <strong>
                      {formatActivity(
                        activity.activity_type
                      )}
                    </strong>

                    <p className="muted">
                      {new Date(
                        activity.created_at
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

function formatActivity(type: string) {
  switch (type) {
    case "course_started":
      return "Started a course";

    case "lesson_started":
      return "Started a lesson";

    case "lesson_completed":
      return "Completed a lesson";

    case "resource_opened":
      return "Opened a learning resource";

    case "assessment_started":
      return "Started an assessment";

    case "assessment_completed":
      return "Completed an assessment";

    case "assessment_answered":
      return "Answered an assessment question";

    case "skill_assessed":
      return "Skill profile updated";

    case "recommendation_opened":
      return "Opened a recommendation";

    default:
      return "Learning activity";
  }
}