"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role =
  | "student"
  | "instructor"
  | "admin"
  | null;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      const profileRole =
        profile?.role === "admin" ||
        profile?.role === "instructor" ||
        profile?.role === "student"
          ? profile.role
          : "student";

      setRole(profileRole);
      setLoading(false);
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  const isAuthenticated = role !== null;

  const canAccessAdmin =
    role === "admin" ||
    role === "instructor";

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setSignOutError("");

    try {
      const supabase = createClient();

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        setSignOutError(error.message);
        setSigningOut(false);
        return;
      }

      setRole(null);

      router.replace("/");
      router.refresh();
    } catch (error) {
      setSignOutError(
        error instanceof Error
          ? error.message
          : "Unable to sign out.",
      );

      setSigningOut(false);
    }
  }

  return (
    <>
      <div className="rn-parent-brand">
        <div className="rn-parent-brand-inner">
          <Link
            href="https://ruffneck-entertainment.vercel.app/"
            className="rn-parent-brand-link"
          >
            <strong>
              RUFFNECK ENTERTAINMENT
            </strong>

            <span>
              Practical AI &amp; digital systems
              for Nigerian professionals
            </span>
          </Link>

          <Link
            href="https://ruffneck-entertainment.vercel.app/"
            className="rn-parent-brand-visit"
          >
            Visit RuffNeck Entertainment →
          </Link>
        </div>
      </div>

      <header className="site-header">
        <div className="inner">
          <div className="brand">
            <Link
              href="/"
              className="brand-link"
              aria-label="RuffNeck Learn"
            >
              <Image
                src="/brand/ruffneck-logo.png"
                alt="RuffNeck Entertainment"
                width={160}
                height={60}
                className="brand-logo"
                priority
              />
            </Link>

            <Link
              href="/"
              className="brand-name"
            >
              <strong>
                RuffNeck Learn
              </strong>

              <span>
                Practical AI &amp; digital systems
                for Nigerian professionals
              </span>
            </Link>
          </div>

          <nav
            className="nav"
            aria-label="Main navigation"
          >
            <Link href="/courses">
              Courses
            </Link>

            {loading ? null : isAuthenticated ? (
              <>
                <Link href="/student/courses">
                  My learning
                </Link>

                <Link href="/student/scan">
                  Scan &amp; Learn
                </Link>

                <Link href="/student/practical-work">
                  Practical Work
                </Link>

                <Link href="/student/skill-passport">
                  Skill Passport
                </Link>

                <Link href="/student/ai-drafts">
                  My AI Drafts
                </Link>

                <Link href="/student/payments">
                  Payment History
                </Link>

                <Link href="/student/assessment/results">
                  Assessment Results
                </Link>

                <Link href="/student/certificates">
                  Certificates
                </Link>

                {canAccessAdmin ? (
                  <Link
                    href="/admin/lms"
                    className="rn-admin-link"
                  >
                    Admin
                  </Link>
                ) : null}

                <button
                  type="button"
                  className="nav-button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut
                    ? "Signing out..."
                    : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  Log in
                </Link>

                <Link
                  href="/signup"
                  className="rn-signup-link"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {signOutError && (
        <div
          role="alert"
          style={{
            maxWidth: 1200,
            margin: "10px auto",
            padding: "10px 16px",
            color: "#991b1b",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          Sign out failed: {signOutError}
        </div>
      )}
    </>
  );
}

export default Header;