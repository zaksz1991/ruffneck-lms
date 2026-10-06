import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EvidenceTimeline from "./EvidenceTimeline";

type Skill = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};

type SkillProfile = {
  id: string;
  skill_id: string;
  skill_level: string | null;
  confidence_score: number | null;
  mastery_score: number | null;
  evidence_count: number | null;
  strengths: string[] | null;
  gaps: string[] | null;
  evidence: string[] | null;
};

type PracticalSubmission = {
  id: string;
  task_id: string;
  score: number | null;
  reviewed_at: string | null;
  evidence_file_name: string | null;
  evidence_recorded_at: string | null;
};

type PracticalTask = {
  id: string;
  title: string;
  course_id: string;
  skill_id: string | null;
};

type Course = {
  id: string;
  title: string;
};

type EvidenceItem = {
  id: string;
  skillName: string;
  taskTitle: string;
  courseTitle: string;
  score: number | null;
  reviewedAt: string | null;
  evidenceFileName: string | null;
};

function scoreLabel(value: number | null) {
  if (value === null) {
    return "Not assessed";
  }

  return `${Math.round(value)}%`;
}

function levelLabel(value: string | null) {
  if (!value) {
    return "Developing";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function SkillPassportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/skill-passport");
  }

  const [
    skillsResult,
    profilesResult,
    submissionsResult,
  ] = await Promise.all([
    supabase
      .from("learning_skills")
      .select(
        "id,name,category,description",
      )
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("learner_skill_profiles")
      .select(
        "id,skill_id,skill_level,confidence_score,mastery_score,evidence_count,strengths,gaps,evidence",
      )
      .eq("learner_id", user.id)
      .order("confidence_score", {
        ascending: false,
        nullsFirst: false,
      }),

    supabase
      .from(
        "student_practical_task_submissions",
      )
      .select(
        "id,task_id,score,reviewed_at,evidence_file_name,evidence_recorded_at",
      )
      .eq("student_id", user.id)
      .eq("status", "approved")
      .not(
        "evidence_recorded_at",
        "is",
        null,
      )
      .order("reviewed_at", {
        ascending: false,
      }),
  ]);

  const skills = (skillsResult.data ??
    []) as Skill[];

  const profiles = (profilesResult.data ??
    []) as SkillProfile[];

  const submissions =
    (submissionsResult.data ??
      []) as PracticalSubmission[];

  const skillMap = new Map(
    skills.map((skill) => [
      skill.id,
      skill,
    ]),
  );

  const profileRows = profiles.filter(
    (profile) =>
      skillMap.has(profile.skill_id),
  );

  const taskIds = Array.from(
    new Set(
      submissions.map(
        (submission) =>
          submission.task_id,
      ),
    ),
  );

  let tasks: PracticalTask[] = [];

  if (taskIds.length > 0) {
    const { data } = await supabase
      .from("course_practical_tasks")
      .select(
        "id,title,course_id,skill_id",
      )
      .in("id", taskIds);

    tasks = (data ?? []) as PracticalTask[];
  }

  const courseIds = Array.from(
    new Set(
      tasks.map(
        (task) => task.course_id,
      ),
    ),
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data } = await supabase
      .from("courses")
      .select("id,title")
      .in("id", courseIds);

    courses = (data ?? []) as Course[];
  }

  const taskMap = new Map(
    tasks.map((task) => [
      task.id,
      task,
    ]),
  );

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ]),
  );

  const evidenceItems: EvidenceItem[] =
    submissions
      .map((submission) => {
        const task = taskMap.get(
          submission.task_id,
        );

        if (!task?.skill_id) {
          return null;
        }

        const skill = skillMap.get(
          task.skill_id,
        );

        const course = courseMap.get(
          task.course_id,
        );

        if (!skill || !course) {
          return null;
        }

        return {
          id: submission.id,
          skillName: skill.name,
          taskTitle: task.title,
          courseTitle: course.title,
          score: submission.score,
          reviewedAt:
            submission.reviewed_at,
          evidenceFileName:
            submission.evidence_file_name,
        };
      })
      .filter(
        (
          item,
        ): item is EvidenceItem =>
          item !== null,
      );

  const verifiedEvidenceCount =
    evidenceItems.length;

  const strongSkills =
    profileRows.filter(
      (profile) =>
        (profile.confidence_score ?? 0) >=
        80,
    ).length;

  const averageConfidence =
    profileRows.length > 0
      ? Math.round(
          profileRows.reduce(
            (total, profile) =>
              total +
              (profile.confidence_score ??
                0),
            0,
          ) / profileRows.length,
        )
      : 0;

  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">
            RUFFNECK LEARN
          </p>

          <h1>
            Evidence-Based Skill Passport
          </h1>

          <p className="muted">
            A living record of the skills you
            have developed, demonstrated, and
            verified through practical work.
          </p>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div className="card">
          <strong>Tracked skills</strong>
          <h2>{profileRows.length}</h2>
          <p className="muted">
            Skills currently recorded in your
            learning profile.
          </p>
        </div>

        <div className="card">
          <strong>Verified evidence</strong>
          <h2>{verifiedEvidenceCount}</h2>
          <p className="muted">
            Approved practical submissions
            linked to skills.
          </p>
        </div>

        <div className="card">
          <strong>Strong skills</strong>
          <h2>{strongSkills}</h2>
          <p className="muted">
            Skills with confidence of 80% or
            higher.
          </p>
        </div>

        <div className="card">
          <strong>Average confidence</strong>
          <h2>{averageConfidence}%</h2>
          <p className="muted">
            Current learning intelligence
            confidence across tracked skills.
          </p>
        </div>
      </section>

      <section
        className="card"
        style={{
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="eyebrow">
              VERIFIED PRACTICAL EVIDENCE
            </p>

            <h2>
              Evidence Timeline
            </h2>

            <p className="muted">
              Approved practical tasks become
              permanent evidence of demonstrated
              capability.
            </p>
          </div>

          <Link
            href="/student/practical-work"
            className="rn-button rn-button-primary"
          >
            Open Practical Work
          </Link>
        </div>

        <div
          style={{
            marginTop: "1.5rem",
          }}
        >
          <EvidenceTimeline
            items={evidenceItems}
          />
        </div>
      </section>

      <section>
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "flex-end",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <div>
            <p className="eyebrow">
              SKILL PROFILE
            </p>

            <h2>
              Demonstrated capabilities
            </h2>
          </div>

          <Link
            href="/student/certificates"
            className="rn-button"
          >
            View Certificates
          </Link>
        </div>

        {profileRows.length === 0 ? (
          <div className="card">
            <h3>
              No skill evidence yet
            </h3>

            <p className="muted">
              Complete lessons, assessments,
              and Practical Work tasks to begin
              building your Skill Passport.
            </p>

            <Link
              href="/student/practical-work"
              className="rn-button rn-button-primary"
              style={{
                marginTop: "1rem",
              }}
            >
              Start Practical Work
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {profileRows.map(
              (profile) => {
                const skill =
                  skillMap.get(
                    profile.skill_id,
                  );

                if (!skill) {
                  return null;
                }

                return (
                  <article
                    key={profile.id}
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
                      }}
                    >
                      <div>
                        <p className="eyebrow">
                          {skill.category ??
                            "Professional Skill"}
                        </p>

                        <h3>
                          {skill.name}
                        </h3>
                      </div>

                      <span className="rn-badge rn-badge-success">
                        {levelLabel(
                          profile.skill_level,
                        )}
                      </span>
                    </div>

                    {skill.description && (
                      <p className="muted">
                        {skill.description}
                      </p>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(2, 1fr)",
                        gap: "1rem",
                        marginTop:
                          "1rem",
                      }}
                    >
                      <div>
                        <strong>
                          Confidence
                        </strong>

                        <p>
                          {scoreLabel(
                            profile.confidence_score,
                          )}
                        </p>
                      </div>

                      <div>
                        <strong>
                          Mastery
                        </strong>

                        <p>
                          {scoreLabel(
                            profile.mastery_score,
                          )}
                        </p>
                      </div>

                      <div>
                        <strong>
                          Evidence
                        </strong>

                        <p>
                          {profile.evidence_count ??
                            0}
                        </p>
                      </div>

                      <div>
                        <strong>
                          Level
                        </strong>

                        <p>
                          {levelLabel(
                            profile.skill_level,
                          )}
                        </p>
                      </div>
                    </div>

                    {profile.strengths &&
                      profile.strengths
                        .length > 0 && (
                        <div
                          style={{
                            marginTop:
                              "1rem",
                          }}
                        >
                          <strong>
                            Strengths
                          </strong>

                          <ul>
                            {profile.strengths.map(
                              (
                                strength,
                                index,
                              ) => (
                                <li
                                  key={`${profile.id}-strength-${index}`}
                                >
                                  {strength}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                    {profile.gaps &&
                      profile.gaps
                        .length > 0 && (
                        <div
                          style={{
                            marginTop:
                              "1rem",
                          }}
                        >
                          <strong>
                            Development areas
                          </strong>

                          <ul>
                            {profile.gaps.map(
                              (
                                gap,
                                index,
                              ) => (
                                <li
                                  key={`${profile.id}-gap-${index}`}
                                >
                                  {gap}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                    {profile.evidence &&
                      profile.evidence
                        .length > 0 && (
                        <div
                          style={{
                            marginTop:
                              "1rem",
                          }}
                        >
                          <strong>
                            Evidence record
                          </strong>

                          <ul>
                            {profile.evidence
                              .slice(0, 5)
                              .map(
                                (
                                  evidence,
                                  index,
                                ) => (
                                  <li
                                    key={`${profile.id}-evidence-${index}`}
                                  >
                                    {evidence}
                                  </li>
                                ),
                              )}
                          </ul>
                        </div>
                      )}
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </main>
  );
}