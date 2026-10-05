"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserRole =
  | "admin"
  | "instructor"
  | "student";

export default function Header() {
  const pathname = usePathname();

  const [isAuthenticated, setIsAuthenticated] =
    useState(false);
  const [role, setRole] =
    useState<UserRole | null>(null);
  const [authReady, setAuthReady] =
    useState(false);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(path);
  };

  const canAccessAdmin =
    role === "admin" ||
    role === "instructor";

  useEffect(() => {
    const supabase = createClient();

    let mounted = true;

    async function loadAuthState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (!user) {
        setIsAuthenticated(false);
        setRole(null);
        setAuthReady(true);
        return;
      }

      setIsAuthenticated(true);

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (!mounted) {
        return;
      }

      const nextRole =
        profile?.role === "admin" ||
        profile?.role === "instructor" ||
        profile?.role === "student"
          ? (profile.role as UserRole)
          : null;

      setRole(nextRole);
      setAuthReady(true);
    }

    void loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      () => {
        window.setTimeout(() => {
          void loadAuthState();
        }, 0);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <div className="rn-parent-brand">
        <div className="rn-parent-brand-inner">
          <div className="rn-parent-copy">
            <span className="rn-parent-kicker">
              RUFFNECK ENTERTAINMENT
            </span>

            <span className="rn-parent-description">
              Practical AI &amp; digital systems for
              Nigerian professionals
            </span>
          </div>

          <a
            href="https://ruffneck-entertainment.vercel.app/"
            className="rn-parent-link"
          >
            Visit RuffNeck Entertainment →
          </a>
        </div>
      </div>

      <header className="site-header">
        <div className="inner">
          <Link
            href="/"
            className="brand"
            aria-label="RuffNeck Learn home"
          >
            <Image
              src="/brand/ruffneck-logo.png"
              alt="RuffNeck Entertainment"
              width={140}
              height={70}
              className="brand-logo"
              priority
            />

            <span className="brand-copy">
              <strong>RuffNeck</strong>
              <span>Learn</span>
            </span>
          </Link>

          <nav
            className="nav"
            aria-label="Main navigation"
          >
            <Link
              href="/courses"
              className={
                isActive("/courses")
                  ? "active"
                  : ""
              }
            >
              Courses
            </Link>

            {authReady && isAuthenticated ? (
              <>
                <Link
                  href="/student/dashboard"
                  className={
                    isActive(
                      "/student/dashboard"
                    )
                      ? "active"
                      : ""
                  }
                >
                  My learning
                </Link>

                <Link
                  href="/student/scan"
                  className={
                    isActive("/student/scan")
                      ? "active"
                      : ""
                  }
                >
                  Scan &amp; Learn
                </Link>

                <Link
                  href="/student/ai-drafts"
                  className={
                    isActive(
                      "/student/ai-drafts"
                    )
                      ? "active"
                      : ""
                  }
                >
                  My AI Drafts
                </Link>

                {canAccessAdmin ? (
                  <Link
                    href="/admin/lms"
                    className={
                      isActive("/admin")
                        ? "active"
                        : ""
                    }
                    aria-label="Admin"
                  >
                    Admin
                  </Link>
                ) : null}

                <form
                  action="/api/auth/logout"
                  method="post"
                  className="rn-signout-form"
                >
                  <button
                    type="submit"
                    className="nav-button rn-nav-button"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : authReady ? (
              <>
                <Link
                  href="/login"
                  className={
                    isActive("/login")
                      ? "active"
                      : ""
                  }
                >
                  Log in
                </Link>

                <Link
                  href="/register"
                  className="rn-signup-button"
                >
                  Sign up
                </Link>
              </>
            ) : null}
          </nav>
        </div>

        <div className="rn-header-learning-banner">
          <Link
            href="/courses"
            aria-label="Explore RuffNeck Learn courses"
          >
            <Image
              src="/brand/ruffneck-learn-banner.png"
              alt="RuffNeck Learn — Learn, Build, Grow"
              width={1600}
              height={360}
              className="rn-header-learning-banner-image"
              priority
            />

            <div className="rn-header-banner-overlay">
              <div>
                <span className="rn-header-banner-kicker">
                  RUFFNECK LEARN
                </span>

                <strong>
                  Practical AI &amp; Digital Skills
                </strong>

                <span>
                  Learn • Build • Grow
                </span>
              </div>

              <span className="rn-header-banner-cta">
                Explore courses →
              </span>
            </div>
          </Link>
        </div>
      </header>
    </>
  );
}