import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditor from "./ProfileEditor";
import styles from "./ProfilePage.module.css";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=/account/profile");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Account profile lookup failed:", error.message);
    throw new Error("Unable to load your profile. Please try again.");
  }

  const role = data?.role;
  if (role && !["student", "instructor", "admin"].includes(role)) {
    redirect("/login?next=/account/profile");
  }

  const dashboardHref =
    role === "instructor"
      ? "/instructor/dashboard"
      : role === "admin"
        ? "/admin/lms"
        : "/student/dashboard";

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link href={dashboardHref}>Dashboard</Link>
        <span aria-hidden="true">/</span>
        <span>My profile</span>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>RUFFNECK LEARN · ACCOUNT</span>
          <h1>My profile</h1>
          <p>Keep your learner or instructor details accurate across RuffNeck Learn.</p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.secondaryButton} href={dashboardHref}>
            Return to dashboard
          </Link>
        </div>
      </header>

      {!data ? (
        <section className={styles.missingProfile} role="status">
          <h2>Profile record not found</h2>
          <p>Your sign-in is valid, but the matching profile record could not be found. Ask an administrator to check your account before trying to edit profile details.</p>
        </section>
      ) : (
        <ProfileEditor
          userId={user.id}
          fullName={data.full_name ?? ""}
          email={data.email ?? user.email ?? ""}
          phone={data.phone ?? ""}
          role={data.role ?? "student"}
          createdAt={data.created_at ?? null}
        />
      )}
    </main>
  );
}
