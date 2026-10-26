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

const VERIFICATION_API =
  "/api/student/skill-passport/verification";

async function readApiResponse(
  response: Response,
): Promise<ApiResponse> {
  try {
    const data: unknown = await response.json();

    if (!data || typeof data !== "object") {
      return {};
    }

    return data as ApiResponse;
  } catch {
    return {};
  }
}

function isVerificationExpired(
  verification: Verification | null,
): boolean {
  if (!verification?.expires_at) {
    return false;
  }

  const expiryTime = new Date(
    verification.expires_at,
  ).getTime();

  return (
    Number.isFinite(expiryTime) &&
    expiryTime <= Date.now()
  );
}

export default function VerificationCard() {
  const [verification, setVerification] =
    useState<Verification | null>(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [origin, setOrigin] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    setOrigin(window.location.origin);

    async function loadVerification() {
      try {
        const response = await fetch(
          VERIFICATION_API,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const data = await readApiResponse(response);

        if (!mounted) {
          return;
        }

        if (!response.ok) {
          setError(
            data.error ||
              "Unable to load verification settings.",
          );

          return;
        }

        setVerification(data.verification ?? null);
      } catch {
        if (mounted) {
          setError(
            "Unable to connect to the verification service. Please try again.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadVerification();

    return () => {
      mounted = false;
    };
  }, []);

  const expired = isVerificationExpired(verification);

  const verificationPath = verification
    ? `/verify/${encodeURIComponent(
        verification.verification_code,
      )}`
    : "";

  const verificationUrl = verification
    ? origin
      ? `${origin}${verificationPath}`
      : verificationPath
    : "";

  async function createVerification() {
    if (creating || updating) {
      return;
    }

    setCreating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        VERIFICATION_API,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        setError(
          data.error ||
            "Unable to create a verification link.",
        );

        return;
      }

      if (!data.verification) {
        setError(
          "The request completed, but no verification link was returned. Reload the page before trying again.",
        );

        return;
      }

      setVerification(data.verification);

      setMessage(
        "Your Skill Passport verification link is ready.",
      );
    } catch {
      setError(
        "Unable to connect to the verification service. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function toggleVerification() {
    if (!verification || updating || creating) {
      return;
    }

    const nextActive = !verification.is_active;

    if (nextActive && isVerificationExpired(verification)) {
      setError(
        "This verification link has expired. Create a new link before enabling public verification.",
      );

      setMessage("");
      return;
    }

    setUpdating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        VERIFICATION_API,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            is_active: nextActive,
          }),
        },
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        setError(
          data.error ||
            "Unable to update verification settings.",
        );

        return;
      }

      /*
       * Some API implementations return the updated
       * record, while others return only a success
       * response. Preserve the existing code if the
       * response does not include the record.
       */
      setVerification(
        data.verification ?? {
          ...verification,
          is_active: nextActive,
          updated_at: new Date().toISOString(),
        },
      );

      setMessage(
        nextActive
          ? "Public verification is now active."
          : "Public verification has been disabled.",
      );
    } catch {
      setError(
        "Unable to connect to the verification service. Please try again.",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function copyVerificationLink() {
    if (
      !verification ||
      !verificationUrl ||
      copying
    ) {
      return;
    }

    if (isVerificationExpired(verification)) {
      setError(
        "This verification link has expired. Create a new link before sharing it.",
      );

      setMessage("");
      return;
    }

    setCopying(true);
    setError("");
    setMessage("");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(
          `${origin}${verificationPath}`,
        );
      } else {
        const textArea =
          document.createElement("textarea");

        textArea.value =
          `${origin}${verificationPath}`;

        textArea.setAttribute(
          "readonly",
          "",
        );

        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.style.pointerEvents = "none";

        document.body.appendChild(textArea);

        textArea.select();

        const copied =
          document.execCommand("copy");

        document.body.removeChild(textArea);

        if (!copied) {
          throw new Error("Clipboard copy failed.");
        }
      }

      setMessage("Verification link copied.");
    } catch {
      setError(
        "Unable to copy automatically. Select and copy the verification URL displayed below.",
      );
    } finally {
      setCopying(false);
    }
  }

  if (loading) {
    return (
      <section
        className="card"
        aria-busy="true"
        style={{
          marginBottom: "2rem",
        }}
      >
        <p className="muted">
          Loading verification settings...
        </p>
      </section>
    );
  }

  const canCreateNewLink =
    !verification || expired;

  const canPreview =
    Boolean(verification?.is_active) &&
    !expired;

  return (
    <section
      className="card"
      aria-labelledby="skill-passport-verification-title"
      style={{
        marginBottom: "2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            flex: "1 1 18rem",
            minWidth: 0,
          }}
        >
          <p className="eyebrow">
            EMPLOYER VERIFICATION
          </p>

          <h2
            id="skill-passport-verification-title"
            style={{
              marginTop: "0.35rem",
            }}
          >
            Public Skill Passport
          </h2>

          <p
            className="muted"
            style={{
              lineHeight: 1.7,
            }}
          >
            Share a verification link with an
            employer or client so they can check
            the credentials and demonstrated skills
            published through RuffNeck Learn.
          </p>
        </div>

        {verification && (
          <span
            className={
              expired
                ? "rn-badge"
                : verification.is_active
                  ? "rn-badge rn-badge-success"
                  : "rn-badge"
            }
            role="status"
          >
            {expired
              ? "Link expired"
              : verification.is_active
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

      {canCreateNewLink && (
        <div
          style={{
            marginTop: "1.25rem",
          }}
        >
          {expired && (
            <p
              className="muted"
              style={{
                lineHeight: 1.7,
              }}
            >
              Your previous verification link has
              expired. Create a new link before
              sharing your Skill Passport.
            </p>
          )}

          <button
            type="button"
            className="rn-button rn-button-primary"
            onClick={createVerification}
            disabled={creating || updating}
          >
            {creating
              ? "Creating verification link..."
              : expired
                ? "Create New Verification Link"
                : "Create Verification Link"}
          </button>
        </div>
      )}

      {verification && (
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
            }}
          >
            <strong>Verification URL</strong>

            <p
              style={{
                marginTop: "0.5rem",
                marginBottom: 0,
                overflowWrap: "anywhere",
                lineHeight: 1.7,
                color: "var(--foreground, #0b1e3a)",
              }}
            >
              {verificationUrl}
            </p>

            {verification.expires_at && (
              <p
                className="muted"
                style={{
                  marginTop: "0.75rem",
                  marginBottom: 0,
                  fontSize: "0.875rem",
                }}
              >
                {expired
                  ? "This link is expired."
                  : `Link expiry: ${new Intl.DateTimeFormat(
                      "en-NG",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                      },
                    ).format(
                      new Date(verification.expires_at),
                    )}`}
              </p>
            )}
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
              disabled={
                copying ||
                expired ||
                !origin
              }
            >
              {copying
                ? "Copying..."
                : "Copy Verification Link"}
            </button>

            <a
              href={
                canPreview
                  ? verificationPath
                  : undefined
              }
              target="_blank"
              rel="noopener noreferrer"
              className="rn-button"
              aria-disabled={!canPreview}
              onClick={(event) => {
                if (!canPreview) {
                  event.preventDefault();
                }
              }}
              style={{
                opacity: canPreview ? 1 : 0.55,
                cursor: canPreview
                  ? "pointer"
                  : "not-allowed",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Preview Public Passport
            </a>

            {(!expired || verification.is_active) && (
              <button
                type="button"
                className="rn-button"
                onClick={toggleVerification}
                disabled={
                  updating ||
                  creating ||
                  (expired && !verification.is_active)
                }
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
              marginTop: "1rem",
              marginBottom: 0,
              lineHeight: 1.7,
              fontSize: "0.9rem",
            }}
          >
            Public visibility depends on the
            information returned by the verification
            page. Private submissions, payment
            information, and account details should
            remain excluded from public responses.
          </p>
        </div>
      )}
    </section>
  );
}