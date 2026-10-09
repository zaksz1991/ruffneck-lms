import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TABLE = "learner_learning_journal";
const TYPES = new Set(["reflection", "lesson_note", "question", "goal"]);

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= max ? cleaned : null;
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Please sign in to view your learning journal." }, { status: 401 });
    const { data, error } = await supabase.from(TABLE).select("id,title,body,course_title,entry_type,created_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(200);
    if (error) return NextResponse.json({ error: "Could not load journal entries." }, { status: 500 });
    return NextResponse.json({ entries: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Unexpected error while loading journal." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Please sign in to save a journal entry." }, { status: 401 });
    const payload = await request.json();
    const title = cleanText(payload.title, 140);
    const body = cleanText(payload.body, 12000);
    const courseTitle = payload.course_title == null || payload.course_title === "" ? null : cleanText(payload.course_title, 160);
    const entryType = payload.entry_type;
    if (!title || !body || (payload.course_title && !courseTitle) || !TYPES.has(entryType)) return NextResponse.json({ error: "Provide a valid title, notes, entry type, and course name if supplied." }, { status: 400 });
    const { data, error } = await supabase.from(TABLE).insert({ user_id: user.id, title, body, course_title: courseTitle, entry_type: entryType }).select("id,title,body,course_title,entry_type,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: "Could not save journal entry." }, { status: 500 });
    return NextResponse.json({ entry: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request while saving journal entry." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Please sign in to update a journal entry." }, { status: 401 });
    const payload = await request.json();
    const id = cleanText(payload.id, 80);
    const title = cleanText(payload.title, 140);
    const body = cleanText(payload.body, 12000);
    const courseTitle = payload.course_title == null || payload.course_title === "" ? null : cleanText(payload.course_title, 160);
    const entryType = payload.entry_type;
    if (!id || !title || !body || (payload.course_title && !courseTitle) || !TYPES.has(entryType)) return NextResponse.json({ error: "Provide valid entry details." }, { status: 400 });
    const { data, error } = await supabase.from(TABLE).update({ title, body, course_title: courseTitle, entry_type: entryType }).eq("id", id).eq("user_id", user.id).select("id,title,body,course_title,entry_type,created_at,updated_at").maybeSingle();
    if (error) return NextResponse.json({ error: "Could not update journal entry." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Journal entry not found." }, { status: 404 });
    return NextResponse.json({ entry: data });
  } catch {
    return NextResponse.json({ error: "Invalid request while updating journal entry." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Please sign in to delete a journal entry." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id || id.length > 80) return NextResponse.json({ error: "A valid journal entry ID is required." }, { status: 400 });
    const { data, error } = await supabase.from(TABLE).delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "Could not delete journal entry." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Journal entry not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unexpected error while deleting journal entry." }, { status: 500 });
  }
}
