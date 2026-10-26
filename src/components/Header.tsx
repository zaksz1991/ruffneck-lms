"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    setMobileMenuOpen(false);
    setMoreMenuOpen(false);

    async function loadUser() {
      setLoading(true);

      try {
        const supabase = createClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!mounted) {
          return;
        }

        if (authError || !user) {
          setIsAuthenticated(false);
          setRole(null);
          return;
        }

        setIsAuthenticated(true);

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) {
          return;
        }

        if (profileError) {
          console.error(
            "Unable to load profile role:",
            profileError.message,
          );

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
          console.error(
            "Unable to load authenticated user:",
            error,
          );

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

  useEffect(() => {
    if (!moreMenuOpen) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      if (
        moreMenuRef.current &&
        event.target instanceof Node &&
        !moreMenuRef.current.contains(event.target)
      ) {
        setMoreMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );

      document.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [moreMenuOpen]);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

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
      setMobileMenuOpen(false);
      setMoreMenuOpen(false);

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

  const dashboardHref =
    role === "instructor"
      ? "/instructor/dashboard"
      : role === "admin"
        ? "/admin/lms"
        : "/student/dashboard";

  function navLinkClass(
    href: string,
    extraClass = "",
  ) {
    const active =
      href !== "#" &&
      (
        pathname === href ||
        pathname.startsWith(`${href}/`)
      );

    return [
      styles.navLink,
      active ? styles.activeLink : "",
      extraClass,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function closeMenus() {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
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
              Practical AI &amp; digital systems for
              Nigerian professionals
            </span>
          </Link>

          <Link
            href="https://ruffneck-entertainment.vercel.app/"
            className={styles.parentVisit}
          >
            Visit RuffNeck Entertainment
            <span aria-hidden="true"> →</span>
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
              onClick={closeMenus}
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

            <Link
              href="/"
              className={styles.brandName}
              onClick={closeMenus}
            >
              <strong className={styles.brandTitle}>
                RuffNeck Learn
              </strong>

              <span className={styles.brandSubtitle}>
                Practical AI &amp; digital systems
                for Nigerian professionals
              </span>
            </Link>
          </div>

          <button
            type="button"
            className={styles.mobileMenuToggle}
            onClick={() =>
              setMobileMenuOpen((current) => !current)
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="rn-primary-navigation"
            aria-label={
              mobileMenuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
          >
            <span />
            <span />
            <span />
          </button>

          <nav
            id="rn-primary-navigation"
            className={[
              styles.nav,
              mobileMenuOpen ? styles.navOpen : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Main navigation"
            aria-busy={loading}
          >
            <Link
              href="/courses"
              className={navLinkClass("/courses")}
              onClick={closeMenus}
            >
              Courses
            </Link>

            {loading ? (
              <span
                className={styles.loading}
                aria-live="polite"
              >
                Loading account…
              </span>
            ) : isAuthenticated ? (
              <>
                <Link
                  href={dashboardHref}
                  className={navLinkClass(dashboardHref)}
                  onClick={closeMenus}
                >
                  Dashboard
                </Link>

                <Link
                  href="/student/courses"
                  className={navLinkClass("/student/courses")}
                  onClick={closeMenus}
                >
                  My Learning
                </Link>

                <Link
                  href="/student/practical-work"
                  className={navLinkClass(
                    "/student/practical-work",
                  )}
                  onClick={closeMenus}
                >
                  Practical Work
                </Link>

                <Link
                  href="/student/skill-passport"
                  className={navLinkClass(
                    "/student/skill-passport",
                  )}
                  onClick={closeMenus}
                >
                  Skill Passport
                </Link>

                <div
                  className={styles.moreWrapper}
                  ref={moreMenuRef}
                >
                  <button
                    type="button"
                    className={[
                      styles.navLink,
                      styles.moreButton,
                      moreMenuOpen ? styles.moreButtonActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      setMoreMenuOpen((current) => !current);
                    }}
                    aria-expanded={moreMenuOpen}
                    aria-haspopup="true"
                    aria-controls="rn-more-menu"
                  >
                    More

                    <span
                      className={[
                        styles.chevron,
                        moreMenuOpen ? styles.chevronOpen : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                  </button>

                  {moreMenuOpen && (
                    <div
                      id="rn-more-menu"
                      className={styles.moreMenu}
                      aria-label="Additional navigation"
                    >
                      <span className={styles.menuSectionLabel}>
                        YOUR LEARNING
                      </span>

                      <Link
                        href="/account/profile"
                        className={styles.menuLink}
                        onClick={closeMenus}
                      >
                        <span className={styles.menuIcon}>
                          ◉
                        </span>

                        <span>
                          <strong>My Profile</strong>
                          <small>
                            Manage your account details
                          </small>
                        </span>
                      </Link>

                      <Link
                        href="/student/scan"
                        className={styles.menuLink}
                        onClick={closeMenus}
                      >
                        <span className={styles.menuIcon}>
                          ▦
                        </span>

                        <span>
                          <strong>Scan &amp; Learn</strong>
                          <small>
                            Access learning resources
                          </small>
                        </span>
                      </Link>

                      <Link
                        href="/student/labs"
                        className={styles.menuLink}
                        onClick={closeMenus}
                      >
                        <span className={styles.menuIcon}>
                          ✦
                        </span>

                        <span>
                          <strong>Practical Labs</strong>
                          <small>
                            Work through applied exercises
                          </small>
                        </span>
                      </Link>

                      <Link
                        href="/student/ai-drafts"
                        className={styles.menuLink}
                        onClick={closeMenus}
                      >
                        <span className={styles.menuIcon}>
                          ✧
                        </span>

                        <span>
                          <strong>My AI Drafts</strong>
                          <small>
                            Return to your saved drafts
                          </small>
                        </span>
                      </Link>

                      <div className={styles.menuDivider} />

                      <span className={styles.menuSectionLabel}>
                        PROGRESS &amp; RECORDS
                      </span>

                      <Link
                        href="/student/payments"
                        className={styles.menuLink}
                        onClick={closeMenus}
                      >
                        <span className={styles.menuIcon}>
                          ₦
                        </span>

                        <span>
                          <strong>Payment History</strong>
                          <small>
                            Review your transactions
                          </small>
                        </span>
                      </Link>

                      <Link
                        href="/student/assessment/results"
                        className={styles.menuLink}
                        onClick={closeMenus}
                      >
                        <span className={styles.menuIcon}>
                          ✓
                        </span>

                        <span>
                          <strong>Assessment Results</strong>
                          <small>
                            Review assessment performance
                          </small>
                        </span>
                      </Link>

                      <Link
                        href="/student/certificates"
                        className={styles.menuLink}
                        onClick={closeMenus}
                      >
                        <span className={styles.menuIcon}>
                          ▤
                        </span>

                        <span>
                          <strong>Certificates</strong>
                          <small>
                            View and verify credentials
                          </small>
                        </span>
                      </Link>

                      {(role === "instructor" ||
                        role === "admin") && (
                        <>
                          <div className={styles.menuDivider} />

                          <span className={styles.menuSectionLabel}>
                            MANAGEMENT
                          </span>

                          <Link
                            href="/admin/lms"
                            className={styles.menuLink}
                            onClick={closeMenus}
                          >
                            <span className={styles.menuIcon}>
                              ◫
                            </span>

                            <span>
                              <strong>
                                {role === "admin"
                                  ? "Admin Workspace"
                                  : "Instructor Workspace"}
                              </strong>

                              <small>
                                Manage learning activities
                              </small>
                            </span>
                          </Link>

                          <Link
                            href="/admin/labs"
                            className={styles.menuLink}
                            onClick={closeMenus}
                          >
                            <span className={styles.menuIcon}>
                              ◈
                            </span>

                            <span>
                              <strong>Review Labs</strong>
                              <small>
                                Review practical lab work
                              </small>
                            </span>
                          </Link>

                          {role === "admin" && (
                            <Link
                              href="/admin/practical-work"
                              className={styles.menuLink}
                              onClick={closeMenus}
                            >
                              <span className={styles.menuIcon}>
                                ☷
                              </span>

                              <span>
                                <strong>
                                  Practical Work Review
                                </strong>

                                <small>
                                  Review learner submissions
                                </small>
                              </span>
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className={[
                    styles.navLink,
                    styles.signOut,
                  ].join(" ")}
                  onClick={handleSignOut}
                  disabled={signingOut}
                  aria-busy={signingOut}
                >
                  {signingOut
                    ? "Signing out…"
                    : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={navLinkClass("/login")}
                  onClick={closeMenus}
                >
                  Log in
                </Link>

                <Link
                  href="/signup"
                  className={navLinkClass(
                    "/signup",
                    styles.signUp,
                  )}
                  onClick={closeMenus}
                >
                  Create Account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {signOutError && (
        <div
          className={styles.signOutError}
          role="alert"
        >
          Sign out failed: {signOutError}
        </div>
      )}
    </>
  );
}

export default Header;