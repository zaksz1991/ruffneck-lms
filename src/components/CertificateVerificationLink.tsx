"use client";

import { useState } from "react";

export default function CertificateVerificationLink({
  certificateNumber,
}: {
  certificateNumber: string;
}) {
  const [copied, setCopied] =
    useState(false);

  async function copyVerificationLink() {
    const url =
      `${window.location.origin}/verify/${encodeURIComponent(
        certificateNumber
      )}`;

    try {
      await navigator.clipboard.writeText(
        url
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "rgba(0, 180, 216, 0.04)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--cyan)",
          marginBottom: 8,
        }}
      >
        Public verification
      </div>

      <p
        style={{
          margin: "0 0 12px",
          fontSize: 14,
        }}
      >
        Anyone can verify this credential using
        its public verification link.
      </p>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "stretch",
          flexWrap: "wrap",
        }}
      >
        <a
          href={`/verify/${encodeURIComponent(
            certificateNumber
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rn-button rn-button-secondary"
        >
          Open Verification
        </a>

        <button
          type="button"
          onClick={copyVerificationLink}
          className="rn-button rn-button-primary"
        >
          {copied
            ? "Verification Link Copied"
            : "Copy Verification Link"}
        </button>
      </div>
    </div>
  );
}