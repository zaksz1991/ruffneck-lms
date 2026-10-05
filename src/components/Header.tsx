"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "student" | "instructor" | "admin" | null;

export function Header() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

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
              Practical AI & digital systems
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
                Practical AI & digital systems
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
                <Link href="/student">
                  My learning
                </Link>

                <Link href="/student/scan">
                  Scan & Learn
                </Link>

                <Link href="/student/ai-drafts">
                  My AI Drafts
                </Link>

                <Link href="/student/payments">
                  Payment History
                </Link>

                {canAccessAdmin ? (
                  <Link href="/admin/lms">
                    Admin
                  </Link>
                ) : null}

                <form
                  action="/api/auth/logout"
                  method="post"
                >
                  <button
                    type="submit"
                    className="nav-button"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">
                  Log in
                </Link>

                <Link href="/signup">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}

export default Header;