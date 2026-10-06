import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminDiscountManager from "@/components/AdminDiscountManager";

export default async function AdminDiscountsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/admin/discounts"
    );
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

  if (
    !profile ||
    !["admin", "instructor"].includes(
      profile.role
    )
  ) {
    redirect("/");
  }

  return (
    <main className="container admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">
            Administration
          </p>

          <h1>Discount Codes</h1>

          <p>
            Create and manage promotional discounts
            for RuffNeck Learn paid courses.
          </p>
        </div>
      </div>

      <AdminDiscountManager />
    </main>
  );
}