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

type Skill = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
};

type LessonSkill = {
  lesson_id: string;
  skill_id: string;
  relevance_weight: number;
};

type Lesson = {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  is_published: boolean;
  is_preview: boolean;
  sort_order: number;
};

type Recommendation = {
  course_id: string;
  title: string;
  slug: string;
  level: Course["level"];
  category: string | null;
  short_description: string | null;
  matched_skills: string[];
  score: number;
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

  /*
   * --------------------------------------------------------------------------
   * PROFILE
   * --------------------------------------------------------------------------
   */

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as Profile | null;

  /*
   * --------------------------------------------------------------------------
   * ENROLLMENTS
   * --------------------------------------------------------------------------
   */

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

  const enrollments = (enrollmentData || []) as Enrollment[];

  /*
   * --------------------------------------------------------------------------
   * ENROLLED COURSES
   *
   * Deliberately queried separately instead of using nested Supabase
   * relationships. This keeps the TypeScript build predictable.
   * --------------------------------------------------------------------------
   */

  const enrolledCourseIds = [
    ...new Set(enrollments.map((item) => item.course_id)),
  ];

  let enrolledCourses: Course[] = [];

  if (enrolledCourseIds.length > 0) {
    const { data: courseData } = await supabase
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

    enrolledCourses = (courseData || []) as Course[];
  }

  const courseMap = new Map<string, Course>();

  enrolledCourses.forEach((course) => {
    courseMap.set(course.id, course);
  });

  /*
   * --------------------------------------------------------------------------
   * SKILL PROFILE
   * --------------------------------------------------------------------------
   */

  const { data: skillProfileData } = await supabase
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

  const skillProfiles = (skillProfileData || []) as SkillProfile[];

  const skillIds = [
    ...new Set(skillProfiles.map((profileItem) => profileItem.skill_id)),
  ];

  let skills: Skill[] = [];

  if (skillIds.length > 0) {
    const { data: skillData } = await supabase
      .from("learning_skills")
      .select("id, name, slug, category, description")
      .in("id", skillIds);

    skills = (skillData || []) as Skill[];
  }

  const skillMap = new Map<string, Skill>();

  skills.forEach((skill) => {
    skillMap.set(skill.id, skill);
  });

  /*
   * --------------------------------------------------------------------------
   * BASIC STATS
   * --------------------------------------------------------------------------
   */

  const totalCourses = enrollments.length;

  const completedCourses = enrollments.filter(
    (enrollment) =>
      enrollment.progress_percent >= 100 ||
      enrollment.enrollment_status === "completed"
  ).length;

  const strengthCount = skillProfiles.filter(
    (skill) => Number(skill.confidence_score) >= 80
  ).length;

  const developmentCount = skillProfiles.filter(
    (skill) => Number(skill.confidence_score) < 50
  ).length;

  /*
   * --------------------------------------------------------------------------
   * PERSONALIZED COURSE RECOMMENDATIONS
   *
   * Uses separate queries:
   * learner_skill_profiles
   * -> lesson_skills
   * -> lessons
   * -> courses
   *
   * No nested Supabase relation typing is used.
   * --------------------------------------------------------------------------
   */

  const weakSkillProfiles = skillProfiles
    .filter((skill) => Number(skill.confidence_score) < 70)
    .sort(
      (a, b) =>
        Number(a.confidence_score) - Number(b.confidence_score)
    );

  const weakSkillIds = [
    ...new Set(weakSkillProfiles.map((skill) => skill.skill_id)),
  ];

  let recommendations: Recommendation[] = [];

  if (weakSkillIds.length > 0) {
    const { data: lessonSkillData } = await supabase
      .from("lesson_skills")
      .select("lesson_id, skill_id, relevance_weight")
      .in("skill_id", weakSkillIds);

    const lessonSkills = (lessonSkillData || []) as LessonSkill[];

    const lessonIds = [
      ...new Set(lessonSkills.map((item) => item.lesson_id)),
    ];

    if (lessonIds.length > 0) {
      const { data: lessonData } = await supabase
        .from("lessons")
        .select(
          `
            id,
            course_id,
            title,
            slug,
            is_published,
            is_preview,
            sort_order
          `
        )
        .in("id", lessonIds)
        .eq("is_published", true);

      const lessons = (lessonData || []) as Lesson[];

      const recommendationCourseIds = [
        ...new Set(lessons.map((lesson) => lesson.course_id)),
      ].filter((courseId) => !enrolledCourseIds.includes(courseId));

      if (recommendationCourseIds.length > 0) {
        const { data: recommendationCourseData } = await supabase
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
          .in("id", recommendationCourseIds)
          .eq("status", "published");

        const recommendationCourses =
          (recommendationCourseData || []) as Course[];

        const recommendationCourseMap = new Map<string, Course>();

        recommendationCourses.forEach((course) => {
          recommendationCourseMap.set(course.id, course);
        });

        const recommendationMap = new Map<
          string,
          Recommendation
        >();

        lessons.forEach((lesson) => {
          const course = recommendationCourseMap.get(lesson.course_id);

          if (!course) {
            return;
          }

          const matchingLessonSkills = lessonSkills.filter(
            (lessonSkill) =>
              lessonSkill.lesson_id === lesson.id &&
              weakSkillIds.includes(lessonSkill.skill_id)
          );

          matchingLessonSkills.forEach((lessonSkill) => {
            const skill = skillMap.get(lessonSkill.skill_id);

            const skillName = skill?.name || "Skill development";

            const profileForSkill = weakSkillProfiles.find(
              (item) => item.skill_id === lessonSkill.skill_id
            );

            const confidence = Number(
              profileForSkill?.confidence_score ?? 0
            );

            const relevance = Number(
              lessonSkill.relevance_weight ?? 1
            );

            const score = Math.max(
              0,
              100 - confidence
            ) * relevance;

            const existing = recommendationMap.get(course.id);

            if (existing) {
              if (!existing.matched_skills.includes(skillName)) {
                existing.matched_skills.push(skillName);
              }

              existing.score += score;
            } else {
              recommendationMap.set(course.id, {
                course_id: course.id,
                title: course.title,
                slug: course.slug,
                level: course.level,
                category: course.category,
                short_description: course.short_description,
                matched_skills: [skillName],
                score,
              });
            }
          });
        });

        recommendations = Array.from(
          recommendationMap.values()
        )
          .sort((a, b) => b.score - a.score)
          .slice(0, 6);
      }
    }
  }

  /*
   * --------------------------------------------------------------------------
   * DISPLAY DATA
   * --------------------------------------------------------------------------
   */

  const displayName =
    profile?.full_name ||
    user.email?.split("@")[0] ||
    "Learner";

  const averageSkillScore =
    skillProfiles.length > 0
      ? Math.round(
          skillProfiles.reduce(
            (total, skill) =>
              total + Number(skill.confidence_score || 0),
            0
          ) / skillProfiles.length
        )
      : 0;

  return (
    <main className="container rn-dashboard-shell">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                             */}
      {/* ------------------------------------------------------------------ */}

      <section className="rn-dashboard-header">
        <div>
          <div className="rn-eyebrow">RUFFNECK LEARN</div>

          <h1>Learning Dashboard</h1>

          <p className="rn-dashboard-intro">
            Welcome
            {profile?.full_name
              ? `, ${profile.full_name}`
              : ""}
            . Your learning dashboard tracks progress, skills
            and development.
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
            href="/student/assessment"
            className="rn-button rn-button-secondary"
          >
            Skill Assessment
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STATS                                                              */}
      {/* ------------------------------------------------------------------ */}

      <section className="rn-dashboard-stats">
        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Courses
          </span>

          <strong>{totalCourses}</strong>

          <small>Enrolled courses</small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Completed
          </span>

          <strong>{completedCourses}</strong>

          <small>Courses completed</small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Strengths
          </span>

          <strong>{strengthCount}</strong>

          <small>Skills at 80%+</small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Development
          </span>

          <strong>{developmentCount}</strong>

          <small>Skills below 50%</small>
        </article>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* PROFILE SUMMARY                                                    */}
      {/* ------------------------------------------------------------------ */}

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
              <strong>{averageSkillScore}%</strong>

              <span>Average skill confidence</span>
            </div>

            <div className="rn-profile-details">
              <p>
                <strong>Email:</strong>{" "}
                {profile?.email || user.email}
              </p>

              <p>
                <strong>Role:</strong>{" "}
                {profile?.role || "student"}
              </p>

              <p>
                <strong>Skills tracked:</strong>{" "}
                {skillProfiles.length}
              </p>
            </div>
          </div>
        </article>

        <article className="rn-dashboard-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">
                NEXT STEP
              </span>

              <h2>Build your learning profile</h2>
            </div>
          </div>

          <p className="rn-dashboard-card-text">
            Complete the diagnostic assessment to identify
            your current strengths and development areas.
            Your results can be used to personalize your
            learning path.
          </p>

          <Link
            href="/student/assessment"
            className="rn-button rn-button-primary"
          >
            Take Diagnostic Assessment
          </Link>
        </article>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* MY COURSES                                                         */}
      {/* ------------------------------------------------------------------ */}

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">MY LEARNING</span>

            <h2>My Courses</h2>

            <p>
              Continue your courses and track your progress.
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
              You have not enrolled in a course yet. Explore
              the RuffNeck Learn catalog to get started.
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
            {enrollments.map((enrollment) => {
              const course = courseMap.get(
                enrollment.course_id
              );

              if (!course) {
                return null;
              }

              const progress = Math.min(
                100,
                Math.max(
                  0,
                  Number(enrollment.progress_percent || 0)
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
                        src={course.thumbnail_url}
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
                      <span>{formatLevel(course.level)}</span>

                      {course.category ? (
                        <span>{course.category}</span>
                      ) : null}
                    </div>

                    <h3>{course.title}</h3>

                    <p>
                      {course.short_description ||
                        "Continue learning and build practical skills."}
                    </p>

                    <div className="rn-progress-block">
                      <div className="rn-progress-header">
                        <span>
                          {getProgressLabel(progress)}
                        </span>

                        <strong>{progress}%</strong>
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
                        {progress >= 100
                          ? "Review Course"
                          : progress > 0
                            ? "Continue"
                            : "Start Course"}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SKILL PROFILE                                                       */}
      {/* ------------------------------------------------------------------ */}

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">
              SKILL INTELLIGENCE
            </span>

            <h2>Your Skill Profile</h2>

            <p>
              Your current confidence levels across tracked
              learning skills.
            </p>
          </div>

          <Link
            href="/student/skills"
            className="rn-text-link"
          >
            View full profile
          </Link>
        </div>

        {skillProfiles.length === 0 ? (
          <article className="rn-empty-state">
            <h3>No skill profile yet</h3>

            <p>
              Take the diagnostic assessment to create your
              first learning skill profile.
            </p>

            <Link
              href="/student/assessment"
              className="rn-button rn-button-primary"
            >
              Start Assessment
            </Link>
          </article>
        ) : (
          <div className="rn-skill-dashboard-grid">
            {skillProfiles.slice(0, 8).map((skillProfile) => {
              const skill = skillMap.get(
                skillProfile.skill_id
              );

              const score = Math.min(
                100,
                Math.max(
                  0,
                  Number(skillProfile.confidence_score || 0)
                )
              );

              return (
                <article
                  key={skillProfile.id}
                  className="rn-skill-dashboard-card"
                >
                  <div className="rn-skill-dashboard-header">
                    <div>
                      <h3>
                        {skill?.name || "Learning Skill"}
                      </h3>

                      <span>
                        {skillProfile.skill_level ||
                          "beginner"}
                      </span>
                    </div>

                    <strong>{score}%</strong>
                  </div>

                  <div className="rn-skill-bar">
                    <div
                      style={{
                        width: `${score}%`,
                      }}
                    />
                  </div>

                  {skill?.category ? (
                    <small>{skill.category}</small>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* PERSONALIZED RECOMMENDATIONS                                        */}
      {/* ------------------------------------------------------------------ */}

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">
              PERSONALIZED LEARNING
            </span>

            <h2>Recommended Courses</h2>

            <p>
              Courses connected to skills that can strengthen
              your current learning profile.
            </p>
          </div>
        </div>

        {recommendations.length === 0 ? (
          <article className="rn-empty-state">
            <h3>
              No major skill gaps were identified from your
              current profile.
            </h3>

            <p>
              Complete more lessons or retake the diagnostic
              assessment as your skills develop. New
              recommendations will appear when relevant.
            </p>

            <div className="rn-dashboard-inline-actions">
              <Link
                href="/student/assessment"
                className="rn-button rn-button-secondary"
              >
                Retake Assessment
              </Link>

              <Link
                href="/courses"
                className="rn-button rn-button-primary"
              >
                Explore Courses
              </Link>
            </div>
          </article>
        ) : (
          <div className="rn-recommendation-grid">
            {recommendations.map((recommendation) => (
              <article
                key={recommendation.course_id}
                className="rn-recommendation-card"
              >
                <div className="rn-recommendation-top">
                  <span className="rn-recommendation-badge">
                    Recommended
                  </span>

                  <span>
                    {formatLevel(recommendation.level)}
                  </span>
                </div>

                <h3>{recommendation.title}</h3>

                <p>
                  {recommendation.short_description ||
                    "Build practical skills through this course."}
                </p>

                {recommendation.matched_skills.length >
                0 ? (
                  <div className="rn-recommendation-skills">
                    {recommendation.matched_skills
                      .slice(0, 4)
                      .map((skillName) => (
                        <span key={skillName}>
                          {skillName}
                        </span>
                      ))}
                  </div>
                ) : null}

                <Link
                  href={`/courses/${recommendation.slug}`}
                  className="rn-button rn-button-primary"
                >
                  View Course
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* QUICK ACTIONS                                                       */}
      {/* ------------------------------------------------------------------ */}

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">QUICK ACTIONS</span>

            <h2>Continue Learning</h2>
          </div>
        </div>

        <div className="rn-dashboard-actions-grid">
          <Link
            href="/courses"
            className="rn-dashboard-action"
          >
            <strong>Browse Courses</strong>

            <span>
              Explore AI, data, digital marketing and
              productivity courses.
            </span>
          </Link>

          <Link
            href="/student/assessment"
            className="rn-dashboard-action"
          >
            <strong>Take Assessment</strong>

            <span>
              Measure your current skills and identify
              development areas.
            </span>
          </Link>

          <Link
            href="/student/skills"
            className="rn-dashboard-action"
          >
            <strong>View Skills</strong>

            <span>
              Review your learning profile and skill
              confidence levels.
            </span>
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER NOTE                                                        */}
      {/* ------------------------------------------------------------------ */}

      <section className="rn-dashboard-footer-note">
        <p>
          RuffNeck Learn helps you build practical digital
          skills through structured courses, assessments and
          personalized learning recommendations.
        </p>

        <p>
          Last profile update:{" "}
          {formatDate(
            skillProfiles[0]?.updated_at || null
          )}
        </p>
      </section>
    </main>
  );
}