import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
    | {
        id: string;
        name: string;
        slug: string;
        category: string | null;
        description: string | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        category: string | null;
        description: string | null;
      }[]
    | null;
};

export default async function StudentSkillsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="container">
        <div className="auth-box">
          <h1>My Learning Profile</h1>
          <p>Please log in to view your learning profile.</p>
          <Link href="/login" className="btn btn-primary">
            Log in
          </Link>
        </div>
      </main>
    );
  }

  const { data: profiles } = await supabase
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
    .order("confidence_score", { ascending: false });

  const skillProfiles = (profiles || []) as SkillProfile[];

  const normalized = skillProfiles.map((profile) => {
    const skill = Array.isArray(profile.learning_skills)
      ? profile.learning_skills[0]
      : profile.learning_skills;

    const score = Math.max(
      0,
      Math.min(100, Number(profile.confidence_score || 0))
    );

    return {
      ...profile,
      skill,
      score,
    };
  });

  const averageScore =
    normalized.length > 0
      ? Math.round(
          normalized.reduce((sum, item) => sum + item.score, 0) /
            normalized.length
        )
      : 0;

  const strengths = normalized.filter((item) => item.score >= 80);
  const developmentAreas = normalized.filter(
    (item) => item.score < 50
  );

  const latestUpdate = normalized
    .map((item) => item.updated_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
    <main className="container">
      <div className="rn-profile-shell">
        <div className="rn-profile-header">
          <div>
            <span className="rn-eyebrow">RuffNeck Learn</span>
            <h1>My Learning Profile</h1>
            <p>
              Your learning profile tracks your demonstrated skills and
              identifies areas where additional learning may be useful.
            </p>
          </div>

          <div className="rn-profile-header-actions">
            <Link
              href="/student/assessment"
              className="btn btn-primary"
            >
              {normalized.length
                ? "Retake Assessment"
                : "Take Diagnostic Assessment"}
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
            <div className="rn-profile-empty-icon">RN</div>
            <h2>Build your learning profile</h2>
            <p>
              Take the diagnostic assessment to establish your initial
              skill profile. Your results will be used to personalize
              recommendations.
            </p>

            <Link
              href="/student/assessment"
              className="btn btn-primary"
            >
              Start Diagnostic Assessment
            </Link>
          </section>
        ) : (
          <>
            <div className="rn-profile-stats">
              <article className="rn-profile-stat">
                <span>Average skill score</span>
                <strong>{averageScore}%</strong>
              </article>

              <article className="rn-profile-stat">
                <span>Skills assessed</span>
                <strong>{normalized.length}</strong>
              </article>

              <article className="rn-profile-stat">
                <span>Strengths</span>
                <strong>{strengths.length}</strong>
              </article>

              <article className="rn-profile-stat">
                <span>Development areas</span>
                <strong>{developmentAreas.length}</strong>
              </article>
            </div>

            <div className="rn-profile-grid">
              <section className="rn-profile-panel">
                <div className="rn-profile-panel-heading">
                  <div>
                    <span className="rn-eyebrow">Skill map</span>
                    <h2>Your skills</h2>
                  </div>
                </div>

                <div className="rn-profile-skill-list">
                  {normalized.map((item) => (
                    <article
                      className="rn-profile-skill"
                      key={item.id}
                    >
                      <div className="rn-profile-skill-heading">
                        <div>
                          <strong>
                            {item.skill?.name || "Learning skill"}
                          </strong>

                          {item.skill?.category && (
                            <span>{item.skill.category}</span>
                          )}
                        </div>

                        <div className="rn-profile-skill-score">
                          <strong>{item.score}%</strong>
                          <span>
                            {item.skill_level || "beginner"}
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

                      {(item.strengths || item.gaps) && (
                        <div className="rn-profile-insight">
                          {item.strengths && (
                            <div>
                              <strong>Strength</strong>
                              <span>{item.strengths}</span>
                            </div>
                          )}

                          {item.gaps && (
                            <div>
                              <strong>Development</strong>
                              <span>{item.gaps}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <aside className="rn-profile-sidebar">
                <section className="rn-profile-panel">
                  <span className="rn-eyebrow">Strengths</span>
                  <h2>What you already know</h2>

                  {strengths.length ? (
                    <div className="rn-profile-mini-list">
                      {strengths.slice(0, 6).map((item) => (
                        <div key={item.id}>
                          <strong>
                            {item.skill?.name || "Skill"}
                          </strong>
                          <span>{item.score}% demonstrated</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rn-profile-muted">
                      Complete more assessments to identify your strongest
                      areas.
                    </p>
                  )}
                </section>

                <section className="rn-profile-panel">
                  <span className="rn-eyebrow">Development</span>
                  <h2>Areas to strengthen</h2>

                  {developmentAreas.length ? (
                    <div className="rn-profile-mini-list">
                      {developmentAreas.slice(0, 6).map((item) => (
                        <div key={item.id}>
                          <strong>
                            {item.skill?.name || "Skill"}
                          </strong>
                          <span>{item.score}% demonstrated</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rn-profile-muted">
                      No major development areas identified from the
                      available assessment data.
                    </p>
                  )}
                </section>

                <section className="rn-profile-panel rn-profile-next">
                  <span className="rn-eyebrow">Next step</span>
                  <h2>Continue learning</h2>
                  <p>
                    Use your skill profile to choose courses and lessons
                    aligned with your current level.
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
                {new Date(latestUpdate).toLocaleDateString()}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}