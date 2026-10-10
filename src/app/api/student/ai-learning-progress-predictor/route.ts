import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in to analyze your learning progress." }, { status: 401 });

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

    const course = text(body.course, 160);
    const goalDate = text(body.goalDate, 40);
    const notes = text(body.notes, 1200);
    const completed = Number(body.completedLessons);
    const total = Number(body.totalLessons);
    const daysLeft = Number(body.daysLeft);
    const weeklyHours = Number(body.weeklyHours);
    const recentHours = Number(body.recentHours);
    const weeksObserved = Number(body.weeksObserved);

    if (course.length < 2) return NextResponse.json({ error: "Enter a course or learning goal." }, { status: 400 });
    if (![completed, total].every(Number.isFinite) || total < 1 || completed < 0 || completed > total || !Number.isInteger(completed) || !Number.isInteger(total)) {
      return NextResponse.json({ error: "Enter valid lesson counts. Completed lessons cannot exceed the total." }, { status: 400 });
    }
    if (!Number.isFinite(daysLeft) || daysLeft < 1 || daysLeft > 3650) return NextResponse.json({ error: "Days remaining must be between 1 and 3650." }, { status: 400 });
    if (!Number.isFinite(weeklyHours) || weeklyHours < 1 || weeklyHours > 60) return NextResponse.json({ error: "Planned study time must be between 1 and 60 hours per week." }, { status: 400 });
    if (!Number.isFinite(recentHours) || recentHours < 0 || recentHours > 168) return NextResponse.json({ error: "Recent study hours must be between 0 and 168." }, { status: 400 });
    if (!Number.isFinite(weeksObserved) || weeksObserved < 1 || weeksObserved > 12) return NextResponse.json({ error: "Choose between 1 and 12 weeks for the recent activity window." }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "The AI service is not configured. Please contact the site administrator." }, { status: 503 });

    const remaining = total - completed;
    const completionPercent = Math.round((completed / total) * 100);
    const prompt = `You are a supportive learning analytics coach for RuffNeck Learn. Analyze the learner data and return valid JSON only. Do not claim certainty or treat a prediction as a guarantee. Do not invent activity or course requirements. Distinguish the simple arithmetic estimate from your qualitative interpretation. If recent hours are zero, say there is insufficient recent study activity to estimate pace reliably. Never recommend skipping assessments or bypassing course requirements.

Learner data:
- Course/goal: ${course}
- Lessons completed: ${completed} of ${total} (${completionPercent}%)
- Lessons remaining: ${remaining}
- Days until learner's target: ${daysLeft}
- Target date (optional): ${goalDate || "not provided"}
- Planned study hours/week: ${weeklyHours}
- Study hours in the last ${weeksObserved} week(s): ${recentHours}
- Learner context: ${notes || "not provided"}

Return JSON matching this schema:
{
 "status": "On track" | "At risk" | "Needs more data",
 "headline": string,
 "confidence": "Low" | "Moderate" | "Higher",
 "completionPercent": number,
 "lessonsRemaining": number,
 "requiredLessonsPerWeek": number,
 "observedHoursPerWeek": number,
 "paceAssessment": string,
 "risks": string[],
 "recommendations": string[],
 "weeklyPlan": [{"week": string, "focus": string, "hours": number, "checkpoint": string}],
 "assumptions": string[],
 "nextAction": string
}
Use simple arithmetic for requiredLessonsPerWeek = lessons remaining divided by max(1, daysLeft/7), rounded to one decimal. observedHoursPerWeek = recent hours divided by weeks observed, rounded to one decimal. Weekly plan should cover up to 4 weeks and remain realistic. Status should be conservative: use Needs more data if there is too little recent evidence; At risk if the available pace/planned hours clearly do not fit the target; otherwise On track. Output only JSON.`;

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25, responseMimeType: "application/json" } }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      console.error("Gemini progress predictor error", response.status);
      return NextResponse.json({ error: response.status === 429 ? "AI request limit reached. Please try again later." : "The AI analysis could not be completed. Please try again." }, { status: response.status === 429 ? 429 : 502 });
    }
    const payload = await response.json();
    const generated = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
    if (!generated) return NextResponse.json({ error: "The AI returned an empty analysis. Please try again." }, { status: 502 });
    let result: unknown;
    try { result = JSON.parse(generated); } catch { return NextResponse.json({ error: "The AI returned an unreadable analysis. Please try again." }, { status: 502 }); }
    return NextResponse.json({ result });
  } catch (error) {
    console.error("AI learning progress predictor failure", error);
    return NextResponse.json({ error: "Unable to analyze progress right now. Please try again." }, { status: 500 });
  }
}
