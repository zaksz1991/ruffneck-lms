"use client";

import { useState } from "react";

type CertificateIssueButtonProps = {
  courseId: string;
};

type CertificateIssueResponse = {
  ok?: boolean;
  certificateId?: string;
  certificateNumber?: string;
  alreadyIssued?: boolean;
  error?: string;
  stage?: string;
  details?: string;
};

export default function CertificateIssueButton({
  courseId,
}: CertificateIssueButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleClaimCertificate() {
    if (!courseId || loading) {
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/student/certificates/issue",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            courseId,
          }),
        }
      );

      const rawResponse = await response.text();

      let result: CertificateIssueResponse = {};

      if (rawResponse.trim()) {
        try {
          result = JSON.parse(
            rawResponse
          ) as CertificateIssueResponse;
        } catch {
          throw new Error(
            `The certificate service returned an invalid response (HTTP ${response.status}).`
          );
        }
      }

      if (!response.ok || result.ok === false) {
        const diagnostic =
          result.details ||
          result.error ||
          `Certificate issuance failed (HTTP ${response.status}).`;

        throw new Error(diagnostic);
      }

      if (!result.certificateId) {
        throw new Error(
          "Certificate issuance completed but no certificate ID was returned."
        );
      }

      setMessage(
        result.alreadyIssued
          ? "Your certificate has already been issued."
          : "Certificate issued successfully."
      );

      window.location.assign(
        `/student/certificates/${encodeURIComponent(
          result.certificateId
        )}`
      );
    } catch (claimError) {
      console.error(
        "Certificate issuance failed:",
        claimError
      );

      setError(
        claimError instanceof Error
          ? claimError.message
          : "An unexpected error occurred while issuing the certificate."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <button
        type="button"
        className="rn-button rn-button-primary"
        onClick={handleClaimCertificate}
        disabled={loading}
        style={{
          minWidth: 190,
          justifyContent: "center",
          opacity: loading ? 0.7 : 1,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading
          ? "Issuing Certificate..."
          : "Claim Certificate"}
      </button>

      {message ? (
        <p
          role="status"
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            maxWidth: 700,
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