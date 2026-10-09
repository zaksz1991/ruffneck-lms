import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const COLUMNS = "id,title,notes,planned_for,duration_minutes,status,created_at,updated_at";
const STATUSES = ["planned", "completed", "cancelled"] as const;

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return NextResponse.json({ error: "Please sign in to view your study plan." }, { status: 401 });
    const { data, error } = await supabase.from("learner_study_sessions").select(COLUMNS).eq("learner_id", user.id).order("planned_for", { ascending: true }).limit(200);
    if (error) {
      console.error("Study planner GET failed:", error.message);
      return NextResponse.json({ error: "Your study plan could not be loaded. Check that the study planner migration has been applied." }, { status: 500 });
    }
    return NextResponse.json({ sessions: data ?? [] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Study planner GET unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while loading your study plan." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return NextResponse.json({ error: "Please sign in to create a study session." }, { status: 401 });
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 }); }
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const plannedFor = typeof body.planned_for === "string" ? body.planned_for : "";
    const duration = typeof body.duration_minutes === "number" ? body.duration_minutes : Number(body.duration_minutes);
    const date = new Date(plannedFor);
    if (!title || title.length > 120) return NextResponse.json({ error: "Session title must contain 1–120 characters." }, { status: 400 });
    if (notes.length > 1000) return NextResponse.json({ error: "Notes must be 1,000 characters or fewer." }, { status: 400 });
    if (!plannedFor || Number.isNaN(date.getTime())) return NextResponse.json({ error: "Choose a valid date and time." }, { status: 400 });
    if (!Number.isInteger(duration) || duration < 5 || duration > 600) return NextResponse.json({ error: "Duration must be between 5 and 600 minutes." }, { status: 400 });
    const { data, error } = await supabase.from("learner_study_sessions").insert({ learner_id: user.id, title, notes: notes || null, planned_for: date.toISOString(), duration_minutes: duration, status: "planned" }).select(COLUMNS).single();
    if (error) {
      console.error("Study planner POST failed:", error.message);
      return NextResponse.json({ error: "The study session could not be saved." }, { status: 500 });
    }
    return NextResponse.json({ session: data }, { status: 201 });
  } catch (error) {
    console.error("Study planner POST unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while saving your session." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return NextResponse.json({ error: "Please sign in to update your study plan." }, { status: 401 });
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 }); }
    const id = typeof body.id === "string" ? body.id : "";
    if (!id || id.length > 100) return NextResponse.json({ error: "A valid session ID is required." }, { status: 400 });
    const updates: Record<string, unknown> = {};
    if (typeof body.status === "string" && STATUSES.includes(body.status as (typeof STATUSES)[number])) updates.status = body.status;
    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title || title.length > 120) return NextResponse.json({ error: "Session title must contain 1–120 characters." }, { status: 400 });
      updates.title = title;
    }
    if (typeof body.notes === "string") {
      if (body.notes.length > 1000) return NextResponse.json({ error: "Notes must be 1,000 characters or fewer." }, { status: 400 });
      updates.notes = body.notes.trim() || null;
    }
    if (typeof body.planned_for === "string") {
      const date = new Date(body.planned_for);
      if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Choose a valid date and time." }, { status: 400 });
      updates.planned_for = date.toISOString();
    }
    if (body.duration_minutes !== undefined) {
      const duration = Number(body.duration_minutes);
      if (!Number.isInteger(duration) || duration < 5 || duration > 600) return NextResponse.json({ error: "Duration must be between 5 and 600 minutes." }, { status: 400 });
      updates.duration_minutes = duration;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No valid changes were provided." }, { status: 400 });
    const { data, error } = await supabase.from("learner_study_sessions").update(updates).eq("id", id).eq("learner_id", user.id).select(COLUMNS).maybeSingle();
    if (error) {
      console.error("Study planner PATCH failed:", error.message);
      return NextResponse.json({ error: "The study session could not be updated." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Study session not found." }, { status: 404 });
    return NextResponse.json({ session: data });
  } catch (error) {
    console.error("Study planner PATCH unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while updating your session." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return NextResponse.json({ error: "Please sign in to remove a study session." }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") ?? "";
    if (!id || id.length > 100) return NextResponse.json({ error: "A valid session ID is required." }, { status: 400 });
    const { data, error } = await supabase.from("learner_study_sessions").delete().eq("id", id).eq("learner_id", user.id).select("id").maybeSingle();
    if (error) {
      console.error("Study planner DELETE failed:", error.message);
      return NextResponse.json({ error: "The study session could not be removed." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Study session not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Study planner DELETE unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while removing your session." }, { status: 500 });
  }
}
