"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CertificateIssueResponse = {
  certificateId?: string;
  certificateNumber?: string;
  error?: string;
};

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
    if (loading) {
      return;
    }

    const trimmedCourseId =
      courseId.trim();

    if (!trimmedCourseId) {
      setError(
        "A valid course is required."
      );
      return;
    }

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
            courseId:
              trimmedCourseId,
          }),
        }
      );

      let result: CertificateIssueResponse =
        {};

      try {
        result =
          (await response.json()) as CertificateIssueResponse;
      } catch {
        throw new Error(
          "The certificate service returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to issue certificate."
        );
      }

      if (
        !result.certificateId
      ) {
        throw new Error(
          "Certificate was created without a certificate ID."
        );
      }

      router.push(
        `/student/certificates/${result.certificateId}`
      );
      router.refresh();
    } catch (issueError) {
      setError(
        issueError instanceof Error
          ? issueError.message
          : "Unable to issue certificate."
      );

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
        aria-busy={loading}
      >
        {loading
          ? "Issuing…"
          : "Generate Certificate"}
      </button>

      {error ? (
        <p
          className="rn-enroll-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}