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
  evidence_count: number | null;
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

function levelLabel(value: string | null) {
  if (!value) {
    return "Developing";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(value));
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

  if (verificationError || !verification) {
    notFound();
  }

  if (!verification.is_active) {
    return (
      <main className="page-shell">
        <section
          className="card"
          style={{
            maxWidth: 760,
            margin: "3rem auto",
            textAlign: "center",
          }}
        >
          <p className="eyebrow">
            RUFFNECK LEARN
          </p>

          <h1>
            Verification Unavailable
          </h1>

          <p className="muted">
            This Skill Passport verification
            link has been disabled by the
            learner.
          </p>

          <Link
            href="/"
            className="rn-button rn-button-primary"
            style={{
              marginTop: "1rem",
            }}
          >
            Visit RuffNeck Learn
          </Link>
        </section>
      </main>
    );
  }

  if (
    verification.expires_at &&
    new Date(
      verification.expires_at,
    ).getTime() < Date.now()
  ) {
    return (
      <main className="page-shell">
        <section
          className="card"
          style={{
            maxWidth: 760,
            margin: "3rem auto",
            textAlign: "center",
          }}
        >
          <p className="eyebrow">
            RUFFNECK LEARN
          </p>

          <h1>
            Verification Expired
          </h1>

          <p className="muted">
            This Skill Passport verification
            link is no longer valid.
          </p>
        </section>
      </main>
    );
  }

  const studentId =
    verification.student_id;

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
        "skill_id,skill_level,confidence_score,evidence_count",
      )
      .eq("learner_id", studentId)
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
      }),
  ]);

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

  const skillIds = Array.from(
    new Set(
      skillProfiles.map(
        (item) => item.skill_id,
      ),
    ),
  );

  const courseIds = Array.from(
    new Set(
      certificates.map(
        (item) => item.course_id,
      ),
    ),
  );

  const taskIds = Array.from(
    new Set(
      submissions.map(
        (item) => item.task_id,
      ),
    ),
  );

  const [
    skillsResult,
    coursesResult,
    tasksResult,
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
        }),

    courseIds.length > 0
      ? adminClient
          .from("courses")
          .select("id,title")
          .in("id", courseIds)
      : Promise.resolve({
          data: [],
        }),

    taskIds.length > 0
      ? adminClient
          .from(
            "course_practical_tasks",
          )
          .select(
            "id,title,course_id,skill_id",
          )
          .in("id", taskIds)
      : Promise.resolve({
          data: [],
        }),
  ]);

  const skills =
    (skillsResult.data ??
      []) as Skill[];

  const courses =
    (coursesResult.data ??
      []) as Course[];

  const tasks =
    (tasksResult.data ??
      []) as PracticalTask[];

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

  const learnerName =
    profile?.display_name ||
    profile?.full_name ||
    "RuffNeck Learn learner";

  const verifiedSkills =
    skillProfiles.filter((item) =>
      skillMap.has(item.skill_id),
    );

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://ruffneck-lms.vercel.app";

  const verificationUrl =
    `${siteUrl.replace(/\/$/, "")}/verify/` +
    verification.verification_code;

  return (
    <main className="page-shell">
      <section
        className="card rn-verification-print-area"
        style={{
          maxWidth: 960,
          margin: "2rem auto",
        }}
      >
        <div
          className="rn-verification-actions"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <PrintVerificationButton />

          <Link
            href="/"
            className="rn-button"
          >
            RuffNeck Learn
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="eyebrow">
              RUFFNECK LEARN
            </p>

            <h1>
              Skill Passport Verification
            </h1>

            <p className="muted">
              Public verification of demonstrated
              learning and practical capability.
            </p>
          </div>

          <span className="rn-badge rn-badge-success">
            Verified
          </span>
        </div>

        <div
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

          <h2>
            {learnerName}
          </h2>

          <p className="muted">
            Verification code:{" "}
            <strong>
              {verification.verification_code}
            </strong>
          </p>

          <p className="muted">
            Verification issued:{" "}
            {formatDate(
              verification.created_at,
            )}
          </p>

          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              justifyContent:
                "flex-start",
            }}
          >
            <VerificationQr
              value={verificationUrl}
            />
          </div>
        </div>

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

          {verifiedSkills.length === 0 ? (
            <div className="card">
              <p className="muted">
                No verified skill evidence is
                currently available.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              {verifiedSkills.map(
                (skillProfile) => {
                  const skill =
                    skillMap.get(
                      skillProfile.skill_id,
                    );

                  if (!skill) {
                    return null;
                  }

                  return (
                    <article
                      key={
                        skillProfile.skill_id
                      }
                      className="card"
                      style={{
                        margin: 0,
                      }}
                    >
                      <p className="eyebrow">
                        {skill.category ??
                          "Professional Skill"}
                      </p>

                      <h3>
                        {skill.name}
                      </h3>

                      <p>
                        Level:{" "}
                        <strong>
                          {levelLabel(
                            skillProfile.skill_level,
                          )}
                        </strong>
                      </p>

                      <p>
                        Confidence:{" "}
                        <strong>
                          {skillProfile.confidence_score ??
                            0}
                          %
                        </strong>
                      </p>

                      <p>
                        Verified evidence:{" "}
                        <strong>
                          {skillProfile.evidence_count ??
                            0}
                        </strong>
                      </p>
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
            PRACTICAL EVIDENCE
          </p>

          <h2>
            Demonstrated through practical work
          </h2>

          {submissions.length === 0 ? (
            <p className="muted">
              No public practical evidence is
              currently available.
            </p>
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
                  const task =
                    taskMap.get(
                      submission.task_id,
                    );

                  if (!task) {
                    return null;
                  }

                  const course =
                    courseMap.get(
                      task.course_id,
                    );

                  const skill =
                    task.skill_id
                      ? skillMap.get(
                          task.skill_id,
                        )
                      : null;

                  return (
                    <article
                      key={submission.id}
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
                          gap: "1rem",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <div>
                          <strong>
                            {task.title}
                          </strong>

                          <p className="muted">
                            {course?.title ??
                              "RuffNeck Learn"}
                          </p>

                          {skill && (
                            <p className="muted">
                              Skill:{" "}
                              {skill.name}
                            </p>
                          )}
                        </div>

                        <div>
                          <span className="rn-badge rn-badge-success">
                            Approved
                          </span>

                          {submission.score !==
                            null && (
                            <p
                              style={{
                                marginTop:
                                  "0.5rem",
                                textAlign:
                                  "right",
                              }}
                            >
                              Score:{" "}
                              <strong>
                                {
                                  submission.score
                                }
                                %
                              </strong>
                            </p>
                          )}
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
                  const course =
                    courseMap.get(
                      certificate.course_id,
                    );

                  return (
                    <article
                      key={certificate.id}
                      className="card"
                      style={{
                        margin: 0,
                      }}
                    >
                      <strong>
                        {course?.title ??
                          "RuffNeck Learn Course"}
                      </strong>

                      <p className="muted">
                        Certificate:{" "}
                        {certificate.certificate_number ??
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

        <div
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
              marginBottom: 0,
            }}
          >
            This verification page displays
            selected public learning evidence only.
            Private account information, payment
            records, and private learner submissions
            are not disclosed.
          </p>
        </div>
      </section>
    </main>
  );
}