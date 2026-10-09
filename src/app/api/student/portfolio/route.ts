import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const categories = new Set(["project", "work_sample", "achievement", "certificate", "case_study"]);
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in to manage your portfolio." }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  if (body.action === "save_profile") {
    const input = body.profile ?? {};
    const username = clean(input.username, 30).toLowerCase();
    const display_name = clean(input.display_name, 100);
    if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username)) return NextResponse.json({ error: "Username must be 3–30 characters using lowercase letters, numbers, _ or -; it must start with a letter or number." }, { status: 400 });
    if (!display_name) return NextResponse.json({ error: "Enter a display name." }, { status: 400 });
    const { data, error } = await supabase.from("portfolio_profiles").upsert({ user_id: user.id, username, display_name, headline: clean(input.headline, 160), bio: clean(input.bio, 1200), is_public: Boolean(input.is_public), updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("id,user_id,username,display_name,headline,bio,is_public").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "That username is already in use. Choose another." : "Could not save profile. Confirm the portfolio database migration has been applied." }, { status: error.code === "23505" ? 409 : 500 });
    return NextResponse.json({ profile: data });
  }

  if (body.action === "set_public") {
    const { data: existing, error: lookupError } = await supabase.from("portfolio_profiles").select("id,username,display_name,headline,bio,is_public,user_id").eq("user_id", user.id).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Could not load portfolio profile." }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Save your profile details before publishing it." }, { status: 400 });
    const { data, error } = await supabase.from("portfolio_profiles").update({ is_public: Boolean(body.is_public), updated_at: new Date().toISOString() }).eq("user_id", user.id).select("id,user_id,username,display_name,headline,bio,is_public").single();
    if (error) return NextResponse.json({ error: "Could not update portfolio visibility." }, { status: 500 });
    return NextResponse.json({ profile: data });
  }

  if (body.action === "add_item") {
    const input = body.item ?? {};
    const title = clean(input.title, 140), description = clean(input.description, 2000), category = clean(input.category, 30);
    if (!title || !description) return NextResponse.json({ error: "Add a title and description." }, { status: 400 });
    if (!categories.has(category)) return NextResponse.json({ error: "Choose a valid entry type." }, { status: 400 });
    const project_url = clean(input.project_url, 500);
    if (project_url) { try { const parsed = new URL(project_url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); } catch { return NextResponse.json({ error: "Enter a valid http or https link." }, { status: 400 }); } }
    const skills = Array.isArray(input.skills) ? input.skills.filter((s: unknown) => typeof s === "string").map((s: string) => s.trim().slice(0, 50)).filter(Boolean).slice(0, 20) : [];
    const { data, error } = await supabase.from("portfolio_items").insert({ user_id: user.id, title, description, category, project_url: project_url || null, skills, is_public: Boolean(input.is_public) }).select("id,title,description,category,project_url,skills,is_public,sort_order,created_at").single();
    if (error) return NextResponse.json({ error: "Could not add entry. Confirm the portfolio database migration has been applied." }, { status: 500 });
    return NextResponse.json({ item: data });
  }

  if (body.action === "toggle_item") {
    const id = clean(body.id, 50);
    const { data, error } = await supabase.from("portfolio_items").update({ is_public: Boolean(body.is_public), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select("id,title,description,category,project_url,skills,is_public,sort_order,created_at").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Entry not found or could not be updated." }, { status: 404 });
    return NextResponse.json({ item: data });
  }

  if (body.action === "delete_item") {
    const id = clean(body.id, 50);
    const { error } = await supabase.from("portfolio_items").delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Could not delete entry." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported portfolio action." }, { status: 400 });
}
