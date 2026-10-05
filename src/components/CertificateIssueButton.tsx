"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CertificateIssueResponse = {
  error?: string;
  certificateId?: string;
  certificateNumber?: string;
  alreadyIssued?: boolean;
};

export default function CertificateIssueButton({
  courseId,
}: {
  courseId: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function issueCertificate() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/student/certificates/issue",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            courseId,
          }),
        }
      );

      const data =
        (await response.json()) as CertificateIssueResponse;

      if (!response.ok) {
        setError(
          data.error ||
            "Unable to issue the certificate."
        );
        return;
      }

      if (!data.certificateId) {
        setError(
          "Certificate was processed, but no certificate ID was returned."
        );
        return;
      }

      router.push(
        `/student/certificates/${encodeURIComponent(
          data.certificateId
        )}`
      );
    } catch (requestError) {
      console.error(
        "Certificate issuance request failed:",
        requestError
      );

      setError(
        "Unable to connect to the certificate service. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={issueCertificate}
        disabled={loading}
        className="rn-button rn-button-primary"
        style={{
          minWidth: 190,
          justifyContent: "center",
          opacity: loading ? 0.7 : 1,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading
          ? "Verifying Eligibility..."
          : "Claim Certificate"}
      </button>

      {error ? (
        <p
          role="alert"
          style={{
            marginTop: 12,
            color: "#b91c1c",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}