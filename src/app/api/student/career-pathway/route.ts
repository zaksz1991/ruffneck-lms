import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_BODY = 6000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to create a career roadmap." }, { status: 401 });

    const raw = await request.text();
    if (raw.length > MAX_BODY) return NextResponse.json({ error: "Your profile is too long. Shorten it and try again." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
    if (!isRecord(body)) return NextResponse.json({ error: "Invalid profile." }, { status: 400 });

    const targetRole = typeof body.targetRole === "string" ? body.targetRole.trim().slice(0, 120) : "";
    const currentRole = typeof body.currentRole === "string" ? body.currentRole.trim().slice(0, 120) : "Not specified";
    const experience = typeof body.experience === "string" ? body.experience.slice(0, 60) : "beginner";
    const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 1200) : "";
    const hours = Number(body.hoursPerWeek);
    const skills = Array.isArray(body.skills) ? body.skills.filter((item): item is string => typeof item === "string").slice(0, 20).map((item) => item.slice(0, 100)) : [];
    if (!targetRole || !Number.isFinite(hours) || hours < 1 || hours > 20) return NextResponse.json({ error: "Choose a career goal and study time between 1 and 20 hours per week." }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "The AI career planner is not configured yet. Please contact the site administrator." }, { status: 503 });

    const prompt = `You are the career learning planner for RuffNeck Learn, a professional learning platform serving learners including Nigerian professionals. Create realistic, specific and encouraging career guidance. Do not promise employment, salaries, credentials, or guaranteed outcomes. Recommend only the following course titles when relevant, and never claim they are confirmed available unless stated as suggestions: Advanced AI Productivity, Automation & Prompt Engineering; AI Literacy; Effective Teacher; Data Analysis with Excel & Power BI; Digital Marketing & AI Content Creation. If none fit, suggest a skill topic rather than inventing a course. Use accessible/free tools where reasonable and include portfolio evidence. Account for the learner's available study hours. Return ONLY valid JSON matching this schema: {"targetRole":"string","summary":"string","currentStrengths":["string"],"skillGaps":[{"skill":"string","priority":"High|Medium|Low","reason":"string"}],"milestones":[{"title":"string","timeframe":"string","actions":["string"],"evidence":"string"}],"recommendedCourses":[{"title":"string","reason":"string"}],"portfolioProjects":["string"],"nextStep":"string"}. Provide 2-4 strengths, 3-5 gaps, 3-4 milestones, up to 4 suggested courses, and 2-4 portfolio project ideas. Keep actions practical and milestones proportional to the time available.\nLearner profile: ${JSON.stringify({ targetRole, currentRole, experience, skills, hoursPerWeek: hours, goal })}`;

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.35, maxOutputTokens: 3000 } }),
    });
    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      console.error("Gemini career pathway request failed", aiResponse.status, detail.slice(0, 500));
      return NextResponse.json({ error: aiResponse.status === 429 ? "The AI service is busy or its quota is exhausted. Please try again later." : "The AI service could not create a roadmap right now." }, { status: aiResponse.status === 429 ? 429 : 502 });
    }
    const result = await aiResponse.json();
    const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
    let roadmap: unknown;
    try { roadmap = JSON.parse(text); } catch { return NextResponse.json({ error: "The AI returned an unreadable roadmap. Please try again." }, { status: 502 }); }
    if (!isRecord(roadmap) || typeof roadmap.summary !== "string" || !Array.isArray(roadmap.milestones) || !Array.isArray(roadmap.skillGaps)) {
      return NextResponse.json({ error: "The AI returned an incomplete roadmap. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ roadmap });
  } catch (error) {
    console.error("Career pathway error", error);
    return NextResponse.json({ error: "Unable to create your roadmap right now." }, { status: 500 });
  }
}
