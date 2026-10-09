import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 4000;
const HISTORY_LIMIT = 24;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type DbMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };

async function getUserAndClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const { supabase, user } = await getUserAndClient();
  if (!user) return errorResponse("Please sign in to use the AI Study Coach.", 401);
  const { data, error } = await supabase
    .from("learner_ai_study_coach_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);
  if (error) {
    console.error("Study Coach history query failed:", error.message);
    return errorResponse("Could not load your conversation. Confirm the Study Coach database migration has been applied.", 500);
  }
  return NextResponse.json({ messages: (data ?? []) as DbMessage[] });
}

export async function POST(request: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return errorResponse("Please sign in to use the AI Study Coach.", 401);

  let body: { message?: unknown; courseTitle?: unknown };
  try { body = await request.json(); } catch { return errorResponse("Request body must be valid JSON.", 400); }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const courseTitle = typeof body.courseTitle === "string" ? body.courseTitle.trim().slice(0, 200) : "General learning";
  if (!message) return errorResponse("Enter a question before sending.", 400);
  if (message.length > MAX_MESSAGE_LENGTH) return errorResponse(`Your message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`, 400);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse("The Study Coach is not configured yet. Add GEMINI_API_KEY to the server environment variables.", 503);

  const { data: priorData, error: historyError } = await supabase
    .from("learner_ai_study_coach_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (historyError) {
    console.error("Study Coach history lookup failed:", historyError.message);
    return errorResponse("Could not access your saved conversation. Check the database migration.", 500);
  }

  const insertUser = await supabase.from("learner_ai_study_coach_messages").insert({
    user_id: user.id,
    role: "user",
    content: message,
    course_title: courseTitle,
  });
  if (insertUser.error) {
    console.error("Study Coach user message insert failed:", insertUser.error.message);
    return errorResponse("Could not save your question. Please try again.", 500);
  }

  const history = (priorData ?? []).reverse().map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: String(item.content).slice(0, MAX_MESSAGE_LENGTH) }],
  }));
  history.push({ role: "user", parts: [{ text: message }] });

  const prompt = `You are RuffNeck Learn's AI Study Coach. Help learners understand and apply course material.\nLearning context: ${courseTitle || "General learning"}.\n\nGuidelines:\n- Explain concepts clearly, in logical steps, and adapt to the learner's question.\n- Prefer practical examples relevant to Nigerian workplaces, businesses, education, and everyday tasks when appropriate.\n- When asked to quiz the learner, ask one question at a time and wait for their answer.\n- Encourage reasoning; do not claim to know the learner's actual assessment answers or course records unless provided in the conversation.\n- State uncertainty and correct misconceptions respectfully.\n- Use headings and concise bullet points where useful.\n- Never request passwords, payment details, or unnecessary sensitive personal information.`;

  let answer = "";
  try {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt }] },
        contents: history,
        generationConfig: { temperature: 0.5, maxOutputTokens: 1400 },
      }),
      signal: AbortSignal.timeout(45000),
    });
    const result = await geminiResponse.json();
    if (!geminiResponse.ok) {
      console.error("Gemini Study Coach request failed:", geminiResponse.status, result?.error?.message ?? "unknown error");
      const status = geminiResponse.status === 429 ? 429 : 502;
      return errorResponse(status === 429 ? "The AI service is busy or its quota has been reached. Wait a little and try again." : "The AI service could not answer right now. Please try again shortly.", status);
    }
    answer = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("\n").trim() ?? "";
    if (!answer) return errorResponse("The AI service returned an empty answer. Please try again.", 502);
  } catch (error) {
    console.error("Gemini Study Coach network error:", error instanceof Error ? error.message : "unknown error");
    return errorResponse("The AI service could not be reached. Please try again shortly.", 502);
  }

  const insertAssistant = await supabase.from("learner_ai_study_coach_messages").insert({
    user_id: user.id,
    role: "assistant",
    content: answer,
    course_title: courseTitle,
  });
  if (insertAssistant.error) {
    console.error("Study Coach answer insert failed:", insertAssistant.error.message);
    return NextResponse.json({ answer, warning: "Your answer was generated but could not be saved to history." });
  }

  const { data: messages, error: finalError } = await supabase
    .from("learner_ai_study_coach_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);
  if (finalError) return NextResponse.json({ answer });
  return NextResponse.json({ messages: (messages ?? []) as DbMessage[], answer });
}

export async function DELETE() {
  const { supabase, user } = await getUserAndClient();
  if (!user) return errorResponse("Please sign in to manage your Study Coach conversation.", 401);
  const { error } = await supabase.from("learner_ai_study_coach_messages").delete().eq("user_id", user.id);
  if (error) {
    console.error("Study Coach clear history failed:", error.message);
    return errorResponse("Could not clear your saved conversation.", 500);
  }
  return NextResponse.json({ success: true });
}
