import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Certificate = {
  id: string;
  certificate_number: string;
  student_id: string;
  holder_name: string;
  course_id: string;
  course_title: string;
  issued_at: string;
  assessment_score: number | null;
  capstone_score: number | null;
  is_revoked: boolean;
  revoked_reason: string | null;
};

type Profile = {
  role: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

async function revokeCertificate(formData: FormData) {
  "use server";

  const certificateId = String(
    formData.get("certificateId") ?? ""
  ).trim();

  const reason = String(
    formData.get("reason") ?? ""
  ).trim();

  if (!certificateId) {
    return;
  }

  if (!reason) {
    return;
  }

  if (reason.length > 500) {
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/certificates");
  }

  const { data: profileData, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || !profileData) {
    redirect("/");
  }

  const profile = profileData as Profile;

  if (profile.role !== "admin") {
    redirect("/");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("course_certificates")
    .update({
      is_revoked: true,
      revoked_reason: reason,
    })
    .eq("id", certificateId)
    .eq("is_revoked", false);

  if (error) {
    console.error(
      "Certificate revocation failed:",
      error
    );

    return;
  }

  revalidatePath("/admin/certificates");
  revalidatePath("/student/certificates");
}

async function restoreCertificate(formData: FormData) {
  "use server";

  const certificateId = String(
    formData.get("certificateId") ?? ""
  ).trim();

  if (!certificateId) {
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/certificates");
  }

  const { data: profileData, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || !profileData) {
    redirect("/");
  }

  const profile = profileData as Profile;

  if (profile.role !== "admin") {
    redirect("/");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("course_certificates")
    .update({
      is_revoked: false,
      revoked_reason: null,
    })
    .eq("id", certificateId)
    .eq("is_revoked", true);

  if (error) {
    console.error(
      "Certificate restoration failed:",
      error
    );

    return;
  }

  revalidatePath("/admin/certificates");
  revalidatePath("/student/certificates");
}

export default async function AdminCertificatesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/certificates");
  }

  const { data: profileData, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || !profileData) {
    redirect("/");
  }

  const profile = profileData as Profile;

  if (profile.role !== "admin") {
    redirect("/");
  }

  const admin = createAdminClient();

  const {
    data: certificateData,
    error: certificateError,
  } = await admin
    .from("course_certificates")
    .select(
      [
        "id",
        "certificate_number",
        "student_id",
        "holder_name",
        "course_id",
        "course_title",
        "issued_at",
        "assessment_score",
        "capstone_score",
        "is_revoked",
        "revoked_reason",
      ].join(", ")
    )
    .order("issued_at", {
      ascending: false,
    });

  if (certificateError) {
    console.error(
      "Admin certificate lookup failed:",
      certificateError
    );
  }

  const certificates =
    (certificateData ?? []) as unknown as Certificate[];

  const activeCertificates =
    certificates.filter(
      (certificate) => !certificate.is_revoked
    ).length;

  const revokedCertificates =
    certificates.filter(
      (certificate) => certificate.is_revoked
    ).length;

  return (
    <main className="rn-admin-certificates-page">
      <div className="container">
        <section
          style={{
            marginBottom: 32,
          }}
        >
          <span className="rn-eyebrow">
            ADMINISTRATION
          </span>

          <h1>Certificate Management</h1>

          <p
            style={{
              maxWidth: 760,
              color: "#64748b",
              lineHeight: 1.7,
            }}
          >
            Manage issued RuffNeck Learn certificates,
            review credential details, and revoke or
            restore certificates when necessary.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div className="rn-stat-card">
            <span>Total certificates</span>
            <strong>{certificates.length}</strong>
          </div>

          <div className="rn-stat-card">
            <span>Valid certificates</span>
            <strong>{activeCertificates}</strong>
          </div>

          <div className="rn-stat-card">
            <span>Revoked certificates</span>
            <strong>{revokedCertificates}</strong>
          </div>
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <span className="rn-eyebrow">
                ISSUED CREDENTIALS
              </span>

              <h2 style={{ marginTop: 6 }}>
                Certificate Registry
              </h2>
            </div>

            <Link
              href="/admin"
              className="rn-button rn-button-secondary"
            >
              Admin Dashboard
            </Link>
          </div>

          {certificates.length === 0 ? (
            <section className="rn-empty-state">
              <span className="rn-eyebrow">
                CERTIFICATE REGISTRY
              </span>

              <h2>No certificates issued</h2>

              <p>
                Issued certificates will appear here for
                administrative management.
              </p>
            </section>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 18,
              }}
            >
              {certificates.map((certificate) => {
                const verificationUrl =
                  `/verify/${encodeURIComponent(
                    certificate.certificate_number
                  )}`;

                return (
                  <article
                    key={certificate.id}
                    style={{
                      border: "1px solid #d9dee8",
                      borderRadius: 16,
                      padding: 24,
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "flex-start",
                        gap: 20,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <span className="rn-eyebrow">
                          CERTIFICATE
                        </span>

                        <h3
                          style={{
                            marginTop: 8,
                            marginBottom: 6,
                          }}
                        >
                          {certificate.course_title}
                        </h3>

                        <p
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            color: "#0b1e3a",
                          }}
                        >
                          {certificate.holder_name}
                        </p>

                        <p
                          style={{
                            marginTop: 6,
                            color: "#64748b",
                            fontSize: 14,
                          }}
                        >
                          {certificate.certificate_number}
                        </p>
                      </div>

                      <div
                        className={
                          certificate.is_revoked
                            ? "rn-project-status status-revision_required"
                            : "rn-project-status status-approved"
                        }
                      >
                        {certificate.is_revoked
                          ? "Revoked"
                          : "Valid"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 16,
                        marginTop: 22,
                        paddingTop: 20,
                        borderTop:
                          "1px solid #e2e8f0",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#64748b",
                            textTransform:
                              "uppercase",
                            letterSpacing:
                              "0.06em",
                            marginBottom: 5,
                          }}
                        >
                          Issued
                        </span>

                        <strong>
                          {formatDate(
                            certificate.issued_at
                          )}
                        </strong>
                      </div>

                      <div>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#64748b",
                            textTransform:
                              "uppercase",
                            letterSpacing:
                              "0.06em",
                            marginBottom: 5,
                          }}
                        >
                          Assessment
                        </span>

                        <strong>
                          {certificate.assessment_score ??
                            "—"}
                          {certificate.assessment_score !==
                          null
                            ? "%"
                            : ""}
                        </strong>
                      </div>

                      <div>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#64748b",
                            textTransform:
                              "uppercase",
                            letterSpacing:
                              "0.06em",
                            marginBottom: 5,
                          }}
                        >
                          Capstone
                        </span>

                        <strong>
                          {certificate.capstone_score ??
                            "—"}
                          {certificate.capstone_score !==
                          null
                            ? "/100"
                            : ""}
                        </strong>
                      </div>

                      <div>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#64748b",
                            textTransform:
                              "uppercase",
                            letterSpacing:
                              "0.06em",
                            marginBottom: 5,
                          }}
                        >
                          Certificate ID
                        </span>

                        <strong
                          style={{
                            fontSize: 13,
                            wordBreak:
                              "break-all",
                          }}
                        >
                          {certificate.id}
                        </strong>
                      </div>
                    </div>

                    {certificate.is_revoked &&
                    certificate.revoked_reason ? (
                      <div
                        style={{
                          marginTop: 18,
                          padding: 16,
                          borderRadius: 10,
                          background: "#fef2f2",
                          border:
                            "1px solid #fecaca",
                          color: "#7f1d1d",
                        }}
                      >
                        <strong>
                          Revocation reason
                        </strong>

                        <p
                          style={{
                            margin:
                              "6px 0 0",
                            lineHeight: 1.6,
                          }}
                        >
                          {
                            certificate.revoked_reason
                          }
                        </p>
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        marginTop: 22,
                      }}
                    >
                      <Link
                        href={`/student/certificates/${encodeURIComponent(
                          certificate.id
                        )}`}
                        className="rn-button rn-button-secondary"
                      >
                        View Certificate
                      </Link>

                      <Link
                        href={verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rn-button rn-button-secondary"
                      >
                        Public Verification
                      </Link>

                      {certificate.is_revoked ? (
                        <form
                          action={
                            restoreCertificate
                          }
                        >
                          <input
                            type="hidden"
                            name="certificateId"
                            value={
                              certificate.id
                            }
                          />

                          <button
                            type="submit"
                            className="rn-button rn-button-primary"
                          >
                            Restore Certificate
                          </button>
                        </form>
                      ) : (
                        <details>
                          <summary
                            className="rn-button rn-button-secondary"
                            style={{
                              cursor: "pointer",
                              listStyle:
                                "none",
                            }}
                          >
                            Revoke Certificate
                          </summary>

                          <form
                            action={
                              revokeCertificate
                            }
                            style={{
                              marginTop: 14,
                              padding: 16,
                              border:
                                "1px solid #fecaca",
                              borderRadius: 12,
                              background:
                                "#fffafa",
                              minWidth: 280,
                            }}
                          >
                            <input
                              type="hidden"
                              name="certificateId"
                              value={
                                certificate.id
                              }
                            />

                            <label
                              htmlFor={`reason-${certificate.id}`}
                              style={{
                                display:
                                  "block",
                                fontWeight: 700,
                                marginBottom:
                                  8,
                                color:
                                  "#0b1e3a",
                              }}
                            >
                              Revocation reason
                            </label>

                            <textarea
                              id={`reason-${certificate.id}`}
                              name="reason"
                              required
                              maxLength={500}
                              rows={4}
                              placeholder="Enter the reason for revoking this certificate."
                              style={{
                                width:
                                  "100%",
                                padding: 12,
                                border:
                                  "1px solid #cbd5e1",
                                borderRadius:
                                  8,
                                resize:
                                  "vertical",
                                marginBottom:
                                  12,
                                font:
                                  "inherit",
                              }}
                            />

                            <button
                              type="submit"
                              className="rn-button rn-button-primary"
                            >
                              Confirm Revocation
                            </button>
                          </form>
                        </details>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}