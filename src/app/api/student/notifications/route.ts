import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const NOTIFICATION_COLUMNS = "id,type,title,message,href,read_at,created_at";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in to view notifications." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("student_notifications")
      .select(NOTIFICATION_COLUMNS)
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Notifications GET failed:", error.message);
      return NextResponse.json({ error: "Notifications could not be loaded. Check that the notifications migration has been applied." }, { status: 500 });
    }

    return NextResponse.json({ notifications: data ?? [] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Notifications GET unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while loading notifications." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in to update notifications." }, { status: 401 });
    }

    let body: { id?: unknown; markAllRead?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
    }

    const now = new Date().toISOString();
    if (body.markAllRead === true) {
      const { error } = await supabase
        .from("student_notifications")
        .update({ read_at: now })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      if (error) {
        console.error("Mark all notifications read failed:", error.message);
        return NextResponse.json({ error: "Notifications could not be updated." }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (typeof body.id !== "string" || body.id.length > 100) {
      return NextResponse.json({ error: "A valid notification ID is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("student_notifications")
      .update({ read_at: now })
      .eq("id", body.id)
      .eq("recipient_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Mark notification read failed:", error.message);
      return NextResponse.json({ error: "This notification could not be updated." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications PATCH unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while updating notifications." }, { status: 500 });
  }
}
