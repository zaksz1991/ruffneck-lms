import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt =
  "RuffNeck Learn Certificate Verification";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{
    certificateNumber: string;
  }>;
}) {
  const { certificateNumber } = await params;

  const decodedCertificateNumber = decodeURIComponent(
    certificateNumber
  ).trim();

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
          fontFamily:
            "Arial, Helvetica, sans-serif",
        }}
      >
        {/* Outer border */}
        <div
          style={{
            position: "absolute",
            left: "22px",
            top: "22px",
            right: "22px",
            bottom: "22px",
            border: "3px solid #0b1e3a",
            display: "flex",
          }}
        />

        {/* Inner border */}
        <div
          style={{
            position: "absolute",
            left: "34px",
            top: "34px",
            right: "34px",
            bottom: "34px",
            border: "1px solid #cbd5e1",
            display: "flex",
          }}
        />

        {/* Cyan watermark */}
        <div
          style={{
            position: "absolute",
            right: "-170px",
            bottom: "-260px",
            width: "650px",
            height: "650px",
            borderRadius: "50%",
            border:
              "80px solid rgba(0, 180, 216, 0.055)",
            display: "flex",
          }}
        />

        {/* Gold watermark */}
        <div
          style={{
            position: "absolute",
            left: "-200px",
            top: "-250px",
            width: "550px",
            height: "550px",
            borderRadius: "50%",
            border:
              "60px solid rgba(251, 191, 36, 0.05)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            position: "absolute",
            left: "75px",
            right: "75px",
            top: "60px",
            bottom: "60px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Brand header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "20px",
              borderBottom:
                "2px solid #00b4d8",
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
                  fontSize: "34px",
                  fontWeight: 800,
                  letterSpacing: "3px",
                  color: "#0b1e3a",
                }}
              >
                RUFFNECK LEARN
              </div>

              <div
                style={{
                  marginTop: "7px",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "1.5px",
                  color: "#475569",
                }}
              >
                AI • DIGITAL TRANSFORMATION •
                BUSINESS SOLUTIONS
              </div>
            </div>

            {/* RuffNeck identity mark */}
            <div
              style={{
                width: "86px",
                height: "86px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                border:
                  "3px solid #fbbf24",
                background: "#ffffff",
                color: "#0b1e3a",
                fontSize: "20px",
                fontWeight: 800,
                letterSpacing: "2px",
              }}
            >
              RN
            </div>
          </div>

          {/* Status */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "27px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "15px",
                fontWeight: 800,
                letterSpacing: "4px",
                color: "#0086a3",
              }}
            >
              VERIFIED CREDENTIAL
            </div>
          </div>

          {/* Main certificate message */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              marginTop: "12px",
            }}
          >
            <div
              style={{
                fontSize: "44px",
                fontWeight: 800,
                color: "#0b1e3a",
              }}
            >
              Certificate of Completion
            </div>

            <div
              style={{
                marginTop: "12px",
                fontSize: "20px",
                color: "#475569",
              }}
            >
              Official RuffNeck Learn credential
            </div>

            <div
              style={{
                marginTop: "24px",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                color: "#64748b",
              }}
            >
              PUBLIC CERTIFICATE VERIFICATION
            </div>

            <div
              style={{
                marginTop: "12px",
                fontSize: "30px",
                fontWeight: 800,
                color: "#0b1e3a",
              }}
            >
              {decodedCertificateNumber}
            </div>
          </div>

          {/* Bottom information */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginTop: "auto",
              paddingTop: "22px",
              borderTop:
                "1px solid #cbd5e1",
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
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  color: "#64748b",
                }}
              >
                CERTIFICATE NUMBER
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "17px",
                  fontWeight: 800,
                  color: "#0b1e3a",
                }}
              >
                {decodedCertificateNumber}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  color: "#64748b",
                }}
              >
                AUTHENTICATION
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "16px",
                  fontWeight: 800,
                  color: "#0086a3",
                }}
              >
                Official Verification
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  color: "#64748b",
                }}
              >
                ISSUED BY
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "16px",
                  fontWeight: 800,
                  color: "#0b1e3a",
                }}
              >
                RuffNeck Entertainment
              </div>

              <div
                style={{
                  marginTop: "3px",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                RuffNeck Learn
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