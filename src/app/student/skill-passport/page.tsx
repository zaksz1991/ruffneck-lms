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
  skill_id: string;
  score: number | null;
  confidence_score: number | null;
  skill_level: string | null;
  evidence_count: number | null;
  evidence: string[] | null;
  strengths: string[] | null;
  gaps: string[] | null;
};

function percentage(value: number | null) {
  if (value === null) {
    return null;
  }

  const normalized =
    value <= 1 ? value * 100 : value;

  return Math.round(normalized);
}

function label(value: string | null) {
  if (!value) {
    return "Developing";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export default async function SkillPassportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/skill-passport",
    );
  }

  const { data: profiles, error } =
    await supabase
      .from("learner_skill_profiles")
      .select(
        `
          skill_id,
          score,
          confidence_score,
          skill_level,
          evidence_count,
          evidence,
          strengths,
          gaps
        `,
      )
      .eq("student_id", user.id)
      .order("confidence_score", {
        ascending: false,
        nullsFirst: false,
      });

  if (error) {
    throw new Error(
      "Unable to load your skill passport.",
    );
  }

  const skillIds = [
    ...new Set(
      (profiles ?? [])
        .map(
          (profile) =>
            profile.skill_id,
        )
        .filter(Boolean),
    ),
  ];

  let skills: Skill[] = [];

  if (skillIds.length > 0) {
    const { data, error: skillError } =
      await supabase
        .from("learning_skills")
        .select(
          "id, name, slug, category, description",
        )
        .in("id", skillIds)
        .order("name", {
          ascending: true,
        });

    if (skillError) {
      throw new Error(
        "Unable to load your skills.",
      );
    }

    skills =
      (data ?? []) as Skill[];
  }

  const skillMap = new Map(
    skills.map((skill) => [
      skill.id,
      skill,
    ]),
  );

  const skillProfiles =
    (profiles ?? []) as SkillProfile[];

  const passportSkills =
    skillProfiles
      .map((profile) => ({
        profile,
        skill: skillMap.get(
          profile.skill_id,
        ),
      }))
      .filter(
        (
          item,
        ): item is {
          profile: SkillProfile;
          skill: Skill;
        } => Boolean(item.skill),
      );

  const verifiedEvidenceCount =
    passportSkills.reduce(
      (total, item) =>
        total +
        (item.profile.evidence_count ??
          0),
      0,
    );

  const strongSkills =
    passportSkills.filter((item) => {
      const confidence =
        percentage(
          item.profile
            .confidence_score,
        );

      return (
        confidence !== null &&
        confidence >= 80
      );
    }).length;

  const averageConfidence =
    passportSkills.length > 0
      ? Math.round(
          passportSkills.reduce(
            (total, item) =>
              total +
              (percentage(
                item.profile
                  .confidence_score,
              ) ?? 0),
            0,
          ) / passportSkills.length,
        )
      : 0;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            RuffNeck Learn
          </p>

          <h1>
            Evidence-Based Skill Passport
          </h1>

          <p className="muted">
            A living record of the skills
            you have demonstrated through
            learning, assessment, and
            approved practical work.
          </p>
        </div>

        <div className="actions">
          <Link
            href="/student/practical-work"
            className="button secondary"
          >
            Practical Work
          </Link>

          <Link
            href="/student/certificates"
            className="button secondary"
          >
            Certificates
          </Link>
        </div>
      </div>

      <section
        className="card"
        style={{
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "1rem",
          }}
        >
          <div>
            <strong>
              Tracked skills
            </strong>

            <p
              style={{
                fontSize: "1.7rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {passportSkills.length}
            </p>
          </div>

          <div>
            <strong>
              Verified evidence
            </strong>

            <p
              style={{
                fontSize: "1.7rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {verifiedEvidenceCount}
            </p>
          </div>

          <div>
            <strong>
              Strong skills
            </strong>

            <p
              style={{
                fontSize: "1.7rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {strongSkills}
            </p>
          </div>

          <div>
            <strong>
              Average confidence
            </strong>

            <p
              style={{
                fontSize: "1.7rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {averageConfidence}%
            </p>
          </div>
        </div>
      </section>

      <section
        className="card"
        style={{
          marginBottom: "1.5rem",
        }}
      >
        <h2>
          What makes this a skill passport?
        </h2>

        <div
          style={{
            display: "grid",
            gap: "0.7rem",
          }}
        >
          <p>
            <strong>
              Learning
            </strong>{" "}
            — skills are connected to the
            learning completed on RuffNeck
            Learn.
          </p>

          <p>
            <strong>
              Assessment
            </strong>{" "}
            — assessment performance
            contributes to your learning
            profile.
          </p>

          <p>
            <strong>
              Practical evidence
            </strong>{" "}
            — approved workplace tasks
            provide evidence that you can
            actually apply the skill.
          </p>

          <p>
            <strong>
              Continuous development
            </strong>{" "}
            — confidence, strengths,
            evidence, and development gaps
            can change as you continue
            learning.
          </p>
        </div>
      </section>

      {passportSkills.length === 0 ? (
        <section className="card">
          <h2>
            Your skill passport is
            developing
          </h2>

          <p className="muted">
            Complete lessons and practical
            activities to begin building
            your evidence-based skill
            profile.
          </p>

          <div className="actions">
            <Link
              href="/student/courses"
              className="button primary"
            >
              Continue learning
            </Link>
          </div>
        </section>
      ) : (
        <section
          style={{
            display: "grid",
            gap: "1rem",
          }}
        >
          {passportSkills.map(
            ({
              skill,
              profile,
            }) => {
              const confidence =
                percentage(
                  profile.confidence_score,
                );

              const score =
                percentage(
                  profile.score,
                );

              return (
                <article
                  key={skill.id}
                  className="card"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "flex-start",
                      gap: "1rem",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <p className="eyebrow">
                        {skill.category ??
                          "Professional skill"}
                      </p>

                      <h2
                        style={{
                          marginBottom:
                            "0.35rem",
                        }}
                      >
                        {skill.name}
                      </h2>

                      {skill.description ? (
                        <p className="muted">
                          {skill.description}
                        </p>
                      ) : null}
                    </div>

                    <span className="rn-badge rn-badge-success">
                      {label(
                        profile.skill_level,
                      )}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "1rem",
                      marginTop:
                        "1.25rem",
                    }}
                  >
                    <div>
                      <strong>
                        Confidence
                      </strong>

                      <p
                        style={{
                          fontSize:
                            "1.3rem",
                          fontWeight: 800,
                        }}
                      >
                        {confidence ?? "—"}
                        {confidence !==
                        null
                          ? "%"
                          : ""}
                      </p>
                    </div>

                    <div>
                      <strong>
                        Skill score
                      </strong>

                      <p
                        style={{
                          fontSize:
                            "1.3rem",
                          fontWeight: 800,
                        }}
                      >
                        {score ?? "—"}
                        {score !== null
                          ? "%"
                          : ""}
                      </p>
                    </div>

                    <div>
                      <strong>
                        Evidence
                      </strong>

                      <p
                        style={{
                          fontSize:
                            "1.3rem",
                          fontWeight: 800,
                        }}
                      >
                        {profile.evidence_count ??
                          0}
                      </p>
                    </div>
                  </div>

                  {profile.evidence &&
                  profile.evidence.length >
                    0 ? (
                    <div
                      style={{
                        marginTop:
                          "1.25rem",
                      }}
                    >
                      <h3>
                        Evidence
                      </h3>

                      <ul>
                        {profile.evidence
                          .slice(-5)
                          .map(
                            (
                              evidence,
                              index,
                            ) => (
                              <li
                                key={`${skill.id}-evidence-${index}`}
                              >
                                {evidence}
                              </li>
                            ),
                          )}
                      </ul>
                    </div>
                  ) : null}

                  {profile.strengths &&
                  profile.strengths.length >
                    0 ? (
                    <div
                      style={{
                        marginTop:
                          "1rem",
                      }}
                    >
                      <h3>
                        Strengths
                      </h3>

                      <ul>
                        {profile.strengths
                          .slice(-5)
                          .map(
                            (
                              strength,
                              index,
                            ) => (
                              <li
                                key={`${skill.id}-strength-${index}`}
                              >
                                {strength}
                              </li>
                            ),
                          )}
                      </ul>
                    </div>
                  ) : null}

                  {profile.gaps &&
                  profile.gaps.length >
                    0 ? (
                    <div
                      style={{
                        marginTop:
                          "1rem",
                      }}
                    >
                      <h3>
                        Development areas
                      </h3>

                      <ul>
                        {profile.gaps
                          .slice(-5)
                          .map(
                            (
                              gap,
                              index,
                            ) => (
                              <li
                                key={`${skill.id}-gap-${index}`}
                              >
                                {gap}
                              </li>
                            ),
                          )}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            },
          )}
        </section>
      )}
    </main>
  );
}