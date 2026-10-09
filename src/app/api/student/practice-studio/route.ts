import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_RESPONSE_LENGTH = 12000;
const ALLOWED_AREAS = new Set([
  "Prompt Engineering",
  "AI-Assisted Writing",
  "Data Analysis",
  "Excel and Reporting",
  "Digital Marketing",
  "Teaching and Lesson Planning",
  "Office Administration",
  "Records Management",
  "Business Problem Solving",
]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in to use Practice Studio." }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI practice is not configured yet. Add GEMINI_API_KEY to your server environment variables." }, { status: 503 });
    }

    const body = await request.json();
    const area = typeof body.area === "string" ? body.area : "";
    const task = typeof body.task === "string" ? body.task.trim() : "";
    const responseText = typeof body.response === "string" ? body.response.trim() : "";
    const level = typeof body.level === "string" ? body.level : "Beginner";
    const language = typeof body.language === "string" ? body.language : "English";

    if (!ALLOWED_AREAS.has(area)) {
      return NextResponse.json({ error: "Choose a valid practice area." }, { status: 400 });
    }
    if (!task || task.length > 4000 || !responseText || responseText.length > MAX_RESPONSE_LENGTH) {
      return NextResponse.json({ error: "Enter a task and a response. Keep the task under 4,000 characters and your response under 12,000 characters." }, { status: 400 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const prompt = `You are the feedback coach in RuffNeck Learn, a professional skills learning platform. Review the learner's attempt and help them improve.\n\nPractice area: ${area}\nLearner level: ${level}\nReply language: ${language}\nTask: ${task}\nLearner's attempt:\n${responseText}\n\nReturn concise, constructive feedback using these headings: 1. What worked 2. What to improve 3. Suggested improved version or worked solution 4. One follow-up practice challenge. Be specific and educational. Do not claim to have executed code, opened files, or verified facts you have not verified. If the task involves spreadsheet formulas or calculations, explain assumptions and show the formula or working. Do not award a formal qualification or certificate.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 1800 },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const providerMessage = payload?.error?.message;
      console.error("Practice Studio Gemini request failed", response.status, providerMessage || "No provider message");
      return NextResponse.json({ error: response.status === 429 ? "The AI service is busy or the free-tier limit has been reached. Try again shortly." : "The AI service could not complete this review. Check the configured Gemini model and API key, then try again." }, { status: response.status === 429 ? 429 : 502 });
    }

    const feedback = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("\n")
      .trim();

    if (!feedback) {
      return NextResponse.json({ error: "The AI service returned an empty review. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "The review took too long. Please try again with a shorter response." }, { status: 504 });
    }
    console.error("Practice Studio route error", error);
    return NextResponse.json({ error: "Something went wrong while reviewing your practice. Please try again." }, { status: 500 });
  }
}
