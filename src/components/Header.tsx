import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
        <Link href="/" className="brand">
          RuffNeck <span>Learn</span>
        </Link>
        <nav className="nav">
          <Link href="/courses">Courses</Link>
          {user ? (
            <>
              <Link href="/student/dashboard">My learning</Link>
              {(role === "admin" || role === "instructor") && (
                <Link href="/admin/lms">Admin</Link>
              )}
              <form action="/auth/signout" method="post" style={{ margin: 0 }}>
                <button type="submit" className="btn btn-ghost" style={{ padding: "6px 12px" }}>
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className="btn btn-primary" style={{ padding: "6px 12px" }}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
