import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTEXT = 3000;
const MAX_ANSWER = 6000;
const MAX_QUESTION_HISTORY = 8;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type RequestBody = {
  action?: "start" | "feedback" | "next";
  role?: string;
  level?: string;
  interviewType?: string;
  context?: string;
  question?: string;
  answer?: string;
  previousQuestions?: string[];
};

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  return candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n").trim() || "";
}

async function generate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured on the server.");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.65, maxOutputTokens: 900 } }),
    signal: AbortSignal.timeout(30000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" ? (payload as { error?: { message?: string } }).error?.message : undefined;
    throw new Error(message || `Gemini request failed (${response.status}).`);
  }
  const text = extractText(payload);
  if (!text) throw new Error("The AI returned an empty response. Please try again.");
  return text;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, error: "Please sign in to use the interview simulator." }, { status: 401 });

    let body: RequestBody;
    try { body = await request.json() as RequestBody; }
    catch { return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 }); }

    const action = body.action;
    if (!action || !["start", "next", "feedback"].includes(action)) return NextResponse.json({ ok: false, error: "Choose a valid interview action." }, { status: 400 });
    const role = clean(body.role, 120);
    const level = clean(body.level, 80) || "Entry level";
    const interviewType = clean(body.interviewType, 100) || "Behavioural and competency";
    const context = clean(body.context, MAX_CONTEXT);
    const question = clean(body.question, 1500);
    const answer = clean(body.answer, MAX_ANSWER);
    const previousQuestions = Array.isArray(body.previousQuestions)
      ? body.previousQuestions.filter((item): item is string => typeof item === "string").slice(-MAX_QUESTION_HISTORY).map(item => clean(item, 500))
      : [];

    if (!role) return NextResponse.json({ ok: false, error: "Enter the target role first." }, { status: 400 });
    if (action === "feedback" && (!question || !answer)) return NextResponse.json({ ok: false, error: "Provide the current question and your answer." }, { status: 400 });

    const shared = `Target role: ${role}\nExperience level: ${level}\nInterview focus: ${interviewType}\nJob context and skills: ${context || "Not supplied"}`;
    if (action === "feedback") {
      const prompt = `You are a constructive interview coach for a professional learning platform. Evaluate a practice interview answer, not a live exam.\n${shared}\nQuestion: ${question}\nCandidate answer: ${answer}\n\nGive concise, practical feedback using these headings: Overall assessment; What worked; What to improve; Suggested structure (use STAR only when suitable); One concrete practice tip. Do not invent experience or credentials. If the answer lacks evidence, ask the candidate to add a truthful specific example. Be respectful and specific. Clearly frame any sample wording as an example to adapt honestly. Do not claim to predict hiring outcomes.`;
      const feedback = await generate(prompt);
      return NextResponse.json({ ok: true, feedback });
    }

    const avoid = previousQuestions.length ? `Avoid repeating these questions: ${previousQuestions.map(q => `- ${q}`).join("\n")}` : "This is the first question.";
    const prompt = `You are a realistic but fair job interviewer conducting practice for a learning platform.\n${shared}\n${avoid}\nAsk exactly ONE concise interview question suited to the role, level, and focus. Do not provide the answer, hints, evaluation, preamble, or numbering. Return only the question text. Make it practical and specific when possible.`;
    const nextQuestion = await generate(prompt);
    return NextResponse.json({ ok: true, question: nextQuestion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The interview coach is temporarily unavailable.";
    const status = /GEMINI_API_KEY is not configured/.test(message) ? 503 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
