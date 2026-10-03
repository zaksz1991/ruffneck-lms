"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CertificateIssueButton({
  courseId,
}: {
  courseId: string;
}) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function issueCertificate() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/student/certificates/issue",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            courseId,
          }),
        }
      );

      const result =
        (await response.json()) as {
          certificateId?: string;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to issue certificate."
        );
      }

      if (!result.certificateId) {
        throw new Error(
          "Certificate was created without an ID."
        );
      }

      router.push(
        `/student/certificates/${result.certificateId}`
      );
    } catch (issueError) {
      setError(
        issueError instanceof Error
          ? issueError.message
          : "Unable to issue certificate."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="rn-button rn-button-primary"
        onClick={issueCertificate}
        disabled={loading}
      >
        {loading
          ? "Issuing…"
          : "Generate Certificate"}
      </button>

      {error ? (
        <p className="rn-enroll-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}