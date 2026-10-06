import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DiscountRedemptionReport from "@/components/DiscountRedemptionReport";

export default async function DiscountRedemptionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/discounts/redemptions");
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
    <main className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Payment Management
          </p>

          <h1>
            Discount Redemption Report
          </h1>

          <p>
            Review discount usage, revenue impact,
            and payment references.
          </p>
        </div>
      </div>

      <DiscountRedemptionReport />
    </main>
  );
}