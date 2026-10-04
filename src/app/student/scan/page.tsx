import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScanAndLearn from "@/components/ScanAndLearn";

export const metadata = {
  title: "Scan & Learn | RuffNeck Learn",
  description:
    "Turn photographed notes and documents into structured learning material with RuffNeck Learn AI.",
};

export default async function ScanAndLearnPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/scan");
  }

  return <ScanAndLearn />;
}