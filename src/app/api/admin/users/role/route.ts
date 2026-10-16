import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const USER_ID = "c2ded758-b63f-4998-9d9c-2f6e8c393adc";
const COURSE_ID = "ed6c001a-7a0f-44ad-98e3-404d690c2831";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can perform this action." },
        { status: 403 }
      );
    }

    const { error } = await supabase.rpc(
      "admin_promote_instructor_and_assign_course",
      {
        p_user_id: USER_ID,
        p_course_id: COURSE_ID,
      }
    );

    if (error) {
      console.error("Instructor assignment failed:", error.message);

      return NextResponse.json(
        { error: "Could not assign the instructor. Check the database function and permissions." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Zakariya Hassan is now an instructor and has been assigned to the test lab course.",
    });
  } catch (error) {
    console.error("Instructor role route error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}