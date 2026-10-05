import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminAiDraftReview from "./AdminAiDraftReview";

type PageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

type Profile = {
  role: "admin" | "instructor" | "student";
};

export default async function AdminAiDraftPage({
  params,
}: PageProps) {
  const { draftId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=/admin/ai-drafts/${draftId}`
    );
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<Profile>();

  if (
    profileError ||
    !profile ||
    (profile.role !== "admin" &&
      profile.role !== "instructor")
  ) {
    redirect("/student/dashboard");
  }

  const { data: draft, error: draftError } =
    await supabase
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
        reviewed_at,
        converted_course_id,
        converted_at
      `
      )
      .eq("id", draftId)
      .single();

  if (draftError || !draft) {
    notFound();
  }

  return (
    <div>
      <AdminAiDraftReview
        draft={draft}
      />
    </div>
  );
}