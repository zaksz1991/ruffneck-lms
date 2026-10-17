"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./Header.module.css";

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
          console.error("Unable to load profile role:", profileError.message);
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
        if (mounted) setLoading(false);
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
      <div className={styles.parentBar}>
        <div className={styles.parentInner}>
          <Link
            href="https://ruffneck-entertainment.vercel.app/"
            className={styles.parentBrand}
          >
            <strong className={styles.parentCompany}>
              RUFFNECK ENTERTAINMENT
            </strong>
            <span className={styles.parentTagline}>
              Practical AI &amp; digital systems for Nigerian professionals
            </span>
          </Link>

          <Link
            href="https://ruffneck-entertainment.vercel.app/"
            className={styles.parentVisit}
          >
            Visit RuffNeck Entertainment <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <header className={styles.mainHeader}>
        <div className={styles.mainInner}>
          <div className={styles.brand}>
            <Link
              href="/"
              className={styles.logoLink}
              aria-label="RuffNeck Learn homepage"
            >
              <Image
                src="/brand/ruffneck-logo.png"
                alt="RuffNeck Entertainment"
                width={160}
                height={60}
                className={styles.logo}
                priority
              />
            </Link>

            <Link href="/" className={styles.brandName}>
              <strong className={styles.brandTitle}>RuffNeck Learn</strong>
              <span className={styles.brandSubtitle}>
                Practical AI &amp; digital systems for Nigerian professionals
              </span>
            </Link>
          </div>

          <nav
            className={styles.nav}
            aria-label="Main navigation"
            aria-busy={loading}
          >
            <Link href="/courses" className={styles.navLink}>
              Courses
            </Link>

            {loading ? (
              <span className={styles.loading} aria-live="polite">
                Loading account…
              </span>
            ) : isAuthenticated ? (
              <>
                <Link href="/student/courses" className={styles.navLink}>
                  My Learning
                </Link>
                <Link href="/student/scan" className={styles.navLink}>
                  Scan &amp; Learn
                </Link>
                <Link href="/student/practical-work" className={styles.navLink}>
                  Practical Work
                </Link>
                <Link href="/student/labs" className={`${styles.navLink} ${styles.labsLink}`}>
                  <span aria-hidden="true">✦</span> Practical Labs
                </Link>
                <Link href="/student/skill-passport" className={styles.navLink}>
                  Skill Passport
                </Link>
                <Link href="/student/ai-drafts" className={styles.navLink}>
                  My AI Drafts
                </Link>
                <Link href="/student/payments" className={styles.navLink}>
                  Payment History
                </Link>
                <Link href="/student/assessment/results" className={styles.navLink}>
                  Assessment Results
                </Link>
                <Link href="/student/certificates" className={styles.navLink}>
                  Certificates
                </Link>

                {role === "instructor" && (
                  <Link
                    href="/admin/lms"
                    className={`${styles.navLink} ${styles.instructorLink}`}
                  >
                    Instructor
                  </Link>
                )}

                {role === "admin" && (
                  <Link
                    href="/admin/lms"
                    className={`${styles.navLink} ${styles.adminLink}`}
                  >
                    Admin
                  </Link>
                )}

                <button
                  type="button"
                  className={`${styles.navLink} ${styles.signOut}`}
                  onClick={handleSignOut}
                  disabled={signingOut}
                  aria-busy={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={styles.navLink}>
                  Log in
                </Link>
                <Link href="/signup" className={`${styles.navLink} ${styles.signUp}`}>
                  Create Account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {signOutError && (
        <div className={styles.signOutError} role="alert">
          Sign out failed: {signOutError}
        </div>
      )}
    </>
  );
}

export default Header;
