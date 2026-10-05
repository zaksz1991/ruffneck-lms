import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminAiDraftReview from "./AdminAiDraftReview";

type AdminAiDraftPageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

export default async function AdminAiDraftPage({
  params,
}: AdminAiDraftPageProps) {
  const { draftId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/admin/ai-drafts/${draftId}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    (profile.role !== "admin" && profile.role !== "instructor")
  ) {
    redirect("/student/dashboard");
  }

  const { data: draft, error: draftError } = await supabase
    .from("ai_learning_drafts")
    .select(
      `
        id,
        student_id,
        title,
        output_type,
        language_code,
        audience,
        focus_instruction,
        learning_pack,
        status,
        source_uploaded_at,
        created_at,
        updated_at,
        review_note,
        reviewed_by,
        reviewed_at
      `,
    )
    .eq("id", draftId)
    .maybeSingle();

  if (draftError) {
    console.error("Admin AI draft detail error:", draftError);
  }

  if (!draft) {
    notFound();
  }

  return (
    <main className="page">
      <div className="container">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Admin LMS</p>
            <h1>Review AI Draft</h1>
            <p className="muted">
              Review the generated learning material before approving it for
              the LMS workflow.
            </p>
          </div>

          <Link
            href="/admin/ai-drafts"
            className="rn-button rn-button-secondary"
          >
            Back to AI Draft Review
          </Link>
        </div>

        <AdminAiDraftReview
          draft={draft}
          reviewerRole={profile.role}
        />
      </div>
    </main>
  );
}