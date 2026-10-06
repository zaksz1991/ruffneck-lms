import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import VerificationQr from "../../VerificationQr";
import PrintVerificationButton from "../../PrintVerificationButton";

type PageProps = {
  params: Promise<{
    code: string;
  }>;
};

type VerificationRecord = {
  id: string;
  certificate_id: string;
  verification_code: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

type CertificateRecord = {
  id: string;
  certificate_number: string;
  student_id: string;
  course_id: string;
  course_title: string;
  issued_at: string;
  is_revoked: boolean;
  assessment_score: number | null;
  capstone_score: number | null;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  display_name: string | null;
};

type SkillProfile = {
  skill_id: string;
  skill_level: string | null;
  confidence_score: number | null;
  evidence_count: number | null;
};

type Skill = {
  id: string;
  name: string;
  category: string | null;
};

type PracticalTask = {
  id: string;
  title: string;
  skill_id: string | null;
  course_id: string;
};

type PracticalSubmission = {
  id: string;
  task_id: string;
  score: number | null;
  reviewed_at: string | null;
  evidence_file_name: string | null;
  evidence_recorded_at: string | null;
};

type CertificateVerificationPageProps =
  PageProps;

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
  }).format(date);
}

function formatScore(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  return `${Math.round(value)}%`;
}

