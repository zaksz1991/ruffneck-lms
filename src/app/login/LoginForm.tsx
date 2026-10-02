"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/student/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          data?.error ||
            "Login failed. Please check your email and password."
        );
        return;
      }

      router.push(data?.next || next);
      router.refresh();
    } catch {
      setError(
        "Unable to connect to the login service. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="auth-box">
        <h1>Log in</h1>
        <p className="sub">Access your RuffNeck Learn account</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>

          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <div style={{ marginTop: -8, marginBottom: 16 }}>
            <Link
              href="/forgot-password"
              className="text-link"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 16 }}>
          No account? <Link href="/signup">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}
