import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function BrandMark() {
  return (
    <span className="rn-brand-mark" aria-hidden="true">
      RN
    </span>
  );
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="rn-nav-icon" aria-hidden="true">
      {children}
    </span>
  );
}

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
    <header className="site-header">
      <div className="inner">
        <Link href="/" className="brand" aria-label="RuffNeck Learn home">
          <BrandMark />

          <span className="brand-text">
            <strong>RuffNeck</strong>
            <span>Learn</span>
          </span>
        </Link>

        <nav className="nav" aria-label="Main navigation">
          <Link href="/courses">
            <NavIcon>▦</NavIcon>
            <span>Courses</span>
          </Link>

          {user ? (
            <>
              <Link href="/student/dashboard">
                <NavIcon>◉</NavIcon>
                <span>My learning</span>
              </Link>

              {(role === "admin" || role === "instructor") && (
                <Link href="/admin/lms">
                  <NavIcon>⚙</NavIcon>
                  <span>Admin</span>
                </Link>
              )}

              <form
                action="/auth/signout"
                method="post"
                className="rn-signout-form"
              >
                <button type="submit" className="btn btn-ghost rn-nav-button">
                  <NavIcon>↪</NavIcon>
                  <span>Sign out</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <span>Log in</span>
              </Link>

              <Link href="/signup" className="btn btn-primary rn-signup-button">
                <span>Sign up</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
