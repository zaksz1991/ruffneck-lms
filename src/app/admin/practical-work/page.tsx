import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticalWorkReview from "./PracticalWorkReview";

export default async function PracticalWorkPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/admin/practical-work",
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profile?.role !== "admin" &&
    profile?.role !== "instructor"
  ) {
    redirect("/");
  }

  return (
    <main className="page">
      <div className="container stack">
        <div className="page-header">
          <div>
            <p className="eyebrow">
              RuffNeck Learn
            </p>

            <h1>
              Practical Work Review
            </h1>

            <p className="muted">
              Evaluate learner work, provide
              actionable feedback, and approve
              demonstrated skills.
            </p>
          </div>

          <div className="actions">
            <Link
              href="/admin/practical-tasks"
              className="button secondary"
            >
              Manage Tasks
            </Link>

            <Link
              href="/admin/lms"
              className="button secondary"
            >
              Back to LMS
            </Link>
          </div>
        </div>

        <PracticalWorkReview />
      </div>
    </main>
  );
}