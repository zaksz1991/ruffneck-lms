import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const RUFFNECK_ENTERTAINMENT_URL =
  "https://ruffneck-entertainment.vercel.app/";

export async function Header() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    role = data?.role ?? null;
  }

  return (
    <>
      <div className="rn-parent-brand">
        <div className="rn-parent-brand-inner">
          <div className="rn-parent-copy">
            <span className="rn-parent-kicker">
              RUFFNECK ENTERTAINMENT
            </span>

            <span className="rn-parent-description">
              Practical AI & digital systems for Nigerian professionals
            </span>
          </div>

          <a
            href={RUFFNECK_ENTERTAINMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
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
              width={180}
              height={60}
              priority
              className="brand-logo"
            />

            <span className="brand-copy">
              <strong>RuffNeck</strong>
              <span>Learn</span>
            </span>
          </Link>

          <nav
            className="nav"
            aria-label="Primary navigation"
          >
            <Link href="/courses">
              Courses
            </Link>

            {user ? (
              <>
                <Link href="/student/dashboard">
                  My learning
                </Link>

                <Link href="/student/scan">
                  Scan & Learn
                </Link>

                <Link href="/student/ai-drafts">
                  My AI Drafts
                </Link>

                {(
                  role === "admin" ||
                  role === "instructor"
                ) && (
                  <Link href="/admin/lms">
                    Admin
                  </Link>
                )}

                <form
                  action="/auth/signout"
                  method="post"
                  style={{ margin: 0 }}
                >
                  <button
                    type="submit"
                    className="btn btn-ghost"
                    style={{
                      padding: "7px 12px",
                    }}
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

                <Link
                  href="/signup"
                  className="btn btn-primary"
                  style={{
                    padding: "7px 12px",
                  }}
                >
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