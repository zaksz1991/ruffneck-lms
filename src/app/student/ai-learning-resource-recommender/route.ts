import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 1600;
const safeText = (value: unknown, max = MAX_TEXT) => typeof value === "string" ? value.trim().slice(0, max) : "";

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in to use the resource recommender." }, { status: 401 });

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
    const goal = safeText(body.goal, 180);
    const skills = safeText(body.skills, 1600);
    const topics = safeText(body.topics, 800);
    const level = safeText(body.level, 40);
    const language = safeText(body.language, 40);
    const hoursPerWeek = Number(body.hoursPerWeek);
    if (goal.length < 3 || skills.length < 2) return NextResponse.json({ error: "Enter a career goal and your current skills." }, { status: 400 });
    if (!Number.isFinite(hoursPerWeek) || hoursPerWeek < 1 || hoursPerWeek > 20) return NextResponse.json({ error: "Study time must be between 1 and 20 hours per week." }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI service is not configured. Add GEMINI_API_KEY in your server environment." }, { status: 503 });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const prompt = `You are a careful learning-resource adviser for RuffNeck Learn. Build a practical resource plan from this learner input. Do not invent course availability or claim that you browsed, checked, or verified a URL. Prefer stable official provider homepages or well-known public learning resources, and use only URLs you are reasonably confident are real. If uncertain about a URL, set url to an empty string and give searchTerms instead. Never invent RuffNeck Learn course titles. Use ${language || "English"} where practical; if quality material is scarce in that language, state this in cautions. Avoid paywall assumptions and mark free/paid status only when confident. Return ONLY valid JSON matching this schema: {"summary":"string","resources":[{"title":"string","type":"Course|Documentation|Tutorial|Practice platform|Book|Video|Community","provider":"string","url":"https://... or empty string","level":"string","estimatedTime":"string","whyItFits":"string","action":"specific first action","verification":"verified or check"}],"weeklyPlan":["string"],"searchTerms":["string"],"cautions":["string"]}. Provide 5 to 8 resources, 4 to 6 weekly steps, 4 to 8 search terms, and 2 to 4 cautions. Set verification to "check" for URLs that have not been verified in a live lookup; only use "verified" for an official URL you are confident is correct, and describe it as an official link, not as live-checked. Do not output markdown or extra keys. Learner goal: ${goal}\nCurrent skills and experience: ${skills}\nLevel: ${level}\nStudy hours per week: ${hoursPerWeek}\nPreferred language: ${language}\nPriority topics: ${topics || "No extra topics specified"}`;

    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.35, responseMimeType: "application/json" } }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("Gemini resource recommender error", upstream.status, detail.slice(0, 500));
      return NextResponse.json({ error: upstream.status === 429 ? "The AI service is busy. Please wait and try again." : "The AI service could not generate recommendations right now." }, { status: upstream.status === 429 ? 429 : 502 });
    }
    const result = await upstream.json();
    const text = result?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("");
    if (!text) return NextResponse.json({ error: "The AI service returned an empty response. Please try again." }, { status: 502 });
    let plan: any;
    try { plan = parseJson(text); } catch { return NextResponse.json({ error: "The AI response could not be read. Please try again." }, { status: 502 }); }
    if (!plan || typeof plan.summary !== "string" || !Array.isArray(plan.resources) || !Array.isArray(plan.weeklyPlan) || !Array.isArray(plan.searchTerms) || !Array.isArray(plan.cautions)) {
      return NextResponse.json({ error: "The AI returned an incomplete resource plan. Please try again." }, { status: 502 });
    }
    plan.resources = plan.resources.slice(0, 8).map((r: any) => ({
      title: safeText(r?.title, 180), type: safeText(r?.type, 60), provider: safeText(r?.provider, 100),
      url: typeof r?.url === "string" && /^https:\/\//i.test(r.url) ? r.url.slice(0, 500) : "",
      level: safeText(r?.level, 60), estimatedTime: safeText(r?.estimatedTime, 80), whyItFits: safeText(r?.whyItFits, 600),
      action: safeText(r?.action, 400), verification: r?.verification === "verified" ? "verified" : "check",
    }));
    plan.summary = safeText(plan.summary, 1200);
    plan.weeklyPlan = plan.weeklyPlan.slice(0, 6).map((x: unknown) => safeText(x, 500)).filter(Boolean);
    plan.searchTerms = plan.searchTerms.slice(0, 8).map((x: unknown) => safeText(x, 180)).filter(Boolean);
    plan.cautions = plan.cautions.slice(0, 4).map((x: unknown) => safeText(x, 400)).filter(Boolean);
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("AI learning resource recommender failed", error);
    return NextResponse.json({ error: "Something went wrong while building the plan. Please try again." }, { status: 500 });
  }
}
