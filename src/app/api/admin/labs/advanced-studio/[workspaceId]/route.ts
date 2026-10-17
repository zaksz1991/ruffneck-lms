import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ workspaceId: string }> };
function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(_request: Request, context: Context) {
  try {
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return jsonError("Invalid project workspace ID.", 400);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError("Sign in to review this project.", 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) return jsonError("Unable to verify reviewer permissions.", 500);
    if (!profile || (profile.role !== "admin" && profile.role !== "instructor")) return jsonError("You are not authorized to review projects.", 403);

    const { data: workspace, error: workspaceError } = await supabase
      .from("lab_project_workspaces")
      .select("id, lab_id, student_id, project_type, project_title, project_json, reflection, created_at, updated_at")
      .eq("id", workspaceId)
      .maybeSingle();
    if (workspaceError) {
      console.error("Advanced project review workspace query failed:", workspaceError);
      return jsonError("Unable to load the project workspace.", 500);
    }
    if (!workspace) return jsonError("Project workspace not found or not accessible to this reviewer.", 404);

    if (profile.role === "instructor") {
      const { data: lab, error: labError } = await supabase
        .from("practical_labs")
        .select("course_id")
        .eq("id", workspace.lab_id)
        .maybeSingle();
      if (labError || !lab) return jsonError("Unable to verify the project course.", 500);
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("instructor_id")
        .eq("id", lab.course_id)
        .maybeSingle();
      if (courseError || !course) return jsonError("Unable to verify course ownership.", 500);
      if (course.instructor_id !== user.id) return jsonError("Instructors can only review projects in their assigned courses.", 403);
    }

    return NextResponse.json({ ok: true, workspace });
  } catch (error: unknown) {
    console.error("Advanced project review route failed:", error);
    return jsonError("An unexpected error occurred while loading the project.", 500);
  }
}
