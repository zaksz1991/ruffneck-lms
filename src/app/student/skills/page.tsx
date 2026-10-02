import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function StudentSkillsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/skills");
  }

  const { data: skills } = await supabase
    .from("learner_skill_profiles")
    .select(
      `
      id,
      current_level,
      confidence_score,
      evidence_count,
      strengths,
      gaps,
      last_assessed_at,
      learning_skills (
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

  const strongSkills =
    skills?.filter(
      (skill) =>
        Number(skill.confidence_score) >= 70
    ) || [];

  const developmentSkills =
    skills?.filter(
      (skill) =>
        Number(skill.confidence_score) < 70
    ) || [];

  return (
    <section className="section">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <Link
              href="/student/dashboard"
              className="muted"
            >
              ← My learning
            </Link>

            <h1 className="dashboard-title">
              My skills
            </h1>

            <p className="muted">
              Your RuffNeck Learn skill profile is built
              from assessments, course activity and
              learning evidence.
            </p>
          </div>

          <Link
            href="/student/assessment"
            className="btn btn-primary"
          >
            Take assessment
          </Link>
        </div>

        {!skills?.length ? (
          <div className="rn-diagnostic-banner">
            <div>
              <span className="badge">
                No profile yet
              </span>

              <h2>
                Build your learning profile
              </h2>

              <p>
                Complete a diagnostic assessment to
                establish your current strengths and
                development areas.
              </p>
            </div>

            <Link
              href="/student/assessment"
              className="btn btn-primary"
            >
              Start diagnostic
            </Link>
          </div>
        ) : (
          <>
            <div className="rn-learning-overview">
              <div className="rn-learning-stat">
                <strong>
                  {skills.length}
                </strong>
                <span>Tracked skills</span>
              </div>

              <div className="rn-learning-stat">
                <strong>
                  {strongSkills.length}
                </strong>
                <span>Strengths</span>
              </div>

              <div className="rn-learning-stat">
                <strong>
                  {developmentSkills.length}
                </strong>
                <span>Development areas</span>
              </div>
            </div>

            <div className="skill-profile-grid large">
              {skills.map((skill) => {
                const skillData =
                  Array.isArray(
                    skill.learning_skills
                  )
                    ? skill.learning_skills[0]
                    : skill.learning_skills;

                const score = Math.round(
                  Number(skill.confidence_score)
                );

                return (
                  <article
                    key={skill.id}
                    className="skill-profile-card large"
                  >
                    <div className="skill-profile-top">
                      <div>
                        <span className="badge">
                          {skillData?.category ||
                            "General"}
                        </span>

                        <h3>
                          {skillData?.name ||
                            "Learning skill"}
                        </h3>
                      </div>

                      <strong>
                        {score}%
                      </strong>
                    </div>

                    <div className="progress">
                      <span
                        style={{
                          width: `${score}%`,
                        }}
                      />
                    </div>

                    <p>
                      Level{" "}
                      <strong>
                        {skill.current_level}/5
                      </strong>
                    </p>

                    <p className="muted">
                      Evidence:{" "}
                      {skill.evidence_count}
                    </p>

                    {skill.strengths && (
                      <div className="skill-note strength">
                        <strong>
                          Strength
                        </strong>

                        <p>
                          {skill.strengths}
                        </p>
                      </div>
                    )}

                    {skill.gaps && (
                      <div className="skill-note gap">
                        <strong>
                          Development area
                        </strong>

                        <p>
                          {skill.gaps}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}