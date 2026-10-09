import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HISTORY_MESSAGES = 10;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

type HistoryMessage = { role: "user" | "assistant"; content: string };

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Sign in to use the learning assistant." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const courseId = cleanText(body?.courseId, 100);
    const message = cleanText(body?.message, MAX_MESSAGE_LENGTH);
    const requestedLanguage = cleanText(body?.language, 30);
    const allowedLanguages = ["English", "Hausa", "Yoruba", "Igbo"];
    const language = allowedLanguages.includes(requestedLanguage) ? requestedLanguage : "English";

    if (!courseId || !message) {
      return NextResponse.json({ ok: false, error: "Choose a course and enter a question." }, { status: 400 });
    }
    if (typeof body?.message === "string" && body.message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ ok: false, error: "Your question is too long. Keep it under 4,000 characters." }, { status: 413 });
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id, enrollment_status, payment_status")
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (enrollmentError) {
      console.error("AI Learning Assistant enrollment validation failed:", enrollmentError);
      return NextResponse.json({ ok: false, error: "Unable to verify course enrollment." }, { status: 500 });
    }
    if (
      !enrollment ||
      !["active", "completed"].includes(enrollment.enrollment_status ?? "") ||
      !["free", "paid"].includes(enrollment.payment_status ?? "")
    ) {
      return NextResponse.json({ ok: false, error: "You need an eligible enrollment in this course to use course-specific assistance." }, { status: 403 });
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title, short_description, slug")
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ ok: false, error: "Unable to load the selected course." }, { status: 404 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("AI Learning Assistant requires GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY.");
      return NextResponse.json({ ok: false, error: "The AI assistant is not configured yet. Add your Gemini API key to the server environment." }, { status: 503 });
    }

    const historyInput = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];
    const history: HistoryMessage[] = historyInput
      .filter((item: unknown) => {
        if (!item || typeof item !== "object") return false;
        const entry = item as Record<string, unknown>;
        return (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string";
      })
      .map((item: Record<string, unknown>) => ({
        role: item.role as "user" | "assistant",
        content: cleanText(item.content, MAX_MESSAGE_LENGTH),
      }))
      .filter((item: HistoryMessage) => item.content.length > 0);

    const systemInstruction = [
      "You are RuffNeck Learn's practical AI learning assistant.",
      "Your goal is to help the learner understand concepts, practise skills, and reason independently.",
      `Selected course: ${course.title}. Course description: ${course.short_description || "No course description provided."}`,
      `Respond in ${language}. Preserve technical terms where helpful and explain them clearly.`,
      "Use clear headings and numbered steps when they improve readability. Prefer practical examples relevant to Nigerian learners, workplaces, education, and small businesses when appropriate.",
      "Do not claim you have seen lesson content, course files, or assessment answers that were not provided in this conversation.",
      "For homework or assessments, teach the method and provide feedback rather than encouraging dishonest submission. Ask one clarifying question when the request is too vague.",
      "Do not invent citations or claim to have verified current facts. Clearly flag uncertainty and recommend checking authoritative sources for consequential information.",
      "Do not ask the learner to share passwords, private records, payment details, or unnecessary personal information.",
      "Keep responses focused, supportive, and practical. End with a short practice step when it makes sense.",
    ].join("\n");

    const contents = [
      ...history.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { temperature: 0.55, maxOutputTokens: 1800 },
        }),
        signal: AbortSignal.timeout(35_000),
        cache: "no-store",
      }
    );

    const result = await geminiResponse.json().catch(() => null);
    if (!geminiResponse.ok) {
      console.error("Gemini learning assistant request failed:", geminiResponse.status, result?.error?.message || "Unknown Gemini API error");
      if (geminiResponse.status === 429) {
        return NextResponse.json({ ok: false, error: "The AI service is busy or its free-tier limit has been reached. Wait a little and try again." }, { status: 429 });
      }
      if (geminiResponse.status === 401 || geminiResponse.status === 403) {
        return NextResponse.json({ ok: false, error: "The Gemini API key was rejected. Check the server environment key and its API access." }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: "The AI service could not answer right now. Please try again shortly." }, { status: 502 });
    }

    const answer = Array.isArray(result?.candidates?.[0]?.content?.parts)
      ? result.candidates[0].content.parts
          .map((part: { text?: unknown }) => typeof part.text === "string" ? part.text : "")
          .join("")
          .trim()
      : "";

    if (!answer) {
      return NextResponse.json({ ok: false, error: "The AI service returned an empty response. Try rephrasing your question." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, answer, courseTitle: course.title });
  } catch (error) {
    console.error("AI Learning Assistant route failed:", error);
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { ok: false, error: isTimeout ? "The AI service took too long to respond. Please try again." : "Unexpected error while contacting the AI learning assistant." },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
