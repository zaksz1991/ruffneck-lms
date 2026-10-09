import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticeStudio from "@/components/student/PracticeStudio";

export const metadata = {
  title: "AI Practice Studio | RuffNeck Learn",
  description: "Practise professional skills with guided AI feedback.",
};

export default async function PracticeStudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/student/practice-studio");

  return <PracticeStudio />;
}
