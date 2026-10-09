import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProgressAchievementCenter from "@/components/student/ProgressAchievementCenter";

export const dynamic = "force-dynamic";

export default async function StudentAchievementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/student/achievements");

  return <ProgressAchievementCenter />;
}
