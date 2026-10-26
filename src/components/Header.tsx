"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./Header.module.css";

type NavItem = {
  href: string;
  label: string;
  description?: string;
};

type MenuSection = {
  heading: string;
  items: NavItem[];
};

const learningItems: NavItem[] = [
  {
    href: "/account/profile",
    label: "My Profile",
    description: "Manage your account details",
  },
  {
    href: "/student/scan",
    label: "Scan & Learn",
    description: "Access learning resources",
  },
  {
    href: "/student/labs",
    label: "Practical Labs",
    description: "Work through applied exercises",
  },
  {
    href: "/student/ai-drafts",
    label: "My AI Drafts",
    description: "Return to your saved drafts",
  },
];

const recordItems: NavItem[] = [
  {
    href: "/student/payments",
    label: "Payment History",
    description: "Review your transactions",
  },
  {
    href: "/student/assessment/results",
    label: "Assessment Results",
    description: "Review assessment performance",
  },
  {
    href: "/student/certificates",
    label: "Certificates",
    description: "View and verify credentials",
  },
];

const managementItems: NavItem[] = [
  {
    href: "/admin/lms",
    label: "Admin Workspace",
    description: "Manage learning activities",
  },
  {
    href: "/admin/labs",
    label: "Review Labs",
    description: "Review practical lab work",
  },
  {
    href: "/admin/practical-work",
    label: "Practical Work Review",
    description: "Review learner submissions",
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);
  const moreRef = useRef<HTMLDivElement>(null);

  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isManagement =
    role === "admin" || role === "instructor";

  const dashboardHref = isManagement
    ? "/admin/lms"
    : "/student/dashboard";

  const primaryItems: NavItem[] = [
    { href: "/courses", label: "Courses" },
    ...(authenticated
      ? [
          {
            href: dashboardHref,
            label: "Dashboard",
          },
          {
            href: "/student/courses",
            label: "My Learning",
          },
          {
            href: "/student/practical-work",
            label: "Practical Work",
          },
          {
            href: "/student/skill-passport",
            label: "Skill Passport",
          },
        ]
      : []),
  ];

  const menuSections: MenuSection[] = [
    {
      heading: "Your learning",
      items: learningItems,
    },
    {
      heading: "Progress & records",
      items: recordItems,
    },
    ...(isManagement
      ? [
          {
            heading: "Management",
            items: managementItems,
          },
        ]
      : []),
  ];

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !user) {
          setAuthenticated(false);
          setRole(null);
          return;
        }

        setAuthenticated(true);

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        setRole(
          typeof profile?.role === "string"
            ? profile.role.toLowerCase()
            : null,
        );
      } catch {
        if (!active) return;

        setAuthenticated(false);
        setRole(null);
      } finally {
        if (active) {
          setAuthChecked(true);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [pathname, supabase]);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        moreRef.current &&
        !moreRef.current.contains(event.target as Node)
      ) {
        setMoreOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

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
  }, []);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      await supabase.auth.signOut();

      setAuthenticated(false);
      setRole(null);
      setMobileOpen(false);
      setMoreOpen(false);

      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  function closeMenus() {
    setMobileOpen(false);
    setMoreOpen(false);
  }

  function renderNavLink(item: NavItem, mobile = false) {
    const active = isActivePath(pathname, item.href);

    return (
      <Link
        key={`${mobile ? "mobile" : "desktop"}-${item.href}`}
        href={item.href}
        className={[
          mobile ? styles.mobileLink : styles.navLink,
          active ? styles.activeLink : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-current={active ? "page" : undefined}
        onClick={closeMenus}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div className={styles.headerRoot}>
      {/* Compact company strip */}
      <div className={styles.parentBar}>
        <div className={styles.parentBarInner}>
          <Link
            className={styles.parentBrand}
            href="https://ruffneck-entertainment.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            RUFFNECK ENTERTAINMENT
          </Link>

          <span className={styles.parentTagline}>
            Practical AI & digital systems for Nigerian professionals
          </span>

          <Link
            className={styles.parentVisit}
            href="https://ruffneck-entertainment.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Main website
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>

      {/* RuffNeck Learn navigation */}
      <header className={styles.mainHeader}>
        <div className={styles.mainHeaderInner}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="RuffNeck Learn home"
            onClick={closeMenus}
          >
            <span className={styles.logoFrame}>
              <Image
                src="/brand/ruffneck-logo.png"
                alt="RuffNeck Learn logo"
                width={44}
                height={44}
                priority
                className={styles.logo}
              />
            </span>

            <span className={styles.brandCopy}>
              <span className={styles.brandName}>
                RuffNeck Learn
              </span>
              <span className={styles.brandCaption}>
                Practical learning. Real-world skills.
              </span>
            </span>
          </Link>

          <nav
            className={styles.desktopNav}
            aria-label="Main navigation"
          >
            {primaryItems.map((item) =>
              renderNavLink(item),
            )}

            {authenticated && (
              <div className={styles.moreWrapper} ref={moreRef}>
                <button
                  type="button"
                  className={[
                    styles.moreButton,
                    menuSections.some((section) =>
                      section.items.some((item) =>
                        isActivePath(pathname, item.href),
                      ),
                    )
                      ? styles.activeLink
                      : "",
                    moreOpen ? styles.moreButtonOpen : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-expanded={moreOpen}
                  aria-haspopup="true"
                  onClick={() => setMoreOpen((open) => !open)}
                >
                  More
                  <span
                    className={[
                      styles.chevron,
                      moreOpen ? styles.chevronUp : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden="true"
                  />
                </button>

                {moreOpen && (
                  <div className={styles.moreMenu}>
                    {menuSections.map((section) => (
                      <div
                        className={styles.menuSection}
                        key={section.heading}
                      >
                        <p className={styles.menuHeading}>
                          {section.heading}
                        </p>

                        {section.items.map((item) => {
                          const active = isActivePath(
                            pathname,
                            item.href,
                          );

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={[
                                styles.menuItem,
                                active
                                  ? styles.menuItemActive
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-current={
                                active ? "page" : undefined
                              }
                              onClick={closeMenus}
                            >
                              <span className={styles.menuItemTitle}>
                                {item.label}
                              </span>

                              {item.description && (
                                <span
                                  className={
                                    styles.menuItemDescription
                                  }
                                >
                                  {item.description}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    ))}

                    <div className={styles.menuFooter}>
                      <button
                        type="button"
                        className={styles.menuSignOut}
                        onClick={handleSignOut}
                        disabled={signingOut}
                      >
                        {signingOut ? "Signing out…" : "Sign out"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!authenticated && authChecked && (
              <Link
                href="/login"
                className={styles.signInButton}
              >
                Sign in
              </Link>
            )}

            {authenticated && (
              <button
                type="button"
                className={styles.desktopSignOut}
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            )}
          </nav>

          <button
            type="button"
            className={styles.mobileToggle}
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileOpen}
            aria-controls="ruffneck-mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span
              className={[
                styles.hamburgerLine,
                mobileOpen ? styles.hamburgerLineTopOpen : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
            <span
              className={[
                styles.hamburgerLine,
                mobileOpen ? styles.hamburgerLineMiddleOpen : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
            <span
              className={[
                styles.hamburgerLine,
                mobileOpen ? styles.hamburgerLineBottomOpen : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          </button>
        </div>

        {mobileOpen && (
          <nav
            id="ruffneck-mobile-navigation"
            className={styles.mobilePanel}
            aria-label="Mobile navigation"
          >
            <div className={styles.mobilePrimary}>
              {primaryItems.map((item) =>
                renderNavLink(item, true),
              )}
            </div>

            {authenticated &&
              menuSections.map((section) => (
                <div
                  className={styles.mobileSection}
                  key={section.heading}
                >
                  <p className={styles.mobileSectionHeading}>
                    {section.heading}
                  </p>

                  {section.items.map((item) =>
                    renderNavLink(item, true),
                  )}
                </div>
              ))}

            <div className={styles.mobileActions}>
              {authenticated ? (
                <button
                  type="button"
                  className={styles.mobileSignOut}
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              ) : (
                authChecked && (
                  <Link
                    href="/login"
                    className={styles.mobileSignIn}
                    onClick={closeMenus}
                  >
                    Sign in
                  </Link>
                )
              )}

              <Link
                href="https://ruffneck-entertainment.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mobileMainWebsite}
                onClick={closeMenus}
              >
                Visit RuffNeck Entertainment ↗
              </Link>
            </div>
          </nav>
        )}
      </header>
    </div>
  );
}