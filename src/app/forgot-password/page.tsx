"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          data?.error ||
            "Unable to process your password reset request."
        );
        return;
      }

      setMessage(
        "If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder."
      );
    } catch {
      setError(
        "Unable to connect to the password reset service. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="auth-box">
          <h1>Forgot password?</h1>

          <p className="sub">
            Enter the email address associated with your RuffNeck Learn
            account.
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
            <label htmlFor="email">Email</label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <p className="muted" style={{ marginTop: 16 }}>
            Remember your password?{" "}
            <Link href="/login">Back to login</Link>
          </p>
        </div>
      </div>
    </section>
  );
}