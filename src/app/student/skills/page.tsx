import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Skill = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
};

type SkillProfile = {
  id: string;
  skill_id: string;
  confidence_score: number | null;
  skill_level: string | null;
  evidence: string | null;
  strengths: string | null;
  gaps: string | null;
  updated_at: string | null;
  learning_skills:
    | Skill
    | Skill[]
    | null;
};

function clampScore(value: number | null) {
  return Math.min(
    100,
    Math.max(0, Number(value ?? 0))
  );
}

function formatLevel(level: string | null) {
  if (!level) {
    return "Beginner";
  }

  return (
    level.charAt(0).toUpperCase() +
    level.slice(1)
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

export default async function StudentSkillsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/skills");
  }

  const {
    data: profiles,
    error: profilesError,
  } = await supabase
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
          slug,
          category,
          description
        )
      `
    )
    .eq("student_id", user.id)
    .order("confidence_score", {
      ascending: false,
    });

  if (profilesError) {
    console.error(
      "Failed to load student skill profile:",
      profilesError
    );
  }

  const skillProfiles =
    (profiles || []) as unknown as SkillProfile[];

  const normalized = skillProfiles.map(
    (profile) => {
      const skill = Array.isArray(
        profile.learning_skills
      )
        ? profile.learning_skills[0] ?? null
        : profile.learning_skills;

      return {
        ...profile,
        skill,
        score: clampScore(
          profile.confidence_score
        ),
      };
    }
  );

  const averageScore =
    normalized.length > 0
      ? Math.round(
          normalized.reduce(
            (sum, item) =>
              sum + item.score,
            0
          ) / normalized.length
        )
      : 0;

  const strengths = normalized.filter(
    (item) => item.score >= 80
  );

  const developmentAreas =
    normalized.filter(
      (item) => item.score < 50
    );

  const latestUpdate =
    normalized
      .map((item) => item.updated_at)
      .filter(
        (value): value is string =>
          Boolean(value)
      )
      .sort(
        (a, b) =>
          new Date(b).getTime() -
          new Date(a).getTime()
      )[0] ?? null;

  return (
    <main className="container">
      <div className="rn-profile-shell">
        <div className="rn-profile-header">
          <div>
            <span className="rn-eyebrow">
              RUFFNECK LEARN
            </span>

            <h1>My Learning Profile</h1>

            <p>
              Your learning profile tracks
              demonstrated skills, current
              confidence levels and areas for
              further development.
            </p>
          </div>

          <div className="rn-profile-header-actions">
            <Link
              href="/courses"
              className="btn btn-primary"
            >
              {normalized.length
                ? "Take a Course Assessment"
                : "Start Learning"}
            </Link>

            <Link
              href="/student/dashboard"
              className="btn btn-ghost"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {normalized.length === 0 ? (
          <section className="rn-profile-empty">
            <div className="rn-profile-empty-icon">
              RN
            </div>

            <h2>
              Build your learning profile
            </h2>

            <p>
              Your skill profile is built from
              assessments completed through
              RuffNeck Learn courses. Enroll in
              a course and complete its
              assessment to establish and
              develop your learning profile.
            </p>

            <Link
              href="/courses"
              className="btn btn-primary"
            >
              Browse Courses
            </Link>
          </section>
        ) : (
          <>
            <div className="rn-profile-stats">
              <article className="rn-profile-stat">
                <span>
                  Average skill score
                </span>

                <strong>
                  {averageScore}%
                </strong>
              </article>

              <article className="rn-profile-stat">
                <span>
                  Skills assessed
                </span>

                <strong>
                  {normalized.length}
                </strong>
              </article>

              <article className="rn-profile-stat">
                <span>Strengths</span>

                <strong>
                  {strengths.length}
                </strong>
              </article>

              <article className="rn-profile-stat">
                <span>
                  Development areas
                </span>

                <strong>
                  {developmentAreas.length}
                </strong>
              </article>
            </div>

            <div className="rn-profile-grid">
              <section className="rn-profile-panel">
                <div className="rn-profile-panel-heading">
                  <div>
                    <span className="rn-eyebrow">
                      SKILL MAP
                    </span>

                    <h2>Your skills</h2>
                  </div>

                  <Link
                    href="/courses"
                    className="rn-text-link"
                  >
                    Continue learning
                  </Link>
                </div>

                <div className="rn-profile-skill-list">
                  {normalized.map(
                    (item) => (
                      <article
                        className="rn-profile-skill"
                        key={item.id}
                      >
                        <div className="rn-profile-skill-heading">
                          <div>
                            <strong>
                              {item.skill
                                ?.name ||
                                "Learning skill"}
                            </strong>

                            {item.skill
                              ?.category && (
                              <span>
                                {
                                  item
                                    .skill
                                    .category
                                }
                              </span>
                            )}
                          </div>

                          <div className="rn-profile-skill-score">
                            <strong>
                              {item.score}%
                            </strong>

                            <span>
                              {formatLevel(
                                item.skill_level
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="rn-skill-bar">
                          <span
                            style={{
                              width: `${item.score}%`,
                            }}
                          />
                        </div>

                        {item.evidence && (
                          <p className="rn-profile-evidence">
                            {item.evidence}
                          </p>
                        )}

                        {(
                          item.strengths ||
                          item.gaps
                        ) && (
                          <div className="rn-profile-insight">
                            {item.strengths && (
                              <div>
                                <strong>
                                  Strength
                                </strong>

                                <span>
                                  {
                                    item.strengths
                                  }
                                </span>
                              </div>
                            )}

                            {item.gaps && (
                              <div>
                                <strong>
                                  Development
                                </strong>

                                <span>
                                  {item.gaps}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  )}
                </div>
              </section>

              <aside className="rn-profile-sidebar">
                <section className="rn-profile-panel">
                  <span className="rn-eyebrow">
                    STRENGTHS
                  </span>

                  <h2>
                    What you already know
                  </h2>

                  {strengths.length ? (
                    <div className="rn-profile-mini-list">
                      {strengths
                        .slice(0, 6)
                        .map((item) => (
                          <div
                            key={item.id}
                          >
                            <strong>
                              {item.skill
                                ?.name ||
                                "Skill"}
                            </strong>

                            <span>
                              {item.score}%
                              demonstrated
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="rn-profile-muted">
                      Complete more course
                      assessments to
                      identify your strongest
                      areas.
                    </p>
                  )}
                </section>

                <section className="rn-profile-panel">
                  <span className="rn-eyebrow">
                    DEVELOPMENT
                  </span>

                  <h2>
                    Areas to strengthen
                  </h2>

                  {developmentAreas.length ? (
                    <div className="rn-profile-mini-list">
                      {developmentAreas
                        .slice(0, 6)
                        .map((item) => (
                          <div
                            key={item.id}
                          >
                            <strong>
                              {item.skill
                                ?.name ||
                                "Skill"}
                            </strong>

                            <span>
                              {item.score}%
                              demonstrated
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="rn-profile-muted">
                      No major development
                      areas identified from
                      the available
                      assessment data.
                    </p>
                  )}
                </section>

                <section className="rn-profile-panel rn-profile-next">
                  <span className="rn-eyebrow">
                    NEXT STEP
                  </span>

                  <h2>
                    Continue learning
                  </h2>

                  <p>
                    Use your skill profile to
                    choose courses that
                    strengthen your current
                    capabilities and address
                    development areas.
                  </p>

                  <Link
                    href="/courses"
                    className="btn btn-primary btn-block"
                  >
                    Browse Courses
                  </Link>
                </section>
              </aside>
            </div>

            {latestUpdate && (
              <p className="rn-profile-updated">
                Profile last updated{" "}
                {formatDate(
                  latestUpdate
                )}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}