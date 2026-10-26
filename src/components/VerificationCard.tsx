"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";

type VerificationRecord = {
  id?: string;
  verification_code?: string | null;
  verificationCode?: string | null;
  code?: string | null;
  token?: string | null;
  verification_url?: string | null;
  public_url?: string | null;
  share_url?: string | null;
  url?: string | null;
  is_active?: boolean;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type BusyAction = "load" | "create" | "toggle" | "copy" | null;

const ENDPOINT = "/api/student/skill-passport/verification";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapVerification(
  payload: unknown,
  depth = 0
): VerificationRecord | null {
  if (!isObject(payload) || depth > 5) {
    return null;
  }

  const recordKeys = [
    "verification_code",
    "verificationCode",
    "public_url",
    "verification_url",
    "share_url",
    "is_active",
    "expires_at",
    "created_at",
    "token",
    "code",
  ];

  if (recordKeys.some((key) => key in payload)) {
    return payload as VerificationRecord;
  }

  for (const key of ["verification", "record", "data"]) {
    if (!(key in payload)) {
      continue;
    }

    const nested = payload[key];

    if (nested === null || nested === undefined) {
      continue;
    }

    const result = unwrapVerification(nested, depth + 1);

    if (result) {
      return result;
    }
  }

  return null;
}

function getErrorMessage(payload: unknown): string | null {
  if (!isObject(payload)) {
    return null;
  }

  for (const key of ["message", "error", "detail"]) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  if (isObject(payload.error)) {
    const nestedMessage = payload.error.message;

    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage.trim();
    }
  }

  return null;
}

