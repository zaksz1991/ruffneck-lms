import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import VerificationQr from "./VerificationQr";
import PrintVerificationButton from "./PrintVerificationButton";

type PageProps = {
  params: Promise<{
    code: string;
  }>;
};

type Verification = {
  id: string;
  student_id: string;
  verification_code: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

type Profile = {
  full_name: string | null;
  display_name: string | null;
};

type Skill = {
  id: string;
  name: string;
  category: string | null;
};

type SkillProfile = {
  skill_id: string;
  skill_level: string | null;
  confidence_score: number | null;
};

type Certificate = {
  id: string;
  certificate_number: string | null;
  issued_at: string | null;
  course_id: string;
};

type Course = {
  id: string;
  title: string;
};

type PracticalSubmission = {
  id: string;
  task_id: string;
  score: number | null;
  reviewed_at: string | null;
};

type PracticalTask = {
  id: string;
  title: string;
  course_id: string;
  skill_id: string | null;
};

function levelLabel(value: string | null): string {
  if (!value?.trim()) {
    return "Developing";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatScore(
  value: number | null,
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "Not scored";
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function isExpired(
  expiresAt: string | null,
): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiryTime = new Date(
    expiresAt,
  ).getTime();

  return (
    !Number.isFinite(expiryTime) ||
    expiryTime <= Date.now()
  );
}

function showQueryError(
  context: string,
  error: { message: string; code?: string },
): never {
  console.error(
    `[Public Skill Passport] ${context}`,
    {
      message: error.message,
      code: error.code,
    },
  );

  throw new Error(
    `Unable to load public Skill Passport data: ${context}.`,
  );
}

export default async function PublicVerificationPage({
  params,
}: PageProps) {
  const { code } = await params;

  const normalizedCode = code
    .trim()
    .toUpperCase();

  if (!normalizedCode) {
    notFound();
  }

  const adminClient = createAdminClient();

  /*
   * 1. Find the public verification record.
   */
  const {
    data: verification,
    error: verificationError,
  } = await adminClient
    .from("skill_passport_verifications")
    .select(
      "id,student_id,verification_code,is_active,expires_at,created_at",
    )
    .eq(
      "verification_code",
      normalizedCode,
    )
    .maybeSingle();

  if (verificationError) {
    console.error(
      "[Public Skill Passport] Verification lookup failed",
      {
        message: verificationError.message,
        code: verificationError.code,
      },
    );

    throw new Error(
      "Unable to verify this Skill Passport.",
    );
  }

  if (!verification) {
    notFound();
  }

  const verificationRecord =
    verification as Verification;

  /*
   * 2. Never publish an inactive or expired passport.
   */
  if (
    !verificationRecord.is_active ||
    isExpired(verificationRecord.expires_at)
  ) {
    const expired = isExpired(
      verificationRecord.expires_at,
    );

    return (
      <main className="page-shell">
        <section
          className="card"
          style={{
            maxWidth: 760,
            margin: "3rem auto",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <p className="eyebrow">
            RUFFNECK LEARN
          </p>

          <h1>
            {expired
              ? "Verification Expired"
              : "Verification Unavailable"}
          </h1>

          <p className="muted">
            {expired
              ? "This Skill Passport verification link has expired and is no longer valid."
              : "This Skill Passport verification link has been disabled by the learner."}
          </p>

          <Link
            href="/"
            className="rn-button rn-button-primary"
            style={{
              display: "inline-flex",
              marginTop: "1rem",
              textDecoration: "none",
            }}
          >
            Visit RuffNeck Learn
          </Link>
        </section>
      </main>
    );
  }

  const studentId =
    verificationRecord.student_id;

  /*
   * 3. Fetch the learner profile, skill profiles,
   * certificates, and approved evidence records.
   *
   * Use student_id consistently with the student
   * dashboard and Skill Passport pages.
   *
   * Evidence is accepted only when its submission
   * is approved and evidence_recorded_at is not null.
   */
  const [
    profileResult,
    skillProfilesResult,
    certificatesResult,
    submissionsResult,
  ] = await Promise.all([
    adminClient
      .from("profiles")
      .select(
        "full_name,display_name",
      )
      .eq("id", studentId)
      .maybeSingle(),

    adminClient
      .from("learner_skill_profiles")
      .select(
        "skill_id,skill_level,confidence_score",
      )
      .eq("student_id", studentId)
      .order("confidence_score", {
        ascending: false,
        nullsFirst: false,
      }),

    adminClient
      .from("course_certificates")
      .select(
        "id,certificate_number,issued_at,course_id",
      )
      .eq("student_id", studentId)
      .order("issued_at", {
        ascending: false,
        nullsFirst: false,
      }),

    adminClient
      .from(
        "student_practical_task_submissions",
      )
      .select(
        "id,task_id,score,reviewed_at",
      )
      .eq("student_id", studentId)
      .eq("status", "approved")
      .not(
        "evidence_recorded_at",
        "is",
        null,
      )
      .order("reviewed_at", {
        ascending: false,
        nullsFirst: false,
      }),
  ]);

  if (profileResult.error) {
    showQueryError(
      "learner profile",
      profileResult.error,
    );
  }

  if (skillProfilesResult.error) {
    showQueryError(
      "learner skill profiles",
      skillProfilesResult.error,
    );
  }

  if (certificatesResult.error) {
    showQueryError(
      "certificates",
      certificatesResult.error,
    );
  }

  if (submissionsResult.error) {
    showQueryError(
      "practical evidence",
      submissionsResult.error,
    );
  }

  const profile =
    profileResult.data as Profile | null;

  const skillProfiles =
    (skillProfilesResult.data ??
      []) as SkillProfile[];

  const certificates =
    (certificatesResult.data ??
      []) as Certificate[];

  const submissions =
    (submissionsResult.data ??
      []) as PracticalSubmission[];

  /*
   * 4. Load practical tasks associated with
   * the learner's approved evidence records.
   */
  const taskIds = Array.from(
    new Set(
      submissions.map(
        (submission) => submission.task_id,
      ),
    ),
  );

  let tasks: PracticalTask[] = [];

  if (taskIds.length > 0) {
    const tasksResult = await adminClient
      .from("course_practical_tasks")
      .select(
        "id,title,course_id,skill_id",
      )
      .in("id", taskIds);

    if (tasksResult.error) {
      showQueryError(
        "practical task details",
        tasksResult.error,
      );
    }

    tasks = (tasksResult.data ??
      []) as PracticalTask[];
  }

  /*
   * 5. Gather skill and course IDs from BOTH
   * skill profiles and practical evidence.
   *
   * Including practical-task course IDs prevents
   * valid evidence from losing its course title
   * merely because that course has no certificate.
   */
  const skillIds = Array.from(
    new Set([
      ...skillProfiles.map(
        (item) => item.skill_id,
      ),
      ...tasks
        .map((task) => task.skill_id)
        .filter(
          (id): id is string => Boolean(id),
        ),
    ]),
  );

  const courseIds = Array.from(
    new Set([
      ...certificates.map(
        (certificate) => certificate.course_id,
      ),
      ...tasks.map(
        (task) => task.course_id,
      ),
    ]),
  );

  const [
    skillsResult,
    coursesResult,
  ] = await Promise.all([
    skillIds.length > 0
      ? adminClient
          .from("learning_skills")
          .select(
            "id,name,category",
          )
          .in("id", skillIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    courseIds.length > 0
      ? adminClient
          .from("courses")
          .select("id,title")
          .in("id", courseIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (skillsResult.error) {
    showQueryError(
      "skill details",
      skillsResult.error,
    );
  }

  if (coursesResult.error) {
    showQueryError(
      "course details",
      coursesResult.error,
    );
  }

  const skills =
    (skillsResult.data ?? []) as Skill[];

  const courses =
    (coursesResult.data ?? []) as Course[];

  const skillMap = new Map(
    skills.map((skill) => [
      skill.id,
      skill,
    ]),
  );

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ]),
  );

  const taskMap = new Map(
    tasks.map((task) => [
      task.id,
      task,
    ]),
  );

  const skillProfileMap = new Map(
    skillProfiles.map((item) => [
      item.skill_id,
      item,
    ]),
  );

  /*
   * 6. Count evidence for each skill from the
   * approved submissions linked to practical tasks.
   *
   * A skill is displayed as verified only when
   * at least one approved submission has recorded
   * evidence and its task links to that skill.
   */
  const evidenceCountBySkill =
    new Map<string, number>();

  for (const submission of submissions) {
    const task = taskMap.get(
      submission.task_id,
    );

    if (!task?.skill_id) {
      continue;
    }

    const skillId = task.skill_id;

    evidenceCountBySkill.set(
      skillId,
      (evidenceCountBySkill.get(skillId) ?? 0) + 1,
    );
  }

  const verifiedSkills = Array.from(
    evidenceCountBySkill.entries(),
  )
    .map(([skillId, evidenceCount]) => {
      const skill = skillMap.get(skillId);

      if (!skill) {
        return null;
      }

      return {
        skill,
        profile: skillProfileMap.get(skillId),
        evidenceCount,
      };
    })
    .filter(
      (
        item,
      ): item is NonNullable<typeof item> =>
        item !== null,
    )
    .sort((a, b) => {
      const scoreA =
        a.profile?.confidence_score ?? -1;

      const scoreB =
        b.profile?.confidence_score ?? -1;

      return (
        scoreB - scoreA ||
        a.skill.name.localeCompare(b.skill.name)
      );
    });

  const learnerName =
    profile?.display_name?.trim() ||
    profile?.full_name?.trim() ||
    "RuffNeck Learn learner";

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://ruffneck-lms.vercel.app"
  ).replace(/\/+$/, "");

  const verificationUrl =
    `${siteUrl}/verify/` +
    encodeURIComponent(
      verificationRecord.verification_code,
    );

  return (
    <main className="page-shell">
      <section
        className="card rn-verification-print-area"
        style={{
          maxWidth: 960,
          margin: "2rem auto",
          padding: "clamp(1rem, 4vw, 2.25rem)",
        }}
      >
        <div
          className="rn-verification-actions"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap",
            marginBottom: "1.5rem",
          }}
        >
          <PrintVerificationButton />

          <Link
            href="/"
            className="rn-button"
            style={{
              textDecoration: "none",
            }}
          >
            RuffNeck Learn
          </Link>
        </div>

        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="eyebrow">
              RUFFNECK LEARN
            </p>

            <h1
              style={{
                marginTop: "0.4rem",
              }}
            >
              Skill Passport Verification
            </h1>

            <p
              className="muted"
              style={{
                maxWidth: "38rem",
                lineHeight: 1.7,
              }}
            >
              Public verification of demonstrated
              learning and practical capability.
            </p>
          </div>

          <span className="rn-badge rn-badge-success">
            Verified
          </span>
        </header>

        <section
          style={{
            marginTop: "2rem",
            paddingBottom: "1.5rem",
            borderBottom:
              "1px solid var(--border, #e2e8f0)",
          }}
        >
          <p className="eyebrow">
            LEARNER
          </p>

          <h2>{learnerName}</h2>

          <p className="muted">
            Verification code:{" "}
            <strong>
              {verificationRecord.verification_code}
            </strong>
          </p>

          <p className="muted">
            Verification issued:{" "}
            {formatDate(
              verificationRecord.created_at,
            )}
          </p>

          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              justifyContent: "flex-start",
            }}
          >
            <VerificationQr
              value={verificationUrl}
            />
          </div>
        </section>

        <section
          style={{
            marginTop: "2rem",
          }}
        >
          <p className="eyebrow">
            DEMONSTRATED SKILLS
          </p>

          <h2>
            Verified capabilities
          </h2>

          <p
            className="muted"
            style={{
              lineHeight: 1.7,
            }}
          >
            Skills in this section are linked to
            approved practical submissions for which
            evidence has been recorded.
          </p>

          {verifiedSkills.length === 0 ? (
            <div
              className="card"
              style={{
                margin: "1rem 0 0",
              }}
            >
              <h3>
                No verified skills available yet
              </h3>

              <p className="muted">
                No approved practical submissions
                with recorded evidence are currently
                linked to a recognised skill.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              {verifiedSkills.map(
                ({
                  skill,
                  profile: skillProfile,
                  evidenceCount,
                }) => (
                  <article
                    key={skill.id}
                    className="card"
                    style={{
                      margin: 0,
                      minWidth: 0,
                      overflowWrap: "anywhere",
                    }}
                  >
                    <p className="eyebrow">
                      {skill.category ||
                        "Professional Skill"}
                    </p>

                    <h3>{skill.name}</h3>

                    <p>
                      Level:{" "}
                      <strong>
                        {levelLabel(
                          skillProfile?.skill_level ??
                            null,
                        )}
                      </strong>
                    </p>

                    <p>
                      Confidence:{" "}
                      <strong>
                        {skillProfile?.confidence_score ??
                        skillProfile?.confidence_score === 0
                          ? `${skillProfile.confidence_score}%`
                          : "Not assessed"}
                      </strong>
                    </p>

                    <p>
                      Recorded evidence:{" "}
                      <strong>
                        {evidenceCount}
                      </strong>
                    </p>

                    <span className="rn-badge rn-badge-success">
                      Evidence-backed
                    </span>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <section
          style={{
            marginTop: "2.5rem",
          }}
        >
          <p className="eyebrow">
            PRACTICAL EVIDENCE
          </p>

          <h2>
            Demonstrated through practical work
          </h2>

          {submissions.length === 0 ? (
            <div
              className="card"
              style={{
                margin: "1rem 0 0",
              }}
            >
              <p className="muted">
                No approved practical evidence has
                been recorded for public verification.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                marginTop: "1rem",
              }}
            >
              {submissions.map(
                (submission) => {
                  const task = taskMap.get(
                    submission.task_id,
                  );

                  const course = task
                    ? courseMap.get(
                        task.course_id,
                      )
                    : undefined;

                  const skill =
                    task?.skill_id
                      ? skillMap.get(
                          task.skill_id,
                        )
                      : undefined;

                  return (
                    <article
                      key={submission.id}
                      className="card"
                      style={{
                        margin: 0,
                        minWidth: 0,
                        overflowWrap: "anywhere",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            flex: "1 1 15rem",
                            minWidth: 0,
                          }}
                        >
                          <h3
                            style={{
                              marginTop: 0,
                            }}
                          >
                            {task?.title ||
                              "Practical task"}
                          </h3>

                          <p className="muted">
                            {course?.title ||
                              "Course details unavailable"}
                          </p>

                          {skill && (
                            <p className="muted">
                              Skill: {skill.name}
                            </p>
                          )}

                          <p className="muted">
                            Reviewed:{" "}
                            {formatDate(
                              submission.reviewed_at,
                            )}
                          </p>
                        </div>

                        <div
                          style={{
                            textAlign: "right",
                          }}
                        >
                          <span className="rn-badge rn-badge-success">
                            Approved
                          </span>

                          <p
                            style={{
                              marginBottom: 0,
                              marginTop: "0.65rem",
                            }}
                          >
                            Score:{" "}
                            <strong>
                              {formatScore(
                                submission.score,
                              )}
                            </strong>
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}
        </section>

        <section
          style={{
            marginTop: "2.5rem",
          }}
        >
          <p className="eyebrow">
            CERTIFICATIONS
          </p>

          <h2>
            RuffNeck Learn certificates
          </h2>

          {certificates.length === 0 ? (
            <p className="muted">
              No certificates have been issued
              through this Skill Passport yet.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                marginTop: "1rem",
              }}
            >
              {certificates.map(
                (certificate) => {
                  const course = courseMap.get(
                    certificate.course_id,
                  );

                  return (
                    <article
                      key={certificate.id}
                      className="card"
                      style={{
                        margin: 0,
                        overflowWrap: "anywhere",
                      }}
                    >
                      <h3>
                        {course?.title ||
                          "RuffNeck Learn Course"}
                      </h3>

                      <p className="muted">
                        Certificate:{" "}
                        {certificate.certificate_number ||
                          "Issued certificate"}
                      </p>

                      <p className="muted">
                        Issued:{" "}
                        {formatDate(
                          certificate.issued_at,
                        )}
                      </p>
                    </article>
                  );
                },
              )}
            </div>
          )}
        </section>

        <footer
          style={{
            marginTop: "2.5rem",
            paddingTop: "1.5rem",
            borderTop:
              "1px solid var(--border, #e2e8f0)",
          }}
        >
          <p
            className="muted"
            style={{
              margin: 0,
              lineHeight: 1.7,
              fontSize: "0.9rem",
            }}
          >
            This page displays selected public
            learning records and evidence-backed
            skills. Private account information,
            payment records, and private submission
            contents are not displayed.
          </p>
        </footer>
      </section>
    </main>
  );
}