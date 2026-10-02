"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <Link href="/" className="brand">
            <span className="rn-brand-mark">RN</span>

            <span className="rn-brand-copy">
              <strong>RuffNeck</strong>
              <small>Learn</small>
            </span>
          </Link>

          <nav className="nav" aria-label="Main navigation">
            <Link
              href="/courses"
              className={isActive("/courses") ? "active" : ""}
            >
              <span className="rn-nav-icon">▦</span>
              Courses
            </Link>

            <Link
              href="/student/dashboard"
              className={
                isActive("/student/dashboard") ? "active" : ""
              }
            >
              <span className="rn-nav-icon">◉</span>
              My learning
            </Link>

            {pathname.startsWith("/admin") ? (
              <Link
                href="/admin/lms?view=courses"
                className="active"
              >
                <span className="rn-nav-icon">⚙</span>
                Admin
              </Link>
            ) : null}

            <form
              action="/api/auth/logout"
              method="post"
              className="rn-signout-form"
            >
              <button type="submit" className="nav-button rn-nav-button">
                <span className="rn-nav-icon">↪</span>
                Sign out
              </button>
            </form>
          </nav>
        </div>

        <div className="rn-header-learning-banner">
          <Link href="/courses" aria-label="Explore RuffNeck Learn courses">
            <img
              src="/brand/ruffneck-learn-banner.png"
              alt="RuffNeck Learn — Learn, Build, Grow"
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