function getPublicUrl(
  verification: VerificationRecord | null
): string | null {
  if (!verification) {
    return null;
  }

  const urlFields = [
    verification.verification_url,
    verification.public_url,
    verification.share_url,
    verification.url,
  ];

  for (const candidate of urlFields) {
    if (typeof candidate === "string" && candidate.trim()) {
      const value = candidate.trim();

      try {
        const base =
          typeof window !== "undefined"
            ? window.location.origin
            : "https://example.com";

        return new URL(value, base).toString();
      } catch {
        continue;
      }
    }
  }

  const codeFields = [
    verification.verification_code,
    verification.verificationCode,
    verification.code,
    verification.token,
  ];

  for (const candidate of codeFields) {
    if (typeof candidate === "string" && candidate.trim()) {
      const code = candidate.trim();

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      return `${origin}/verify/${encodeURIComponent(code)}`;
    }
  }

  return null;
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return "Not specified";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const styles: Record<string, CSSProperties> = {
  card: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #dce5ef",
    borderRadius: 18,
    background: "#ffffff",
    color: "#0b1e3a",
    padding: 24,
    boxShadow: "0 8px 28px rgba(11, 30, 58, 0.05)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: "0 0 7px",
    color: "#008da9",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: "#0b1e3a",
    fontSize: 22,
    lineHeight: 1.3,
    fontWeight: 800,
  },
  description: {
    margin: "9px 0 0",
    maxWidth: 620,
    color: "#5b6b80",
    fontSize: 14,
    lineHeight: 1.7,
  },
  status: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    flexShrink: 0,
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  divider: {
    height: 1,
    border: 0,
    background: "#e8eef5",
    margin: "22px 0",
  },
  informationBox: {
    padding: 16,
    border: "1px solid #dfe9f2",
    background: "#f7fafc",
    borderRadius: 13,
  },
  infoLabel: {
    margin: "0 0 6px",
    color: "#617187",
    fontSize: 12,
    fontWeight: 700,
  },
  infoValue: {
    margin: 0,
    color: "#0b1e3a",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
  url: {
    display: "block",
    marginTop: 7,
    color: "#007f9a",
    fontSize: 13,
    lineHeight: 1.6,
    overflowWrap: "anywhere",
    textDecoration: "underline",
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 17,
  },
  primaryButton: {
    appearance: "none",
    border: "1px solid #00b4d8",
    borderRadius: 10,
    background: "#00b4d8",
    color: "#06263b",
    fontSize: 13,
    fontWeight: 800,
    padding: "11px 16px",
    cursor: "pointer",
    minHeight: 42,
  },
  secondaryButton: {
    appearance: "none",
    border: "1px solid #d1dce8",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0b1e3a",
    fontSize: 13,
    fontWeight: 750,
    padding: "10px 15px",
    cursor: "pointer",
    minHeight: 42,
  },
  warningButton: {
    appearance: "none",
    border: "1px solid #f1d6a0",
    borderRadius: 10,
    background: "#fff8e7",
    color: "#8a5300",
    fontSize: 13,
    fontWeight: 750,
    padding: "10px 15px",
    cursor: "pointer",
    minHeight: 42,
  },
  alert: {
    marginTop: 16,
    padding: "12px 14px",
    border: "1px solid #f2c8c8",
    borderRadius: 10,
    background: "#fff5f5",
    color: "#a52323",
    fontSize: 13,
    lineHeight: 1.6,
  },
  success: {
    marginTop: 16,
    padding: "12px 14px",
    border: "1px solid #bde5cf",
    borderRadius: 10,
    background: "#f0fbf5",
    color: "#17633c",
    fontSize: 13,
    lineHeight: 1.6,
  },
  note: {
    margin: "16px 0 0",
    color: "#708096",
    fontSize: 12,
    lineHeight: 1.7,
  },
};

export default function VerificationCard() {
  const [verification, setVerification] =
    useState<VerificationRecord | null>(null);

  const [busyAction, setBusyAction] = useState<BusyAction>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadVerification = useCallback(
    async (showLoading = true): Promise<void> => {
      if (showLoading) {
        setBusyAction("load");
      }

      setError("");
      setNotice("");

      try {
        const response = await fetch(ENDPOINT, {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const payload: unknown = await response
          .json()
          .catch(() => null);

        if (response.status === 404) {
          setVerification(null);
          return;
        }

        if (!response.ok) {
          throw new Error(
            getErrorMessage(payload) ||
              "Unable to load your verification link."
          );
        }

        setVerification(unwrapVerification(payload));
      } catch (cause: unknown) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load your verification link."
        );
      } finally {
        if (showLoading) {
          setBusyAction(null);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadVerification();
  }, [loadVerification]);

  async function createVerification(): Promise<void> {
    setBusyAction("create");
    setError("");
    setNotice("");

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload: unknown = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload) ||
            "Unable to create your verification link."
        );
      }

      const created = unwrapVerification(payload);

      if (created) {
        setVerification(created);
        setNotice("Your Skill Passport verification link is ready.");
      } else {
        await loadVerification(false);
        setNotice(
          "The request completed. Your verification status has been refreshed."
        );
      }
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create your verification link."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleVerification(): Promise<void> {
    if (!verification) {
      return;
    }

    const currentlyActive = verification.is_active !== false;
    const desiredActive = !currentlyActive;

    setBusyAction("toggle");
    setError("");
    setNotice("");

    try {
      const response = await fetch(ENDPOINT, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: desiredActive,
        }),
      });

      const payload: unknown = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload) ||
            "Unable to update your verification status."
        );
      }

      const updated = unwrapVerification(payload);

      if (updated) {
        setVerification(updated);
      } else {
        setVerification((current) =>
          current
            ? {
                ...current,
                is_active: desiredActive,
              }
            : current
        );
      }

      setNotice(
        desiredActive
          ? "Your verification link has been activated."
          : "Your verification link has been deactivated."
      );
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update your verification status."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function copyVerificationLink(): Promise<void> {
    const publicUrl = getPublicUrl(verification);

    if (!publicUrl) {
      setError(
        "A public verification URL is not available for this record."
      );
      return;
    }

    setBusyAction("copy");
    setError("");
    setNotice("");

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(
          "Clipboard access is unavailable. Open the link and copy it from your browser."
        );
      }

      await navigator.clipboard.writeText(publicUrl);
      setNotice("Verification link copied to your clipboard.");
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to copy the verification link."
      );
    } finally {
      setBusyAction(null);
    }
  }

  const publicUrl = getPublicUrl(verification);
  const isActive = verification?.is_active !== false;
  const isBusy = busyAction !== null;

  const statusStyle: CSSProperties = verification
    ? isActive
      ? {
          color: "#17633c",
          background: "#eaf8ef",
        }
      : {
          color: "#8a5300",
          background: "#fff4dc",
        }
    : {
        color: "#5b6b80",
        background: "#edf2f7",
      };

  return (
    <section style={styles.card} aria-labelledby="verification-card-title">
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>RuffNeck Learn · Skill Passport</p>

          <h2 id="verification-card-title" style={styles.title}>
            Public verification
          </h2>

          <p style={styles.description}>
            Share a verification link so an employer or reviewer can check
            your Skill Passport. A confidence score by itself is not proof
            of verified practical work.
          </p>
        </div>

        <span style={{ ...styles.status, ...statusStyle }}>
          <span aria-hidden="true">
            {verification ? (isActive ? "●" : "●") : "○"}
          </span>
          {!verification
            ? "Not created"
            : isActive
              ? "Active"
              : "Inactive"}
        </span>
      </div>

      <hr style={styles.divider} />

      {busyAction === "load" && !verification ? (
        <div style={styles.informationBox} aria-live="polite">
          <p style={styles.infoValue}>Loading verification status…</p>
        </div>
      ) : null}

      {verification ? (
        <>
          <div style={styles.informationBox}>
            <p style={styles.infoLabel}>Verification link</p>

            {publicUrl ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                style={styles.url}
              >
                {publicUrl}
              </a>
            ) : (
              <p style={styles.infoValue}>
                A link has not been returned by the verification service.
              </p>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 15,
                marginTop: 20,
              }}
            >
              <div>
                <p style={styles.infoLabel}>Created</p>
                <p style={styles.infoValue}>
                  {formatDate(verification.created_at)}
                </p>
              </div>

              <div>
                <p style={styles.infoLabel}>Expires</p>
                <p style={styles.infoValue}>
                  {verification.expires_at
                    ? formatDate(verification.expires_at)
                    : "No expiry provided"}
                </p>
              </div>
            </div>
          </div>

          <div style={styles.buttonRow}>
            <button
              type="button"
              style={{
                ...styles.primaryButton,
                opacity: isBusy || !publicUrl ? 0.6 : 1,
                cursor: isBusy || !publicUrl ? "not-allowed" : "pointer",
              }}
              onClick={() => void copyVerificationLink()}
              disabled={isBusy || !publicUrl}
            >
              {busyAction === "copy" ? "Copying…" : "Copy verification link"}
            </button>

            <button
              type="button"
              style={
                isActive
                  ? styles.warningButton
                  : styles.secondaryButton
              }
              onClick={() => void toggleVerification()}
              disabled={isBusy}
            >
              {busyAction === "toggle"
                ? "Updating…"
                : isActive
                  ? "Deactivate link"
                  : "Activate link"}
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => void loadVerification()}
              disabled={isBusy}
            >
              Refresh
            </button>
          </div>

          <p style={styles.note}>
            Deactivating this link is intended to stop public access through
            the verification service. Reactivating it does not create a new
            verification record.
          </p>
        </>
      ) : (
        <>
          <div style={styles.informationBox}>
            <p style={styles.infoValue}>
              {busyAction === "load"
                ? "Checking whether a verification link exists."
                : "You have not created a public verification link yet."}
            </p>

            <p style={styles.description}>
              Create a link when you are ready to share your learning record.
              Only evidence that meets the platform’s verification rules
              should be represented as verified.
            </p>
          </div>

          <div style={styles.buttonRow}>
            <button
              type="button"
              style={{
                ...styles.primaryButton,
                opacity: isBusy ? 0.6 : 1,
                cursor: isBusy ? "not-allowed" : "pointer",
              }}
              onClick={() => void createVerification()}
              disabled={isBusy}
            >
              {busyAction === "create"
                ? "Creating verification link…"
                : "Create verification link"}
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => void loadVerification()}
              disabled={isBusy}
            >
              Refresh
            </button>
          </div>
        </>
      )}

      {error ? (
        <div role="alert" style={styles.alert}>
          <strong>Action unsuccessful.</strong> {error}
        </div>
      ) : null}

      {notice ? (
        <div role="status" style={styles.success}>
          {notice}
        </div>
      ) : null}
    </section>
  );
}