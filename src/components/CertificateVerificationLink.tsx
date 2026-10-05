"use client";

import { useState } from "react";

type CertificateVerificationLinkProps = {
  certificateNumber: string;
};

export default function CertificateVerificationLink({
  certificateNumber,
}: CertificateVerificationLinkProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const verificationPath = `/verify/${encodeURIComponent(
    certificateNumber
  )}`;

  function getVerificationUrl() {
    return `${window.location.origin}${verificationPath}`;
  }

  async function copyVerificationLink() {
    const url = getVerificationUrl();

    try {
      await navigator.clipboard.writeText(url);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Unable to copy certificate verification link:",
        error
      );

      setCopied(false);
    }
  }

  async function shareCertificate() {
    const url = getVerificationUrl();

    if (
      typeof navigator.share !== "function"
    ) {
      await copyVerificationLink();
      return;
    }

    setSharing(true);

    try {
      await navigator.share({
        title:
          "RuffNeck Learn Certificate Verification",
        text:
          `Verify RuffNeck Learn certificate ${certificateNumber}.`,
        url,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "Unable to share certificate:",
        error
      );

      await copyVerificationLink();
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 10,
        background:
          "rgba(0, 180, 216, 0.04)",
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
          lineHeight: 1.6,
        }}
      >
        Anyone can verify this credential using
        its public RuffNeck Learn verification
        page.
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
          href={verificationPath}
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

        <button
          type="button"
          onClick={shareCertificate}
          disabled={sharing}
          className="rn-button rn-button-secondary"
          style={{
            opacity: sharing ? 0.7 : 1,
            cursor: sharing
              ? "wait"
              : "pointer",
          }}
        >
          {sharing
            ? "Sharing..."
            : "Share Certificate"}
        </button>
      </div>
    </div>
  );
}