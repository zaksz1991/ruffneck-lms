import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticalWorkClient from "./PracticalWorkClient";

type Course = {
  id: string;
  title: string;
  slug: string;
};

type Task = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string;
  submission_type:
    | "text"
    | "document"
    | "spreadsheet"
    | "presentation"
    | "mixed";
  max_score: number;
  sort_order: number;
  is_published: boolean;
  skill_id: string | null;
};

type Submission = {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string | null;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  evidence_file_path: string | null;
  evidence_file_name: string | null;
  evidence_file_type: string | null;
  evidence_file_size: number | null;
  evidence_recorded_at: string | null;
  evidence_file_url?: string | null;
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

type LearningSkill = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
};

async function getPageData() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/practical-work",
    );
  }

  const {
    data: enrollments,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(
      "course_id, enrollment_status",
    )
    .eq("student_id", user.id)
    .in("enrollment_status", [
      "active",
      "completed",
    ]);

  if (enrollmentError) {
    throw new Error(
      "Unable to load your course access.",
    );
  }

  const courseIds = [
    ...new Set(
      (enrollments ?? []).map(
        (enrollment) =>
          enrollment.course_id,
      ),
    ),
  ];

  if (courseIds.length === 0) {
    return {
      courses: [] as Course[],
      tasks: [] as Task[],
      submissions: [] as Submission[],
      skills: [] as LearningSkill[],
      skillProfiles: [] as SkillProfile[],
    };
  }

  const [
    coursesResult,
    tasksResult,
    submissionsResult,
    skillProfilesResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, title, slug",
      )
      .in("id", courseIds)
      .eq("status", "published")
      .order("title", {
        ascending: true,
      }),

    supabase
      .from("course_practical_tasks")
      .select(
        `
          id,
          course_id,
          title,
          scenario,
          instructions,
          expected_outcome,
          submission_type,
          max_score,
          sort_order,
          is_published,
          skill_id
        `,
      )
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from(
        "student_practical_task_submissions",
      )
      .select(
        `
          id,
          task_id,
          student_id,
          submission_text,
          status,
          score,
          reviewer_feedback,
          submitted_at,
          reviewed_at,
          evidence_file_path,
          evidence_file_name,
          evidence_file_type,
          evidence_file_size,
          evidence_recorded_at
        `,
      )
      .eq(
        "student_id",
        user.id,
      ),

    supabase
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
      .eq(
        "student_id",
        user.id,
      ),
  ]);

  if (coursesResult.error) {
    throw new Error(
      "Unable to load your courses.",
    );
  }

  if (tasksResult.error) {
    throw new Error(
      "Unable to load practical tasks.",
    );
  }

  if (submissionsResult.error) {
    throw new Error(
      "Unable to load your practical submissions.",
    );
  }

  if (skillProfilesResult.error) {
    throw new Error(
      "Unable to load your learning intelligence.",
    );
  }

  const tasks =
    (tasksResult.data ??
      []) as unknown as Task[];

  const skillIds = [
    ...new Set(
      tasks
        .map(
          (task) => task.skill_id,
        )
        .filter(
          (
            skillId,
          ): skillId is string =>
            Boolean(skillId),
        ),
    ),
  ];

  let skills: LearningSkill[] =
    [];

  if (skillIds.length > 0) {
    const {
      data: skillRows,
      error: skillsError,
    } = await supabase
      .from("learning_skills")
      .select(
        "id, name, slug, category, description",
      )
      .in("id", skillIds)
      .order("name", {
        ascending: true,
      });

    if (skillsError) {
      throw new Error(
        "Unable to load learning skills.",
      );
    }

    skills =
      (skillRows ??
        []) as LearningSkill[];
  }

  return {
    courses:
      (coursesResult.data ??
        []) as Course[],

    tasks,

    submissions:
      (submissionsResult.data ??
        []) as unknown as Submission[],

    skills,

    skillProfiles:
      (skillProfilesResult.data ??
        []) as unknown as SkillProfile[],
  };
}

