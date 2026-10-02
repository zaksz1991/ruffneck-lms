```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LearningRecommendations from "@/components/LearningRecommendations";

type SkillData = {
  id: string;
  name: string;
  category: string | null;
  slug: string;
  description: string | null;
};

type SkillProfile = {
  id: string;
  skill_id: string;
  confidence_score: number;
  skill_level: string;
  evidence: string | null;
  strengths: string | null;
  gaps: string | null;
  updated_at: string;
  learning_skills:
    | SkillData
    | SkillData[]
    | null;
};

type Enrollment = {
  id: string;
  progress_percent: number;
  enrollment_status: string;
  course_id: string;
  enrolled_at: string;
  courses:
    | {
        id: string;
        title: string;
        slug: string;
        short_description: string | null;
        is_free: boolean;
        level: string;
        category: string | null;
        duration_minutes: number | null;
      }
    | {
        id: string;
        title: string;
        slug: string;
        short_description: string | null;
        is_free: boolean;
        level: string;
        category: string | null;
        duration_minutes: number | null;
      }[]
    | null;
};

type Activity = {
  id: string;
  activity_type: string;
  created_at: string;
  course_id: string | null;
  lesson_id: string | null;
};

type RecommendationCourse = {
  course_id: string;
  title: string;
  slug: string;
  level: string;
  category: string | null;
  short_description: string | null;
  matched_skills: string[];
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
    .order("enrolled_at", {
      ascending: false,
    });

  const { data: skillProfiles } = await supabase
    .from("learner_skill_profiles")
    .select(
      `
        id,
        skill_id,
        confidence_score,
        skill_level,
        evidence,
        strengths,
        gaps,
        updated_at,
        learning_skills (
          id,
          name,
          category,
          slug,
          description
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
    (skill) =>
      Number(skill.confidence_score) >= 70
  );

  const developmentAreas = normalisedSkills
    .filter(
      (skill) =>
        Number(skill.confidence_score) < 70
    )
    .sort(
      (a, b) =>
        Number(a.confidence_score) -
        Number(b.confidence_score)
    );

  const enrolledCourseIds = new Set(
    ((enrollments || []) as Enrollment[]).map(
      (enrollment) => enrollment.course_id
    )
  );

  let recommendations: RecommendationCourse[] =
    [];

  /*
   * Build course recommendations from the learner's
   * actual weak skill IDs.
   *
   * Important:
   * learner_skill_profiles.id is the profile-row ID.
   * learner_skill_profiles.skill_id is the ID that
   * connects to lesson_skills.skill_id.
   */
  if (developmentAreas.length > 0) {
    const skillIds = developmentAreas
      .map((skill) => skill.skill_id)
      .filter(Boolean);

    if (skillIds.length > 0) {
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

        const course = Array.isArray(
          lesson.courses
        )
          ? lesson.courses[0]
          : lesson.courses;

        if (!course) continue;

        if (course.status !== "published") {
          continue;
        }

        if (enrolledCourseIds.has(course.id)) {
          continue;
        }

        const skill = developmentAreas.find(
          (candidate) =>
            candidate.skill_id === item.skill_id
        );

        if (!skill) continue;

        const skillData = Array.isArray(
          skill.learning_skills
        )
          ? skill.learning_skills[0]
          : skill.learning_skills;

        const skillName =
          skillData?.name || "Skill development";

        const existing =
          recommendationMap.get(course.id);

        if (existing) {
          existing.matched_skills.add(
            skillName
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
              skillName,
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
  }

  const typedEnrollments =
    (enrollments || []) as Enrollment[];

  const typedActivities =
    (activities || []) as Activity[];

  const hasSkillProfile =
    normalisedSkills.length > 0;

  const averageConfidence =
    hasSkillProfile
      ? Math.round(
          normalisedSkills.reduce(
            (total, skill) =>
              total +
              Number(
                skill.confidence_score || 0
              ),
            0
          ) / normalisedSkills.length
        )
      : 0;

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
              . Your learning dashboard tracks
              progress, skills and development
              areas.
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
              {typedEnrollments.length}
            </strong>
            <span>Courses</span>
          </div>

          <div className="rn-learning-stat">
            <strong>
              {
                typedEnrollments.filter(
                  (item) =>
                    item.enrollment_status ===
                    "completed"
                ).length
              }
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
            <span>
              Development areas
            </span>
          </div>
        </div>

        {!hasSkillProfile && (
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
                assessment so the platform can
                identify your strengths, knowledge
                gaps and suitable learning paths.
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

        {hasSkillProfile && (
          <section className="dashboard-section">
            <div className="section-heading-row">
              <div>
                <span className="badge">
                  Learning profile
                </span>

                <h2>
                  Your current skill profile
                </h2>

                <p className="muted">
                  Based on your latest learning
                  evidence and diagnostic results.
                </p>
              </div>

              <Link
                href="/student/skills"
                className="btn btn-outline"
              >
                View all skills
              </Link>
            </div>

            <div className="rn-learning-overview">
              <div className="rn-learning-stat">
                <strong>
                  {normalisedSkills.length}
                </strong>
                <span>Assessed skills</span>
              </div>

              <div className="rn-learning-stat">
                <strong>
                  {averageConfidence}%
                </strong>
                <span>
                  Average confidence
                </span>
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
                <span>
                  Development areas
                </span>
              </div>
            </div>
          </section>
        )}

        {recommendations.length > 0 && (
          <section className="dashboard-section">
            <div className="section-heading-row">
              <div>
                <span className="badge">
                  Personalised
                </span>

                <h2>
                  Recommended for you
                </h2>

                <p className="muted">
                  Courses connected to skills you
                  are still developing.
                </p>
              </div>
            </div>

            <div className="grid">
              {recommendations.map(
                (course) => (
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

                      <h3>
                        {course.title}
                      </h3>

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
                            .map(
                              (skill) => (
                                <span
                                  key={skill}
                                  className="skill-chip"
                                >
                                  {skill}
                                </span>
                              )
                            )}
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
                )
              )}
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

          {!typedEnrollments.length ? (
            <div className="panel">
              <p
                style={{
                  margin: "0 0 12px",
                }}
              >
                You are not enrolled in any
                course yet.
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
              {typedEnrollments.map(
                (enrollment) => {
                  const course =
                    Array.isArray(
                      enrollment.courses
                    )
                      ? enrollment.courses[0]
                      : enrollment.courses;

                  if (!course) {
                    return null;
                  }

                  const completed =
                    enrollment.enrollment_status ===
                    "completed";

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
                          {completed
                            ? "Completed"
                            : "In progress"}
                        </span>

                        <h3>
                          {course.title}
                        </h3>

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
                          {
                            enrollment.progress_percent
                          }
                          % complete
                        </p>

                        <Link
                          href={`/courses/${course.slug}`}
                          className="btn btn-navy"
                        >
                          {completed
                            ? "Review course"
                            : enrollment.progress_percent >
                                0
                              ? "Continue"
                              : "Start"}
                        </Link>
                      </div>
                    </article>
                  );
                }
              )}
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
                  Your current learning evidence
                  and development areas.
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

                  const score = Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round(
                        Number(
                          skill.confidence_score ||
                            0
                        )
                      )
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
                        {formatSkillLevel(
                          skill.skill_level
                        )}
                      </p>

                      {skill.gaps && (
                        <p className="muted">
                          Gap: {skill.gaps}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {typedActivities.length > 0 && (
          <section className="dashboard-section">
            <div className="section-heading-row">
              <div>
                <h2>
                  Recent learning activity
                </h2>

                <p className="muted">
                  Your latest activity on RuffNeck
                  Learn.
                </p>
              </div>
            </div>

            <div className="activity-list">
              {typedActivities.map(
                (activity) => (
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
                )
              )}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

function formatSkillLevel(
  level: string | null | undefined
) {
  if (!level) {
    return "Beginner";
  }

  return (
    level.charAt(0).toUpperCase() +
    level.slice(1)
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
```
