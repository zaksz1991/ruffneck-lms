import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set([
  "student",
  "instructor",
  "admin",
]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Admin role lookup failed:", profileError);

      return NextResponse.json(
        { ok: false, error: "Unable to verify administrator permissions." },
        { status: 500 },
      );
    }

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Administrator access required." },
        { status: 403 },
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (
      typeof body !== "object" ||
      body === null ||
      !("userId" in body) ||
      !("role" in body)
    ) {
      return NextResponse.json(
        { ok: false, error: "A user ID and role are required." },
        { status: 400 },
      );
    }

    const { userId, role } = body as {
      userId: unknown;
      role: unknown;
    };

    if (
      typeof userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId,
      )
    ) {
      return NextResponse.json(
        { ok: false, error: "A valid user ID is required." },
        { status: 400 },
      );
    }

    if (typeof role !== "string" || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { ok: false, error: "Choose a valid profile role." },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabase.rpc(
      "admin_set_profile_role",
      {
        p_user_id: userId,
        p_role: role,
      },
    );

    if (updateError) {
      console.error("Profile role update failed:", updateError);

      return NextResponse.json(
        { ok: false, error: "The profile role could not be updated." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Profile role updated successfully.",
    });
  } catch (error) {
    console.error("Admin role endpoint failed:", error);

    return NextResponse.json(
      { ok: false, error: "Unexpected error while updating the role." },
      { status: 500 },
    );
  }
}