function levelLabel(
  value: string | null
) {
  if (!value) {
    return "Developing";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

export default async function CertificateVerificationPage({
  params,
}: CertificateVerificationPageProps) {
  const { code } = await params;

  const verificationCode =
    decodeURIComponent(code).trim();

  if (!verificationCode) {
    notFound();
  }

  const adminClient =
    createAdminClient();

  const {
    data: verification,
    error: verificationError,
  } =
    await adminClient
      .from("certificate_verifications")
      .select(
        "id,certificate_id,verification_code,is_active,expires_at,created_at"
      )
      .eq(
        "verification_code",
        verificationCode
      )
      .maybeSingle();

  if (verificationError) {
    console.error(
      "Certificate verification lookup failed:",
      verificationError
    );

    notFound();
  }

  if (!verification) {
    notFound();
  }

  const verificationRecord =
    verification as VerificationRecord;

  const {
    data: certificate,
    error: certificateError,
  } = await adminClient
    .from("course_certificates")
    .select(
      [
        "id",
        "certificate_number",
        "student_id",
        "course_id",
        "course_title",
        "issued_at",
        "is_revoked",
        "assessment_score",
        "capstone_score",
      ].join(", ")
    )
    .eq(
      "id",
      verificationRecord.certificate_id
    )
    .maybeSingle();

  if (certificateError) {
    console.error(
      "Public certificate lookup failed:",
      certificateError
    );

    notFound();
  }

  if (!certificate) {
    notFound();
  }

  const certificateRecord =
    certificate as CertificateRecord;

  const isExpired =
    verificationRecord.expires_at !==
      null &&
    new Date(
      verificationRecord.expires_at
    ).getTime() <= Date.now();

  const isValid =
    verificationRecord.is_active &&
    !isExpired &&
    !certificateRecord.is_revoked;

  const [
    profileResult,
    skillProfilesResult,
    submissionsResult,
  ] = await Promise.all([
    adminClient
      .from("profiles")
      .select(
        "id,full_name,display_name"
      )
      .eq(
        "id",
        certificateRecord.student_id
      )
      .maybeSingle(),

    adminClient
      .from("learner_skill_profiles")
      .select(
        "skill_id,skill_level,confidence_score,evidence_count"
      )
      .eq(
        "learner_id",
        certificateRecord.student_id
      )
      .order("confidence_score", {
        ascending: false,
        nullsFirst: false,
      }),

    adminClient
      .from(
        "student_practical_task_submissions"
      )
      .select(
        "id,task_id,score,reviewed_at,evidence_file_name,evidence_recorded_at"
      )
      .eq(
        "student_id",
        certificateRecord.student_id
      )
      .eq("status", "approved")
      .not(
        "evidence_recorded_at",
        "is",
        null
      )
      .order("reviewed_at", {
        ascending: false,
      }),
  ]);

  const profile =
    (profileResult.data ??
      null) as ProfileRecord | null;

  const skillProfiles =
    (skillProfilesResult.data ??
      []) as SkillProfile[];

  const submissions =
    (submissionsResult.data ??
      []) as PracticalSubmission[];

  const skillIds = Array.from(
    new Set(
      skillProfiles.map(
        (item) => item.skill_id
      )
    )
  );

  const taskIds = Array.from(
    new Set(
      submissions.map(
        (item) => item.task_id
      )
    )
  );

  const [
    skillsResult,
    tasksResult,
  ] = await Promise.all([
    skillIds.length > 0
      ? adminClient
          .from("learning_skills")
          .select(
            "id,name,category"
          )
          .in("id", skillIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    taskIds.length > 0
      ? adminClient
          .from(
            "course_practical_tasks"
          )
          .select(
            "id,title,skill_id,course_id"
          )
          .in("id", taskIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  const skills =
    (skillsResult.data ??
      []) as Skill[];

  const tasks =
    (tasksResult.data ??
      []) as PracticalTask[];

  const skillMap = new Map(
    skills.map((skill) => [
      skill.id,
      skill,
    ])
  );

  const taskMap = new Map(
    tasks.map((task) => [
      task.id,
      task,
    ])
  );

  const verificationUrl =
    `${
      process.env.NEXT_PUBLIC_SITE_URL ??
      "https://ruffneck-lms.vercel.app"
    }/verify/certificate/` +
    encodeURIComponent(
      verificationRecord.verification_code
    );

  const learnerName =
    profile?.display_name?.trim() ||
    profile?.full_name?.trim() ||
    "RuffNeck Learn Learner";

  return (
    <main className="page-shell">
      <div
        className="rn-verification-print-area"
        style={{
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <section className="page-header">
          <div>
            <p className="eyebrow">
              RUFFNECK LEARN
            </p>

            <h1>
              Certificate Verification
            </h1>

            <p className="muted">
              Independent verification of a
              RuffNeck Learn professional learning
              credential.
            </p>
          </div>

          <div
            className="rn-verification-actions"
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <PrintVerificationButton />

            <Link
              href="/courses"
              className="rn-button"
            >
              RuffNeck Learn Courses
            </Link>
          </div>
        </section>

        <section
          className="card"
          style={{
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              gap: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p className="eyebrow">
                VERIFICATION STATUS
              </p>

              <h2>
                {isValid
                  ? "Certificate Verified"
                  : "Certificate Not Valid"}
              </h2>

              <p className="muted">
                {isValid
                  ? "This certificate record matches an issued RuffNeck Learn credential."
                  : certificateRecord.is_revoked
                    ? "This certificate has been revoked."
                    : isExpired
                      ? "This certificate verification has expired."
                      : "Public verification for this certificate is currently disabled."}
              </p>
            </div>

            <span
              className={
                isValid
                  ? "rn-badge rn-badge-success"
                  : "rn-badge"
              }
            >
              {isValid
                ? "VALID"
                : "NOT VALID"}
            </span>
          </div>
        </section>

        <section
          className="card"
          style={{
            marginBottom: "1.5rem",
          }}
        >
          <p className="eyebrow">
            CERTIFICATE RECORD
          </p>

          <h2>
            {certificateRecord.course_title}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "1rem",
              marginTop: "1.25rem",
            }}
          >
            <div>
              <strong>
                Certificate holder
              </strong>

              <p>{learnerName}</p>
            </div>

            <div>
              <strong>
                Certificate number
              </strong>

              <p
                style={{
                  overflowWrap:
                    "anywhere",
                }}
              >
                {
                  certificateRecord.certificate_number
                }
              </p>
            </div>

            <div>
              <strong>
                Course
              </strong>

              <p>
                {
                  certificateRecord.course_title
                }
              </p>
            </div>

            <div>
              <strong>
                Issue date
              </strong>

              <p>
                {formatDate(
                  certificateRecord.issued_at
                )}
              </p>
            </div>

            <div>
              <strong>
                Assessment
              </strong>

              <p>
                {formatScore(
                  certificateRecord.assessment_score
                )}
              </p>
            </div>

            <div>
              <strong>
                Capstone
              </strong>

              <p>
                {certificateRecord.capstone_score !==
                null
                  ? `${Math.round(
                      certificateRecord.capstone_score
                    )}/100`
                  : "—"}
              </p>
            </div>
          </div>
        </section>

        {isValid && (
          <>
            <section
              className="card"
              style={{
                marginBottom: "1.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "flex-start",
                  gap: "1.5rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p className="eyebrow">
                    VERIFICATION CODE
                  </p>

                  <h2
                    style={{
                      overflowWrap:
                        "anywhere",
                    }}
                  >
                    {
                      verificationRecord.verification_code
                    }
                  </h2>

                  <p className="muted">
                    Use this code together with
                    the public verification page
                    to confirm this credential.
                  </p>
                </div>

                <VerificationQr
                  value={verificationUrl}
                />
              </div>
            </section>

            <section
              className="card"
              style={{
                marginBottom: "1.5rem",
              }}
            >
              <p className="eyebrow">
                VERIFIED SKILLS
              </p>

              <h2>
                Demonstrated capabilities
              </h2>

              {skillProfiles.length ===
              0 ? (
                <p className="muted">
                  No additional skill evidence is
                  attached to this certificate.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  {skillProfiles.map(
                    (profile) => {
                      const skill =
                        skillMap.get(
                          profile.skill_id
                        );

                      if (!skill) {
                        return null;
                      }

                      return (
                        <article
                          key={
                            profile.skill_id
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

                          <div
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "repeat(2, 1fr)",
                              gap: "0.75rem",
                              marginTop:
                                "0.75rem",
                            }}
                          >
                            <div>
                              <strong>
                                Level
                              </strong>

                              <p>
                                {levelLabel(
                                  profile.skill_level
                                )}
                              </p>
                            </div>

                            <div>
                              <strong>
                                Confidence
                              </strong>

                              <p>
                                {formatScore(
                                  profile.confidence_score
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
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>

            <section
              className="card"
              style={{
                marginBottom: "1.5rem",
              }}
            >
              <p className="eyebrow">
                PRACTICAL EVIDENCE
              </p>

              <h2>
                Approved practical work
              </h2>

              {submissions.length ===
              0 ? (
                <p className="muted">
                  No public practical evidence is
                  attached to this credential.
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
                          submission.task_id
                        );

                      if (!task) {
                        return null;
                      }

                      const skill =
                        task.skill_id
                          ? skillMap.get(
                              task.skill_id
                            )
                          : null;

                      return (
                        <article
                          key={
                            submission.id
                          }
                          style={{
                            padding:
                              "1rem",
                            border:
                              "1px solid var(--border, #e2e8f0)",
                            borderRadius: 10,
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: "1rem",
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <div>
                              <strong>
                                {
                                  task.title
                                }
                              </strong>

                              {skill && (
                                <p
                                  className="muted"
                                  style={{
                                    margin:
                                      "0.25rem 0 0",
                                  }}
                                >
                                  {
                                    skill.name
                                  }
                                </p>
                              )}
                            </div>

                            <span className="rn-badge rn-badge-success">
                              Approved
                            </span>
                          </div>

                          <div
                            style={{
                              display:
                                "flex",
                              gap: "1.25rem",
                              flexWrap:
                                "wrap",
                              marginTop:
                                "0.75rem",
                            }}
                          >
                            <span>
                              Score:{" "}
                              {submission.score !==
                              null
                                ? `${Math.round(
                                    submission.score
                                  )}%`
                                : "Not scored"}
                            </span>

                            {submission.evidence_file_name && (
                              <span>
                                Evidence:{" "}
                                {
                                  submission.evidence_file_name
                                }
                              </span>
                            )}

                            {submission.reviewed_at && (
                              <span>
                                Reviewed:{" "}
                                {formatDate(
                                  submission.reviewed_at
                                )}
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </>
        )}

        <section
          className="card"
          style={{
            marginBottom: "1.5rem",
          }}
        >
          <p className="eyebrow">
            VERIFICATION INFORMATION
          </p>

          <p>
            Verification code:{" "}
            <strong>
              {
                verificationRecord.verification_code
              }
            </strong>
          </p>

          <p className="muted">
            This page displays only information
            intended for public credential
            verification. Private account,
            payment, submission, and authentication
            information is not disclosed.
          </p>

          <p className="muted">
            RuffNeck Learn credentials are issued
            based on the completion requirements
            established for the relevant course.
          </p>
        </section>

        <footer
          className="rn-verification-footer"
          style={{
            paddingBottom: "2rem",
            textAlign: "center",
          }}
        >
          <p className="muted">
            RuffNeck Learn · RuffNeck
            Entertainment
          </p>
        </footer>
      </div>
    </main>
  );
}