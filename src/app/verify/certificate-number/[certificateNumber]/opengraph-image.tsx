import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export const alt = "RuffNeck Learn Certificate Verification";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type Certificate = {
  certificate_number: string;
  holder_name: string;
  course_title: string;
  issued_at: string;
  assessment_score: number | null;
  capstone_score: number | null;
  is_revoked: boolean;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function Image({
  params,
}: {
  params: Promise<{
    certificateNumber: string;
  }>;
}) {
  const { certificateNumber } = await params;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("course_certificates")
    .select(
      [
        "certificate_number",
        "holder_name",
        "course_title",
        "issued_at",
        "assessment_score",
        "capstone_score",
        "is_revoked",
      ].join(", ")
    )
    .eq("certificate_number", certificateNumber)
    .maybeSingle();

  if (error) {
    console.error(
      "Certificate Open Graph lookup failed:",
      error
    );
  }

  const certificate =
    data as unknown as Certificate | null;

  const holderName =
    certificate?.holder_name || "RuffNeck Learn Learner";

  const courseTitle =
    certificate?.course_title ||
    "RuffNeck Learn Certificate";

  const certificateNumberText =
    certificate?.certificate_number ||
    certificateNumber;

  const issuedDate = certificate
    ? formatDate(certificate.issued_at)
    : "—";

  const status = certificate?.is_revoked
    ? "REVOKED CREDENTIAL"
    : "VERIFIED CREDENTIAL";

  const statusColor = certificate?.is_revoked
    ? "#b91c1c"
    : "#0086a3";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#f8fafc",
          color: "#0b1e3a",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {/* Outer corporate frame */}
        <div
          style={{
            position: "absolute",
            left: "22px",
            top: "22px",
            right: "22px",
            bottom: "22px",
            border: "2px solid #0b1e3a",
            display: "flex",
          }}
        />

        {/* Inner corporate frame */}
        <div
          style={{
            position: "absolute",
            left: "32px",
            top: "32px",
            right: "32px",
            bottom: "32px",
            border: "1px solid #cbd5e1",
            display: "flex",
          }}
        />

        {/* Subtle cyan watermark */}
        <div
          style={{
            position: "absolute",
            right: "-110px",
            bottom: "-190px",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            border: "65px solid rgba(0, 180, 216, 0.055)",
            display: "flex",
          }}
        />

        {/* Subtle gold watermark */}
        <div
          style={{
            position: "absolute",
            left: "-180px",
            top: "-210px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            border: "50px solid rgba(251, 191, 36, 0.045)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            position: "absolute",
            left: "70px",
            right: "70px",
            top: "52px",
            bottom: "52px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "17px",
              borderBottom: "2px solid #00b4d8",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: "31px",
                  fontWeight: 800,
                  letterSpacing: "3px",
                  color: "#0b1e3a",
                }}
              >
                RUFFNECK LEARN
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "1.6px",
                  color: "#475569",
                }}
              >
                AI • DIGITAL TRANSFORMATION • BUSINESS SOLUTIONS
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "82px",
                height: "82px",
                borderRadius: "50%",
                border: "3px solid #fbbf24",
                background: "#ffffff",
                color: "#0b1e3a",
                fontSize: "18px",
                fontWeight: 800,
                letterSpacing: "1px",
              }}
            >
              RN
            </div>
          </div>

          {/* Verification status */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "25px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "15px",
                fontWeight: 800,
                letterSpacing: "4px",
                color: statusColor,
              }}
            >
              {status}
            </div>
          </div>

          {/* Main certificate information */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              paddingTop: "6px",
            }}
          >
            <div
              style={{
                fontSize: "38px",
                fontWeight: 800,
                color: "#0b1e3a",
              }}
            >
              Certificate of Completion
            </div>

            <div
              style={{
                marginTop: "10px",
                fontSize: "18px",
                color: "#475569",
              }}
            >
              This credential is presented to
            </div>

            <div
              style={{
                marginTop: "3px",
                fontSize: "35px",
                fontWeight: 800,
                color: "#0b1e3a",
              }}
            >
              {holderName}
            </div>

            <div
              style={{
                marginTop: "6px",
                fontSize: "19px",
                color: "#334155",
              }}
            >
              for successfully completing
            </div>

            <div
              style={{
                marginTop: "3px",
                fontSize: "25px",
                fontWeight: 700,
                color: "#0b1e3a",
                maxWidth: "920px",
                textAlign: "center",
              }}
            >
              {courseTitle}
            </div>
          </div>

          {/* Footer credential information */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginTop: "auto",
              paddingTop: "17px",
              borderTop: "1px solid #cbd5e1",
            }}
          >
            {/* Certificate number */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: "#64748b",
                }}
              >
                CERTIFICATE NUMBER
              </div>

              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 800,
                  color: "#0b1e3a",
                }}
              >
                {certificateNumberText}
              </div>
            </div>

            {/* Date */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: "#64748b",
                }}
              >
                DATE ISSUED
              </div>

              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#0b1e3a",
                }}
              >
                {issuedDate}
              </div>
            </div>

            {/* Verification */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "5px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: "#64748b",
                }}
              >
                OFFICIAL VERIFICATION
              </div>

              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#0086a3",
                }}
              >
                ruffneck-lms.vercel.app
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}