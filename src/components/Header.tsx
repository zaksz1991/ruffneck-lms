"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "student" | "instructor" | "admin" | null;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<Role>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      setLoading(true);

      try {
        const supabase = createClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (authError || !user) {
          setIsAuthenticated(false);
          setRole(null);
          return;
        }

        setIsAuthenticated(true);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError) {
          console.error(
            "Unable to load profile role:",
            profileError.message,
          );

          // Never grant administrator or instructor navigation
          // when the account role cannot be verified.
          setRole(null);
          return;
        }

        const profileRole = profile?.role;

        if (
          profileRole === "admin" ||
          profileRole === "instructor" ||
          profileRole === "student"
        ) {
          setRole(profileRole);
        } else {
          setRole(null);
        }
      } catch (error) {
        if (mounted) {
          console.error("Unable to load authenticated user:", error);
          setIsAuthenticated(false);
          setRole(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setSignOutError(error.message);
        return;
      }

      setRole(null);
      setIsAuthenticated(false);

      router.replace("/");
      router.refresh();
    } catch (error) {
      setSignOutError(
        error instanceof Error
          ? error.message
          : "Unable to sign out. Please try again.",
      );
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      {/* Parent company branding */}
      <div className="rn-parent-brand">
        <div className="rn-parent-brand-inner">
          <Link
            href="https://ruffneck-entertainment.vercel.app/"
            className="rn-parent-brand-link"
          >
            <strong>RUFFNECK ENTERTAINMENT</strong>

            <span>
              Practical AI &amp; digital systems for Nigerian professionals
            </span>
          </Link>

          <Link
            href="https://ruffneck-entertainment.vercel.app/"
            className="rn-parent-brand-visit"
          >
            Visit RuffNeck Entertainment
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
      </div>

      {/* Main navigation */}
      <header className="site-header">
        <div className="inner">
          <div className="brand">
            <Link
              href="/"
              className="brand-link"
              aria-label="RuffNeck Learn homepage"
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

            <Link href="/" className="brand-name">
              <strong>RuffNeck Learn</strong>

              <span>
                Practical AI &amp; digital systems for Nigerian professionals
              </span>
            </Link>
          </div>

          <nav
            className="nav"
            aria-label="Main navigation"
            aria-busy={loading}
          >
            <Link href="/courses" className="rn-nav-button">
              Courses
            </Link>

            {loading ? (
              <span className="rn-nav-loading" aria-live="polite">
                Loading account…
              </span>
            ) : isAuthenticated ? (
              <>
                <Link
                  href="/student/courses"
                  className="rn-nav-button"
                >
                  My Learning
                </Link>

                <Link
                  href="/student/scan"
                  className="rn-nav-button"
                >
                  Scan &amp; Learn
                </Link>

                <Link
                  href="/student/practical-work"
                  className="rn-nav-button"
                >
                  Practical Work
                </Link>

                <Link
                  href="/student/labs"
                  className="rn-nav-button rn-labs-nav-button"
                >
                  <span aria-hidden="true">✦</span>
                  Practical Labs
                </Link>

                <Link
                  href="/student/skill-passport"
                  className="rn-nav-button"
                >
                  Skill Passport
                </Link>

                <Link
                  href="/student/ai-drafts"
                  className="rn-nav-button"
                >
                  My AI Drafts
                </Link>

                <Link
                  href="/student/payments"
                  className="rn-nav-button"
                >
                  Payment History
                </Link>

                <Link
                  href="/student/assessment/results"
                  className="rn-nav-button"
                >
                  Assessment Results
                </Link>

                <Link
                  href="/student/certificates"
                  className="rn-nav-button"
                >
                  Certificates
                </Link>

                {role === "instructor" && (
                  <Link
                    href="/admin/lms"
                    className="rn-nav-button rn-role-link rn-role-link--instructor"
                  >
                    Instructor
                  </Link>
                )}

                {role === "admin" && (
                  <Link
                    href="/admin/lms"
                    className="rn-nav-button rn-role-link rn-role-link--admin"
                  >
                    Admin
                  </Link>
                )}

                <button
                  type="button"
                  className="rn-nav-button rn-signout-button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  aria-busy={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rn-nav-button"
                >
                  Log in
                </Link>

                <Link
                  href="/signup"
                  className="rn-nav-button rn-signup-button"
                >
                  Create Account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {signOutError && (
        <div className="rn-signout-error" role="alert">
          Sign out failed: {signOutError}
        </div>
      )}
    </>
  );
}

export default Header;