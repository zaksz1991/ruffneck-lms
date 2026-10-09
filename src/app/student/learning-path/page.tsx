import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PersonalizedLearningPath from "@/components/student/PersonalizedLearningPath";

export const dynamic = "force-dynamic";

export default async function LearningPathPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/student/learning-path");

  return <PersonalizedLearningPath />;
}
