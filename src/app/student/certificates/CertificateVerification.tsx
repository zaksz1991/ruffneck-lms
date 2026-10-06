"use client";

import { useEffect, useMemo, useState } from "react";

type Verification = {
  id: string;
  certificate_id: string;
  verification_code: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  verification?: Verification | null;
  error?: string;
};

type CertificateVerificationProps = {
  certificateId: string;
  certificateNumber: string;
  isRevoked?: boolean;
};

export default function CertificateVerification({
  certificateId,
  certificateNumber,
  isRevoked = false,
}: CertificateVerificationProps) {
  const [verification, setVerification] =
    useState<Verification | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [updating, setUpdating] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function loadVerification() {
      try {
        const response = await fetch(
          `/api/student/certificates/verification?certificate_id=${encodeURIComponent(
            certificateId
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data =
          (await response.json()) as ApiResponse;

        if (!mounted) {
          return;
        }

        if (!response.ok) {
          setError(
            data.error ??
              "Unable to load certificate verification."
          );
          return;
        }

        setVerification(
          data.verification ?? null
        );
      } catch {
        if (mounted) {
          setError(
            "Unable to load certificate verification."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadVerification();

    return () => {
      mounted = false;
    };
  }, [certificateId]);

  const verificationUrl = useMemo(() => {
    if (!verification) {
      return "";
    }

    if (
      typeof window === "undefined"
    ) {
      return "";
    }

    return `${window.location.origin}/verify/certificate/${encodeURIComponent(
      verification.verification_code
    )}`;
  }, [verification]);

  async function createVerification() {
    if (creating || isRevoked) {
      return;
    }

    setCreating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/student/certificates/verification",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            certificate_id:
              certificateId,
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(
          data.error ??
            "Unable to create verification."
        );
        return;
      }

      setVerification(
        data.verification ?? null
      );

      setMessage(
        "Certificate verification is ready."
      );
    } catch {
      setError(
        "Unable to create certificate verification."
      );
    } finally {
      setCreating(false);
    }
  }

  async function toggleVerification() {
    if (
      !verification ||
      updating ||
      isRevoked
    ) {
      return;
    }

    setUpdating(true);
    setError("");
    setMessage("");

    const nextActive =
      !verification.is_active;

    try {
      const response = await fetch(
        "/api/student/certificates/verification",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            certificate_id:
              certificateId,
            is_active:
              nextActive,
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(
          data.error ??
            "Unable to update verification."
        );
        return;
      }

      setVerification(
        data.verification ?? null
      );

      setMessage(
        nextActive
          ? "Public certificate verification is active."
          : "Public certificate verification has been disabled."
      );
    } catch {
      setError(
        "Unable to update certificate verification."
      );
    } finally {
      setUpdating(false);
    }
  }

  async function copyVerificationLink() {
    if (!verificationUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        verificationUrl
      );

      setError("");
      setMessage(
        "Certificate verification link copied."
      );
    } catch {
      setError(
        "Unable to copy the verification link."
      );
    }
  }

  if (loading) {
    return (
      <div
        style={{
          marginTop: "1rem",
        }}
      >
        <p className="muted">
          Loading verification...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "1rem",
        paddingTop: "1rem",
        borderTop:
          "1px solid var(--border, #e2e8f0)",
      }}
    >
      <span className="rn-eyebrow">
        PUBLIC VERIFICATION
      </span>

      <h4
        style={{
          marginTop: "0.35rem",
          marginBottom: "0.35rem",
        }}
      >
        Verify certificate
      </h4>

      <p
        className="muted"
        style={{
          marginBottom: "0.8rem",
        }}
      >
        Certificate {certificateNumber} can be
        independently verified using a public
        RuffNeck Learn verification link.
      </p>

      {error && (
        <div
          className="rn-alert rn-alert-error"
          role="alert"
          style={{
            marginBottom: "0.8rem",
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="rn-alert rn-alert-success"
          role="status"
          style={{
            marginBottom: "0.8rem",
          }}
        >
          {message}
        </div>
      )}

      {!verification ? (
        <button
          type="button"
          className="rn-button rn-button-secondary"
          onClick={createVerification}
          disabled={creating || isRevoked}
        >
          {creating
            ? "Creating..."
            : "Create Verification Link"}
        </button>
      ) : (
        <>
          <div
            style={{
              padding: "0.8rem",
              border:
                "1px solid var(--border, #e2e8f0)",
              borderRadius: 8,
              background:
                "var(--surface-soft, #f8fafc)",
              overflowWrap: "anywhere",
              fontSize: "0.85rem",
            }}
          >
            <strong>
              Verification URL
            </strong>

            <p
              style={{
                margin:
                  "0.4rem 0 0",
              }}
            >
              {verificationUrl}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: "0.8rem",
            }}
          >
            {verification.is_active &&
            !isRevoked ? (
              <>
                <button
                  type="button"
                  className="rn-button rn-button-primary"
                  onClick={
                    copyVerificationLink
                  }
                >
                  Copy Verification Link
                </button>

                <a
                  href={verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rn-button rn-button-secondary"
                >
                  Open Verification
                </a>
              </>
            ) : null}

            {!isRevoked && (
              <button
                type="button"
                className="rn-button"
                onClick={
                  toggleVerification
                }
                disabled={updating}
              >
                {updating
                  ? "Updating..."
                  : verification.is_active
                    ? "Disable Verification"
                    : "Enable Verification"}
              </button>
            )}
          </div>

          <p
            className="muted"
            style={{
              marginTop: "0.7rem",
              marginBottom: 0,
              fontSize: "0.82rem",
            }}
          >
            {verification.is_active &&
            !isRevoked
              ? "Employers and clients can use this link to verify the certificate."
              : "This certificate does not currently have an active public verification link."}
          </p>
        </>
      )}
    </div>
  );
}