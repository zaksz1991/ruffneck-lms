"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          data?.error ||
            "Unable to update your password. Please request a new reset link."
        );
        return;
      }

      setMessage(
        "Your password has been updated successfully. Redirecting to login…"
      );

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login?reset=success");
      }, 1500);
    } catch {
      setError(
        "Unable to connect to the password service. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="auth-box">
          <h1>Set a new password</h1>

          <p className="sub">
            Choose a new password for your RuffNeck Learn account.
          </p>

          {error && <div className="error">{error}</div>}

          {message && (
            <div
              style={{
                padding: "12px 14px",
                marginBottom: 16,
                borderRadius: 8,
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={onSubmit}>
            <label htmlFor="password">New password</label>

            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <p
              className="muted"
              style={{ fontSize: "0.85rem", marginTop: -8 }}
            >
              Use at least 8 characters.
            </p>

            <label htmlFor="confirm-password">
              Confirm new password
            </label>

            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>

          <p className="muted" style={{ marginTop: 16 }}>
            <Link href="/login">Back to login</Link>
          </p>
        </div>
      </div>
    </section>
  );
}