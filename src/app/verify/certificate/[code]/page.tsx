import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import VerificationQr from "../../[code]/VerificationQr";
import PrintVerificationButton from "../../[code]/PrintVerificationButton";

type VerificationRecord = {
  id: string;
  certificate_id: string;
  verification_code: string;
  is_active: boolean;
  expires_at: string | null;
};

type Certificate = {
  id: string;
  certificate_number: string;
  holder_name: string;
  course_title: string;
  issued_at: string;
  assessment_score: number | null;
  capstone_score: number | null;
  is_revoked: boolean;
  revoked_reason: string | null;
  student_id: string;
};

type Profile = {
  full_name: string | null;
  display_name: string | null;
};

type Skill = {
  id: string;
  name: string;
  description: string | null;
};

type SkillProfile = {
  skill_id: string;
  confidence_score: number | null;
  verification_status: string | null;
};

type PracticalEvidence = {
  id: string;
  title: string;
  score: number | null;
  reviewed_at: string | null;
  course_id: string | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
  }).format(date);
}

function formatScore(
  value: number | null,
  suffix = "%",
) {
  return value === null
    ? "—"
    : `${value}${suffix}`;
}

function getPublicName(profile: Profile | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.display_name?.trim() ||
    "RuffNeck Learn Student"
  );
}

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{
    code: string;
  }>;
}) {
  const { code } = await params;

  const verificationCode =
    decodeURIComponent(code).trim();

  if (!verificationCode) {
    notFound();
  }

  const supabase = createAdminClient();

  const {
    data: verificationData,
    error: verificationError,
  } = await supabase
    .from("certificate_verifications")
    .select(
      [
        "id",
        "certificate_id",
        "verification_code",
        "is_active",
        "expires_at",
      ].join(", "),
    )
    .eq(
      "verification_code",
      verificationCode,
    )
    .maybeSingle();

  if (verificationError) {
    console.error(
      "Certificate verification lookup failed:",
      verificationError,
    );

    throw new Error(
      "Unable to verify certificate.",
    );
  }

  if (!verificationData) {
    return (
      <main className="rn-page">
        <div className="container">
          <div className="card">
            <span className="rn-eyebrow">
              CERTIFICATE VERIFICATION
            </span>

            <h1>
              Certificate Not Found
            </h1>

            <p className="muted">
              The verification code does not
              match a RuffNeck Learn certificate
              verification record.
            </p>

            <Link
              href="/courses"
              className="rn-button rn-button-primary"
            >
              Visit RuffNeck Learn
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const verification =
    verificationData as unknown as VerificationRecord;

  const {
    data: certificateData,
    error: certificateError,
  } = await supabase
    .from("course_certificates")
    .select(
      [
        "id",
        "certificate_number",
        "holder_name",
        "course_title",
        "issued_at",
        "assessment_score",
        "capstone_score",
        "is_revoked",
        "revoked_reason",
        "student_id",
      ].join(", "),
    )
    .eq(
      "id",
      verification.certificate_id,
    )
    .maybeSingle();

  if (certificateError) {
    console.error(
      "Certificate record lookup failed:",
      certificateError,
    );

    throw new Error(
      "Unable to load certificate.",
    );
  }

  if (!certificateData) {
    notFound();
  }

  const certificate =
    certificateData as unknown as Certificate;

  const expired =
    Boolean(
      verification.expires_at &&
        new Date(
          verification.expires_at,
        ).getTime() <= Date.now(),
    );

  const isValid =
    verification.is_active &&
    !expired &&
    !certificate.is_revoked;

  const {
    data: profileData,
  } = await supabase
    .from("profiles")
    .select(
      "full_name,display_name",
    )
    .eq(
      "id",
      certificate.student_id,
    )
    .maybeSingle();

  const profile =
    (profileData as unknown as Profile | null) ??
    null;

  const publicName =
    certificate.holder_name?.trim() ||
    getPublicName(profile);

  const {
    data: skillProfileData,
  } = await supabase
    .from("learner_skill_profiles")
    .select(
      "skill_id,confidence_score,verification_status",
    )
    .eq(
      "student_id",
      certificate.student_id,
    );

  const skillProfiles =
    (skillProfileData as unknown as SkillProfile[] | null) ??
    [];

  const skillIds = skillProfiles
    .map((item) => item.skill_id)
    .filter(Boolean);

  let skills: Skill[] = [];

  if (skillIds.length > 0) {
    const {
      data: skillsData,
    } = await supabase
      .from("learning_skills")
      .select(
        "id,name,description",
      )
      .in("id", skillIds);

    skills =
      (skillsData as unknown as Skill[] | null) ??
      [];
  }

  const skillMap = new Map(
    skills.map((skill) => [
      skill.id,
      skill,
    ]),
  );

  const verifiedSkills =
    skillProfiles
      .filter(
        (profile) =>
          profile.verification_status ===
            "verified" ||
          profile.verification_status ===
            "strong" ||
          (profile.confidence_score !==
            null &&
            profile.confidence_score >=
              80),
      )
      .map((profile) => ({
        ...profile,
        skill:
          skillMap.get(
            profile.skill_id,
          ) ?? null,
      }))
      .filter((item) => item.skill);

  const {
    data: evidenceData,
  } = await supabase
    .from(
      "student_practical_task_submissions",
    )
    .select(
      "id,score,reviewed_at,task_id",
    )
    .eq(
      "student_id",
      certificate.student_id,
    )
    .eq(
      "status",
      "approved",
    )
    .not(
      "reviewed_at",
      "is",
      null,
    )
    .order(
      "reviewed_at",
      {
        ascending: false,
      },
    )
    .limit(10);

  const evidenceRows =
    (evidenceData as unknown as Array<{
      id: string;
      score: number | null;
      reviewed_at: string | null;
      task_id: string;
    }> | null) ?? [];

  const taskIds = evidenceRows
    .map((item) => item.task_id)
    .filter(Boolean);

  let practicalEvidence:
    PracticalEvidence[] = [];

  if (taskIds.length > 0) {
    const {
      data: tasksData,
    } = await supabase
      .from(
        "course_practical_tasks",
      )
      .select(
        "id,title,course_id",
      )
      .in("id", taskIds);

    const taskMap = new Map(
      (
        tasksData as unknown as Array<{
          id: string;
          title: string;
          course_id: string | null;
        }> | null
      )?.map((task) => [
        task.id,
        task,
      ]) ?? [],
    );

    practicalEvidence =
      evidenceRows.map((evidence) => {
        const task =
          taskMap.get(
            evidence.task_id,
          );

        return {
          id: evidence.id,
          title:
            task?.title ??
            "Approved practical work",
          score: evidence.score,
          reviewed_at:
            evidence.reviewed_at,
          course_id:
            task?.course_id ?? null,
        };
      });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app";

  const verificationUrl = `${siteUrl.replace(
    /\/$/,
    "",
  )}/verify/certificate/${encodeURIComponent(
    verification.verification_code,
  )}`;

  return (
    <main className="rn-page">
      <div
        className="container rn-verification-print-area"
      >
        <div
          className="rn-verification-actions"
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <Link
            href="/courses"
            className="rn-learning-back"
          >
            ← RuffNeck Learn
          </Link>

          <PrintVerificationButton />
        </div>

        <article className="card">
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              <img
                src="/brand/ruffneck-logo.png"
                alt="RuffNeck Entertainment"
                style={{
                  width: 220,
                  maxWidth: "100%",
                  height: "auto",
                }}
              />

              <span
                className="rn-eyebrow"
                style={{
                  display: "block",
                  marginTop: 20,
                }}
              >
                CERTIFICATE VERIFICATION
              </span>

              <h1>
                RuffNeck Learn Certificate
              </h1>
            </div>

            <div
              style={{
                minWidth: 170,
                padding: 16,
                borderRadius: 12,
                textAlign: "center",
                border:
                  "1px solid #e2e8f0",
                background:
                  isValid
                    ? "#f0fdf4"
                    : "#fef2f2",
              }}
            >
              <strong
                style={{
                  display: "block",
                  fontSize: 18,
                  color:
                    isValid
                      ? "#166534"
                      : "#991b1b",
                }}
              >
                {isValid
                  ? "VERIFIED"
                  : "NOT VALID"}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: 6,
                  fontSize: 13,
                  color: "#64748b",
                }}
              >
                {certificate.is_revoked
                  ? "Certificate revoked"
                  : expired
                    ? "Verification expired"
                    : !verification.is_active
                      ? "Verification inactive"
                      : "Official record"}
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: 32,
              paddingTop: 28,
              borderTop:
                "1px solid #e2e8f0",
            }}
          >
            <p
              className="muted"
              style={{
                marginBottom: 8,
              }}
            >
              This certificate belongs to
            </p>

            <h2
              style={{
                marginTop: 0,
              }}
            >
              {publicName}
            </h2>

            <p
              style={{
                fontSize: 18,
                lineHeight: 1.6,
              }}
            >
              {certificate.course_title}
            </p>
          </div>

          <div
            className="rn-certificate-details"
            style={{
              marginTop: 24,
            }}
          >
            <div>
              <span>
                Certificate Number
              </span>
              <strong>
                {
                  certificate.certificate_number
                }
              </strong>
            </div>

            <div>
              <span>
                Date Issued
              </span>
              <strong>
                {formatDate(
                  certificate.issued_at,
                )}
              </strong>
            </div>

            <div>
              <span>
                Assessment
              </span>
              <strong>
                {formatScore(
                  certificate.assessment_score,
                )}
              </strong>
            </div>

            <div>
              <span>
                Capstone
              </span>
              <strong>
                {formatScore(
                  certificate.capstone_score,
                  "/100",
                )}
              </strong>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent:
                "center",
              alignItems: "center",
              gap: 32,
              flexWrap: "wrap",
              marginTop: 32,
              padding: 24,
              border:
                "1px solid #e2e8f0",
              borderRadius: 12,
              background:
                "#f8fafc",
            }}
          >
            <VerificationQr
              value={verificationUrl}
              title="Scan to verify certificate"
              subtitle="Scan this code to open the official RuffNeck Learn certificate verification record."
            />

            <div
              style={{
                flex:
                  "1 1 300px",
                minWidth: 250,
              }}
            >
              <span className="rn-eyebrow">
                VERIFICATION CODE
              </span>

              <h3
                style={{
                  margin:
                    "8px 0 12px",
                }}
              >
                {
                  verification.verification_code
                }
              </h3>

              <p
                className="muted"
                style={{
                  lineHeight: 1.6,
                  overflowWrap:
                    "anywhere",
                }}
              >
                {verificationUrl}
              </p>

              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#64748b",
                }}
              >
                Verification is based on
                the official RuffNeck Learn
                certificate record.
              </p>
            </div>
          </div>

          {certificate.is_revoked ? (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                borderRadius: 10,
                background: "#fef2f2",
                border:
                  "1px solid #fecaca",
                color: "#991b1b",
              }}
            >
              <strong>
                Certificate revoked
              </strong>

              {certificate.revoked_reason ? (
                <p
                  style={{
                    marginBottom: 0,
                  }}
                >
                  {
                    certificate.revoked_reason
                  }
                </p>
              ) : null}
            </div>
          ) : null}

          {verifiedSkills.length > 0 ? (
            <section
              style={{
                marginTop: 32,
              }}
            >
              <span className="rn-eyebrow">
                VERIFIED SKILLS
              </span>

              <h2>
                Demonstrated Skills
              </h2>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {verifiedSkills.map(
                  ({
                    skill,
                    confidence_score,
                  }) => (
                    <div
                      key={skill!.id}
                      style={{
                        padding: 16,
                        border:
                          "1px solid #e2e8f0",
                        borderRadius: 10,
                      }}
                    >
                      <strong>
                        {skill!.name}
                      </strong>

                      {skill!
                        .description ? (
                        <p
                          className="muted"
                          style={{
                            marginBottom: 8,
                          }}
                        >
                          {
                            skill!
                              .description
                          }
                        </p>
                      ) : null}

                      {confidence_score !==
                      null ? (
                        <small>
                          Confidence:{" "}
                          {
                            confidence_score
                          }
                          %
                        </small>
                      ) : null}
                    </div>
                  ),
                )}
              </div>
            </section>
          ) : null}

          {practicalEvidence.length > 0 ? (
            <section
              style={{
                marginTop: 32,
              }}
            >
              <span className="rn-eyebrow">
                PRACTICAL EVIDENCE
              </span>

              <h2>
                Approved Practical Work
              </h2>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {practicalEvidence.map(
                  (evidence) => (
                    <div
                      key={evidence.id}
                      style={{
                        padding: 16,
                        border:
                          "1px solid #e2e8f0",
                        borderRadius: 10,
                      }}
                    >
                      <strong>
                        {evidence.title}
                      </strong>

                      <div
                        style={{
                          display: "flex",
                          gap: 16,
                          flexWrap:
                            "wrap",
                          marginTop: 8,
                          fontSize: 13,
                          color:
                            "#64748b",
                        }}
                      >
                        <span>
                          Score:{" "}
                          {evidence.score ??
                            "—"}
                        </span>

                        <span>
                          Approved:{" "}
                          {formatDate(
                            evidence.reviewed_at,
                          )}
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          ) : null}

          <div
            style={{
              marginTop: 36,
              paddingTop: 20,
              borderTop:
                "1px solid #e2e8f0",
              fontSize: 13,
              lineHeight: 1.6,
              color: "#64748b",
            }}
          >
            <strong>
              Privacy notice:
            </strong>{" "}
            This public verification page
            displays only information necessary
            to verify the authenticity of the
            certificate. Private learner records
            are not exposed.
          </div>
        </article>
      </div>
    </main>
  );
}