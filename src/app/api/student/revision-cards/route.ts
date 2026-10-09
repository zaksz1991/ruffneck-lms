import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TABLE = "learner_revision_cards";
const MAX_TEXT = 4000;

function textField(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 && result.length <= max ? result : null;
}

async function getSession() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getSession();
    if (!user) return NextResponse.json({ error: "Please sign in to access your revision cards." }, { status: 401 });
    const dueOnly = request.nextUrl.searchParams.get("due") === "1";
    let query = supabase.from(TABLE).select("id,front,back,course_title,topic,due_at,last_reviewed_at,review_count,created_at,updated_at").eq("user_id", user.id).order("due_at", { ascending: true, nullsFirst: true }).limit(500);
    if (dueOnly) query = query.lte("due_at", new Date().toISOString());
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load revision cards." }, { status: 500 });
    return NextResponse.json({ cards: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Unexpected error while loading revision cards." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSession();
    if (!user) return NextResponse.json({ error: "Please sign in to create a revision card." }, { status: 401 });
    const payload = await request.json();
    const front = textField(payload.front);
    const back = textField(payload.back);
    const courseTitle = payload.course_title == null || payload.course_title === "" ? null : textField(payload.course_title, 160);
    const topic = payload.topic == null || payload.topic === "" ? null : textField(payload.topic, 120);
    if (!front || !back || (payload.course_title && !courseTitle) || (payload.topic && !topic)) return NextResponse.json({ error: "Enter a question and answer. Course and topic fields must be valid if supplied." }, { status: 400 });
    const { data, error } = await supabase.from(TABLE).insert({ user_id: user.id, front, back, course_title: courseTitle, topic, due_at: new Date().toISOString() }).select("id,front,back,course_title,topic,due_at,last_reviewed_at,review_count,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: "Could not save this revision card." }, { status: 500 });
    return NextResponse.json({ card: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request while creating a revision card." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await getSession();
    if (!user) return NextResponse.json({ error: "Please sign in to update revision cards." }, { status: 401 });
    const payload = await request.json();
    const id = textField(payload.id, 80);
    if (!id) return NextResponse.json({ error: "A valid card ID is required." }, { status: 400 });

    if (payload.action === "review") {
      const ratings: Record<string, number> = { again: 0, hard: 1, good: 2, easy: 3 };
      const rating = payload.rating;
      if (!(typeof rating === "string" && Object.prototype.hasOwnProperty.call(ratings, rating))) return NextResponse.json({ error: "Choose Again, Hard, Good, or Easy." }, { status: 400 });
      const { data: current, error: fetchError } = await supabase.from(TABLE).select("review_count").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (fetchError) return NextResponse.json({ error: "Could not load card review status." }, { status: 500 });
      if (!current) return NextResponse.json({ error: "Revision card not found." }, { status: 404 });
      const days = rating === "again" ? 0 : rating === "hard" ? 1 : rating === "good" ? Math.min(30, Math.max(2, (current.review_count + 1) * 2)) : Math.min(60, Math.max(4, (current.review_count + 1) * 4));
      const due = new Date();
      if (days === 0) due.setMinutes(due.getMinutes() + 10);
      else due.setDate(due.getDate() + days);
      const { data, error } = await supabase.from(TABLE).update({ due_at: due.toISOString(), last_reviewed_at: new Date().toISOString(), review_count: current.review_count + (rating === "again" ? 0 : 1) }).eq("id", id).eq("user_id", user.id).select("id,due_at,last_reviewed_at,review_count").maybeSingle();
      if (error) return NextResponse.json({ error: "Could not save your review." }, { status: 500 });
      return NextResponse.json({ card: data });
    }

    const front = textField(payload.front);
    const back = textField(payload.back);
    const courseTitle = payload.course_title == null || payload.course_title === "" ? null : textField(payload.course_title, 160);
    const topic = payload.topic == null || payload.topic === "" ? null : textField(payload.topic, 120);
    if (!front || !back || (payload.course_title && !courseTitle) || (payload.topic && !topic)) return NextResponse.json({ error: "Enter a valid question and answer." }, { status: 400 });
    const { data, error } = await supabase.from(TABLE).update({ front, back, course_title: courseTitle, topic }).eq("id", id).eq("user_id", user.id).select("id,front,back,course_title,topic,due_at,last_reviewed_at,review_count,created_at,updated_at").maybeSingle();
    if (error) return NextResponse.json({ error: "Could not update this revision card." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Revision card not found." }, { status: 404 });
    return NextResponse.json({ card: data });
  } catch {
    return NextResponse.json({ error: "Invalid request while updating a revision card." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await getSession();
    if (!user) return NextResponse.json({ error: "Please sign in to delete revision cards." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id || id.length > 80) return NextResponse.json({ error: "A valid card ID is required." }, { status: 400 });
    const { data, error } = await supabase.from(TABLE).delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "Could not delete this revision card." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Revision card not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unexpected error while deleting a revision card." }, { status: 500 });
  }
}
