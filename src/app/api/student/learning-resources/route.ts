import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TABLE = "learner_saved_resources";
const TYPES = ["article", "video", "document", "tool", "website", "other"] as const;
const MAX_TITLE = 180;
const MAX_DESCRIPTION = 1200;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}
function validUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch { return null; }
}
async function session() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await session();
    if (!user) return NextResponse.json({ error: "Please sign in to access your learning resources." }, { status: 401 });
    const search = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
    const type = request.nextUrl.searchParams.get("type") ?? "all";
    let query = supabase.from(TABLE).select("id,title,url,description,resource_type,course_title,topic,is_favorite,created_at,updated_at").eq("user_id", user.id).order("is_favorite", { ascending: false }).order("created_at", { ascending: false }).limit(500);
    if (search) query = query.or(`title.ilike.%${search.replace(/[%_,()]/g, " ")}%,description.ilike.%${search.replace(/[%_,()]/g, " ")}%,topic.ilike.%${search.replace(/[%_,()]/g, " " )}%`);
    if (type !== "all" && TYPES.includes(type as typeof TYPES[number])) query = query.eq("resource_type", type);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Could not load saved resources." }, { status: 500 });
    return NextResponse.json({ resources: data ?? [] });
  } catch { return NextResponse.json({ error: "Unexpected error while loading resources." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await session();
    if (!user) return NextResponse.json({ error: "Please sign in to save a resource." }, { status: 401 });
    const body = await request.json();
    const title = cleanText(body.title, MAX_TITLE);
    const url = validUrl(body.url);
    const description = body.description == null || body.description === "" ? null : cleanText(body.description, MAX_DESCRIPTION);
    const courseTitle = body.course_title == null || body.course_title === "" ? null : cleanText(body.course_title, 180);
    const topic = body.topic == null || body.topic === "" ? null : cleanText(body.topic, 120);
    const resourceType = TYPES.includes(body.resource_type) ? body.resource_type : "other";
    if (!title || !url || (body.description && !description) || (body.course_title && !courseTitle) || (body.topic && !topic)) return NextResponse.json({ error: "Enter a valid title and HTTP/HTTPS URL. Optional fields must be within their length limits." }, { status: 400 });
    const { data, error } = await supabase.from(TABLE).insert({ user_id: user.id, title, url, description, resource_type: resourceType, course_title: courseTitle, topic }).select("id,title,url,description,resource_type,course_title,topic,is_favorite,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: "Could not save this resource. Check whether the migration has been applied." }, { status: 500 });
    return NextResponse.json({ resource: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await session();
    if (!user) return NextResponse.json({ error: "Please sign in to update resources." }, { status: 401 });
    const body = await request.json();
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "Resource ID is required." }, { status: 400 });
    const update: Record<string, unknown> = {};
    if (typeof body.is_favorite === "boolean") update.is_favorite = body.is_favorite;
    if (typeof body.title === "string") { const value = cleanText(body.title, MAX_TITLE); if (!value) return NextResponse.json({ error: "Title is invalid." }, { status: 400 }); update.title = value; }
    if (typeof body.url === "string") { const value = validUrl(body.url); if (!value) return NextResponse.json({ error: "URL must use HTTP or HTTPS." }, { status: 400 }); update.url = value; }
    if (typeof body.description === "string") { if (body.description.length > MAX_DESCRIPTION) return NextResponse.json({ error: "Description is too long." }, { status: 400 }); update.description = body.description.trim() || null; }
    if (typeof body.topic === "string") { if (body.topic.length > 120) return NextResponse.json({ error: "Topic is too long." }, { status: 400 }); update.topic = body.topic.trim() || null; }
    if (typeof body.course_title === "string") { if (body.course_title.length > 180) return NextResponse.json({ error: "Course title is too long." }, { status: 400 }); update.course_title = body.course_title.trim() || null; }
    if (body.resource_type !== undefined) { if (!TYPES.includes(body.resource_type)) return NextResponse.json({ error: "Invalid resource type." }, { status: 400 }); update.resource_type = body.resource_type; }
    if (!Object.keys(update).length) return NextResponse.json({ error: "No valid fields supplied." }, { status: 400 });
    const { data, error } = await supabase.from(TABLE).update(update).eq("id", body.id).eq("user_id", user.id).select("id,title,url,description,resource_type,course_title,topic,is_favorite,created_at,updated_at").single();
    if (error) return NextResponse.json({ error: "Could not update resource." }, { status: 500 });
    return NextResponse.json({ resource: data });
  } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await session();
    if (!user) return NextResponse.json({ error: "Please sign in to delete resources." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Resource ID is required." }, { status: 400 });
    const { error } = await supabase.from(TABLE).delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Could not delete resource." }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Unexpected error while deleting resource." }, { status: 500 }); }
}
