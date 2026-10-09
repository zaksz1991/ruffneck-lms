import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompetencyDashboard from "@/components/student/CompetencyDashboard";

export const dynamic = "force-dynamic";

export default async function StudentCompetenciesPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/login?next=/student/competencies");

  return <CompetencyDashboard />;
}
