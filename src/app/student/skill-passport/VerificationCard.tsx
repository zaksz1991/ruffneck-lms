"use client";

import { useEffect, useState } from "react";

type Verification = {
  id: string;
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

export default function VerificationCard() {
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
          "/api/student/skill-passport/verification",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          (await response.json()) as ApiResponse;

        if (!mounted) {
          return;
        }

        if (!response.ok) {
          setError(
            data.error ??
              "Unable to load verification settings.",
          );
          return;
        }

        setVerification(
          data.verification ?? null,
        );
      } catch {
        if (mounted) {
          setError(
            "Unable to load verification settings.",
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
  }, []);

  async function createVerification() {
    if (creating) {
      return;
    }

    setCreating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/student/skill-passport/verification",
        {
          method: "POST",
        },
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(
          data.error ??
            "Unable to create verification.",
        );
        return;
      }

      setVerification(
        data.verification ?? null,
      );

      setMessage(
        "Your public Skill Passport verification link is ready.",
      );
    } catch {
      setError(
        "Unable to create verification.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function toggleVerification() {
    if (!verification || updating) {
      return;
    }

    setUpdating(true);
    setError("");
    setMessage("");

    const nextActive =
      !verification.is_active;

    try {
      const response = await fetch(
        "/api/student/skill-passport/verification",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            is_active: nextActive,
          }),
        },
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(
          data.error ??
            "Unable to update verification.",
        );
        return;
      }

      setVerification(
        data.verification ?? null,
      );

      setMessage(
        nextActive
          ? "Public verification is now active."
          : "Public verification has been disabled.",
      );
    } catch {
      setError(
        "Unable to update verification.",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function copyVerificationLink() {
    if (!verification) {
      return;
    }

    const url =
      `${window.location.origin}/verify/` +
      verification.verification_code;

    try {
      await navigator.clipboard.writeText(
        url,
      );

      setError("");
      setMessage(
        "Verification link copied.",
      );
    } catch {
      setError(
        "Unable to copy the verification link.",
      );
    }
  }

  const verificationUrl =
    verification
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${verification.verification_code}`
      : "";

  if (loading) {
    return (
      <section className="card">
        <p className="muted">
          Loading verification settings...
        </p>
      </section>
    );
  }

  return (
    <section
      className="card"
      style={{
        marginBottom: "2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="eyebrow">
            EMPLOYER VERIFICATION
          </p>

          <h2>
            Public Skill Passport
          </h2>

          <p className="muted">
            Give an employer or client a secure
            link to verify your demonstrated
            skills and RuffNeck Learn credentials.
          </p>
        </div>

        {verification && (
          <span
            className={
              verification.is_active
                ? "rn-badge rn-badge-success"
                : "rn-badge"
            }
          >
            {verification.is_active
              ? "Verification active"
              : "Verification disabled"}
          </span>
        )}
      </div>

      {error && (
        <div
          className="rn-alert rn-alert-error"
          role="alert"
          style={{
            marginTop: "1rem",
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
            marginTop: "1rem",
          }}
        >
          {message}
        </div>
      )}

      {!verification ? (
        <div
          style={{
            marginTop: "1.25rem",
          }}
        >
          <button
            type="button"
            className="rn-button rn-button-primary"
            onClick={createVerification}
            disabled={creating}
          >
            {creating
              ? "Creating..."
              : "Create Verification Link"}
          </button>
        </div>
      ) : (
        <div
          style={{
            marginTop: "1.25rem",
          }}
        >
          <div
            style={{
              padding: "1rem",
              border:
                "1px solid var(--border, #e2e8f0)",
              borderRadius: 10,
              background:
                "var(--surface-soft, #f8fafc)",
              overflowWrap:
                "anywhere",
            }}
          >
            <strong>
              Verification URL
            </strong>

            <p
              style={{
                marginTop: "0.5rem",
                marginBottom: 0,
              }}
            >
              {verificationUrl}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginTop: "1rem",
            }}
          >
            <button
              type="button"
              className="rn-button rn-button-primary"
              onClick={copyVerificationLink}
            >
              Copy Verification Link
            </button>

            <a
              href={
                verification.is_active
                  ? verificationUrl
                  : undefined
              }
              target="_blank"
              rel="noopener noreferrer"
              className="rn-button"
              aria-disabled={
                !verification.is_active
              }
              onClick={(event) => {
                if (
                  !verification.is_active
                ) {
                  event.preventDefault();
                }
              }}
            >
              Preview Public Passport
            </a>

            <button
              type="button"
              className="rn-button"
              onClick={toggleVerification}
              disabled={updating}
            >
              {updating
                ? "Updating..."
                : verification.is_active
                  ? "Disable Verification"
                  : "Enable Verification"}
            </button>
          </div>

          <p
            className="muted"
            style={{
              marginTop: "0.9rem",
              marginBottom: 0,
            }}
          >
            Only information intended for
            public verification will be displayed.
            Your private submissions, payment
            information, and account details remain
            private.
          </p>
        </div>
      )}
    </section>
  );
}