function formatSkillLevel(
  value: string | null,
) {
  if (!value) {
    return "Developing";
  }

  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatConfidence(
  value: number | null,
) {
  if (value === null) {
    return "—";
  }

  const normalized =
    value <= 1
      ? value * 100
      : value;

  return `${Math.round(
    normalized,
  )}%`;
}

export default async function PracticalWorkPage() {
  const {
    courses,
    tasks,
    submissions,
    skills,
    skillProfiles,
  } = await getPageData();

  const submissionMap =
    new Map<string, Submission>();

  for (const submission of submissions) {
    submissionMap.set(
      submission.task_id,
      submission,
    );
  }

  const enrichedTasks =
    tasks.map((task) => ({
      ...task,
      submission:
        submissionMap.get(
          task.id,
        ) ?? null,
    }));

  const groupedTasks =
    courses
      .map((course) => ({
        course,
        tasks:
          enrichedTasks.filter(
            (task) =>
              task.course_id ===
              course.id,
          ),
      }))
      .filter(
        (group) =>
          group.tasks.length > 0,
      );

  const totalTasks =
    enrichedTasks.length;

  const submittedTasks =
    enrichedTasks.filter(
      (task) =>
        task.submission?.status ===
          "submitted" ||
        task.submission?.status ===
          "under_review" ||
        task.submission?.status ===
          "approved" ||
        task.submission?.status ===
          "revision_required",
    ).length;

  const approvedTasks =
    enrichedTasks.filter(
      (task) =>
        task.submission?.status ===
        "approved",
    ).length;

  const revisionTasks =
    enrichedTasks.filter(
      (task) =>
        task.submission?.status ===
        "revision_required",
    ).length;

  const skillMap =
    new Map(
      skills.map((skill) => [
        skill.id,
        skill,
      ]),
    );

  const profileMap =
    new Map(
      skillProfiles.map((profile) => [
        profile.skill_id,
        profile,
      ]),
    );

  const verifiedSkillIds = [
    ...new Set(
      enrichedTasks
        .filter(
          (task) =>
            task.submission
              ?.status === "approved" &&
            task.submission
              ?.evidence_recorded_at &&
            task.skill_id,
        )
        .map(
          (task) =>
            task.skill_id as string,
        ),
    ),
  ];

  const verifiedSkills =
    verifiedSkillIds
      .map((skillId) => {
        const skill =
          skillMap.get(skillId);

        const profile =
          profileMap.get(skillId);

        if (!skill || !profile) {
          return null;
        }

        return {
          skill,
          profile,
        };
      })
      .filter(
        (
          item,
        ): item is {
          skill: LearningSkill;
          profile: SkillProfile;
        } => Boolean(item),
      );

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Practical Workbench
          </p>

          <h1>
            Do the work. Submit evidence.
            Build verified skills.
          </h1>

          <p className="muted">
            Complete realistic workplace
            tasks, submit the work you
            actually produced, receive
            reviewer feedback, and turn
            approved practical performance
            into verified skill evidence.
          </p>
        </div>

        <div className="actions">
          <Link
            href="/student/courses"
            className="button secondary"
          >
            My learning
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
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
          }}
        >
          <div>
            <strong>
              Available tasks
            </strong>

            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {totalTasks}
            </p>
          </div>

          <div>
            <strong>
              Submitted
            </strong>

            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {submittedTasks}
            </p>
          </div>

          <div>
            <strong>
              Approved
            </strong>

            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {approvedTasks}
            </p>
          </div>

          <div>
            <strong>
              Revision required
            </strong>

            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {revisionTasks}
            </p>
          </div>
        </div>
      </section>

      {verifiedSkills.length > 0 ? (
        <section
          className="card"
          style={{
            marginBottom: "1.5rem",
          }}
        >
          <div className="page-header">
            <div>
              <p className="eyebrow">
                Learning Intelligence
              </p>

              <h2>
                Verified Skills from Practical Work
              </h2>

              <p className="muted">
                These skills have practical
                evidence approved by an
                authorized reviewer.
              </p>
            </div>

            <Link
              href="/student/assessment/results"
              className="button secondary"
            >
              View assessment results
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            {verifiedSkills.map(
              ({
                skill,
                profile,
              }) => (
                <article
                  key={skill.id}
                  className="card"
                  style={{
                    margin: 0,
                  }}
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
                      <h3
                        style={{
                          margin:
                            "0 0 0.35rem",
                        }}
                      >
                        {skill.name}
                      </h3>

                      {skill.category ? (
                        <p className="muted">
                          {skill.category}
                        </p>
                      ) : null}
                    </div>

                    <span
                      className="rn-badge rn-badge-success"
                    >
                      Verified practical evidence
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "1rem",
                      marginTop:
                        "1rem",
                    }}
                  >
                    <div>
                      <strong>
                        Skill level
                      </strong>

                      <p>
                        {formatSkillLevel(
                          profile.skill_level,
                        )}
                      </p>
                    </div>

                    <div>
                      <strong>
                        Confidence
                      </strong>

                      <p>
                        {formatConfidence(
                          profile.confidence_score,
                        )}
                      </p>
                    </div>

                    <div>
                      <strong>
                        Evidence count
                      </strong>

                      <p>
                        {profile.evidence_count ??
                          0}
                      </p>
                    </div>

                    <div>
                      <strong>
                        Skill score
                      </strong>

                      <p>
                        {profile.score ??
                          "—"}
                      </p>
                    </div>
                  </div>

                  {profile.evidence &&
                  profile.evidence.length > 0 ? (
                    <div
                      style={{
                        marginTop:
                          "1rem",
                      }}
                    >
                      <strong>
                        Evidence
                      </strong>

                      <ul>
                        {profile.evidence
                          .slice(-3)
                          .map(
                            (
                              item,
                              index,
                            ) => (
                              <li
                                key={`${skill.id}-evidence-${index}`}
                              >
                                {item}
                              </li>
                            ),
                          )}
                      </ul>
                    </div>
                  ) : null}

                  {profile.strengths &&
                  profile.strengths
                    .length > 0 ? (
                    <div
                      style={{
                        marginTop:
                          "0.75rem",
                      }}
                    >
                      <strong>
                        Strengths
                      </strong>

                      <ul>
                        {profile.strengths
                          .slice(-3)
                          .map(
                            (
                              item,
                              index,
                            ) => (
                              <li
                                key={`${skill.id}-strength-${index}`}
                              >
                                {item}
                              </li>
                            ),
                          )}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </div>
        </section>
      ) : null}

      <section
        className="card"
        style={{
          marginBottom: "1.5rem",
        }}
      >
        <h2>
          How the Workbench works
        </h2>

        <div
          style={{
            display: "grid",
            gap: "0.75rem",
          }}
        >
          <p>
            <strong>1. Learn</strong> —
            study the relevant lesson and
            understand the expected skill.
          </p>

          <p>
            <strong>2. Practice</strong> —
            complete a realistic workplace
            task.
          </p>

          <p>
            <strong>3. Submit</strong> —
            provide your explanation and,
            where appropriate, the actual
            document, spreadsheet,
            presentation, image, or other
            evidence you created.
          </p>

          <p>
            <strong>4. Review</strong> —
            an authorized instructor or
            administrator evaluates your
            work.
          </p>

          <p>
            <strong>5. Improve</strong> —
            if revision is required, use
            the feedback and resubmit.
          </p>

          <p>
            <strong>6. Verify</strong> —
            approved practical performance
            contributes evidence to your
            Learning Intelligence profile.
          </p>
        </div>
      </section>

      {groupedTasks.length === 0 ? (
        <div className="card">
          <h2>
            No practical work available
          </h2>

          <p className="muted">
            Practical tasks will appear
            here when they are published
            for your enrolled courses.
          </p>
        </div>
      ) : (
        <div
          className="stack"
          style={{
            gap: "2rem",
          }}
        >
          {groupedTasks.map(
            ({
              course,
              tasks: courseTasks,
            }) => (
              <section
                key={course.id}
              >
                <div className="page-header">
                  <div>
                    <p className="eyebrow">
                      Practical tasks
                    </p>

                    <h2>
                      {course.title}
                    </h2>
                  </div>

                  <Link
                    href={`/courses/${course.slug}`}
                    className="button secondary"
                  >
                    View course
                  </Link>
                </div>

                <PracticalWorkClient
                  tasks={courseTasks}
                />
              </section>
            ),
          )}
        </div>
      )}
    </main>
  );
}