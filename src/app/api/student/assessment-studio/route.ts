import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const ASSESSMENTS: Record<string, { title: string; area: string; level: string; task: string; criteria: string[] }> = {
  "prompt-design": {
    title: "Design a reliable AI prompt", area: "Prompt Engineering", level: "Beginner",
    task: "Write a reusable prompt that asks an AI assistant to draft a professional weekly operations report. The report must separate verified facts from assumptions, summarise key figures, flag missing information, and use clear headings. Include the role, context, inputs, constraints, and expected output format.",
    criteria: ["Clear objective and context", "Useful inputs and constraints", "Specific output format", "Accuracy and uncertainty safeguards"],
  },
  "business-report": {
    title: "Prepare an executive report outline", area: "Office Administration", level: "Intermediate",
    task: "A small distribution business experienced delayed deliveries, incomplete stock records, and an increase in customer complaints last month. Prepare an executive report outline with an issue summary, evidence to collect, root-cause investigation, practical recommendations, responsible roles, and measurable follow-up indicators. Do not invent figures.",
    criteria: ["Logical structure", "Evidence-based reasoning", "Actionable recommendations", "Measurable follow-up"],
  },
  "data-quality": {
    title: "Plan a spreadsheet data-quality check", area: "Excel and Reporting", level: "Intermediate",
    task: "You receive a spreadsheet containing customer names, phone numbers, order dates, quantities, unit prices, and order totals. Describe a practical validation workflow to find missing values, duplicate orders, invalid dates, non-numeric quantities, and totals that do not equal quantity multiplied by unit price. Include example Excel formulas where useful.",
    criteria: ["Coverage of data-quality risks", "Correct validation methods", "Appropriate formulas", "Repeatable review process"],
  },
  "lesson-plan": {
    title: "Build an outcomes-based lesson plan", area: "Teaching and Lesson Planning", level: "Intermediate",
    task: "Create a 40-minute lesson plan that teaches beginners how to identify phishing messages. Include measurable learning outcomes, an opening activity, explanation, guided practice, an individual assessment, materials, accessibility considerations, and a short reflection. Do not ask learners to open suspicious links.",
    criteria: ["Measurable learning outcomes", "Practical lesson sequence", "Assessment alignment", "Safety and accessibility"],
  },
  "records-workflow": {
    title: "Design a digital records workflow", area: "Records Management", level: "Intermediate",
    task: "Design a digital filing and retrieval workflow for a small office that stores invoices, staff records, supplier documents, and correspondence. Cover naming conventions, folder structure, access permissions, retention review, backups, version control, and a simple retrieval test. Avoid exposing confidential personal data.",
    criteria: ["Consistent classification and naming", "Access and confidentiality controls", "Retention and backup controls", "Retrieval and auditability"],
  },
};

type RubricItem = { name: string; score: number; feedback: string };
type Review = { score: number; result: string; criteria: RubricItem[]; strengths: string[]; improvements: string[]; nextStep: string; disclaimer: string };

function clampScore(value: unknown, maximum: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(maximum, Math.round(number))) : 0;
}

function cleanList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 6);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in before submitting an assessment." }, { status: 401 });

    const body = await request.json();
    const assessmentId = typeof body.assessmentId === "string" ? body.assessmentId : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    const language = typeof body.language === "string" && ["English", "Hausa", "Yoruba", "Igbo"].includes(body.language) ? body.language : "English";
    const assessment = ASSESSMENTS[assessmentId];
    if (!assessment) return NextResponse.json({ error: "Choose a valid assessment." }, { status: 400 });
    if (answer.length < 30 || answer.length > 12000) return NextResponse.json({ error: "Your submission must contain between 30 and 12,000 characters." }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI review is not configured. Add GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY to the server environment." }, { status: 503 });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const prompt = `You are a formative assessment coach for RuffNeck Learn. Review the submission fairly and educationally. Do not assume facts not provided, and do not claim to execute code or inspect files. The learner can improve and retry; this is not a formal qualification or high-stakes grade. Return ONLY valid JSON matching this schema: {"score": number 0-100, "result": string, "criteria": [{"name": string, "score": number 0-25, "feedback": string}], "strengths": string[], "improvements": string[], "nextStep": string}. Use exactly these criteria in order: ${JSON.stringify(assessment.criteria)}. Score each criterion from 0 to 25 based on evidence in the submission; score total should equal the sum of criterion scores. Provide 2-4 concise strengths and improvements, and a specific next step. Respond in ${language} where practical, while preserving technical terms when helpful.

Assessment: ${assessment.title}
Skill area: ${assessment.area}
Level: ${assessment.level}
Task: ${assessment.task}
Learner submission: ${answer}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 2200, responseMimeType: "application/json" } }),
        signal: controller.signal,
      });
    } finally { clearTimeout(timeout); }

    const providerPayload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("Assessment Studio Gemini request failed", response.status, providerPayload?.error?.message || "No provider message");
      return NextResponse.json({ error: response.status === 429 ? "The AI service is busy or its free-tier limit has been reached. Try again shortly." : "The AI review failed. Check the configured Gemini model and API key, then retry." }, { status: response.status === 429 ? 429 : 502 });
    }
    const raw = providerPayload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim();
    if (!raw) return NextResponse.json({ error: "The AI service returned an empty review. Please try again." }, { status: 502 });

    let parsed: Partial<Review>;
    try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
    catch { return NextResponse.json({ error: "The AI service returned a review in an unexpected format. Please retry." }, { status: 502 }); }

    const criteria: RubricItem[] = assessment.criteria.map((name, index) => {
      const candidate = Array.isArray(parsed.criteria) ? parsed.criteria[index] : undefined;
      return { name, score: clampScore(candidate?.score, 25), feedback: typeof candidate?.feedback === "string" ? candidate.feedback.slice(0, 1200) : "Review this criterion and try to make the evidence in your submission more explicit." };
    });
    const score = criteria.reduce((total, item) => total + item.score, 0);
    const review: Review = {
      score,
      result: score >= 85 ? "Strong performance" : score >= 70 ? "Good progress" : score >= 50 ? "Developing skills" : "Further practice recommended",
      criteria,
      strengths: cleanList(parsed.strengths, ["You made an attempt and provided material that can be improved."]),
      improvements: cleanList(parsed.improvements, ["Use the rubric to make your reasoning and evidence more explicit."]),
      nextStep: typeof parsed.nextStep === "string" ? parsed.nextStep.slice(0, 1200) : "Revise your submission using the rubric feedback, then try again.",
      disclaimer: "AI-generated formative feedback may be inaccurate. Review consequential assessments with a qualified instructor.",
    };

    let attemptId: string | undefined;
    const { data: saved, error: saveError } = await supabase.from("learner_practical_assessment_attempts").insert({
      student_id: user.id,
      assessment_key: assessmentId,
      assessment_title: assessment.title,
      skill_area: assessment.area,
      submission_text: answer,
      score: review.score,
      feedback: review,
      status: "reviewed",
    }).select("id").single();
    if (saveError) {
      console.error("Assessment attempt save failed", saveError.message);
      return NextResponse.json({ error: "Your review was generated but could not be saved. Apply the database migration, then submit again." }, { status: 500 });
    }
    attemptId = saved?.id;
    return NextResponse.json({ review: { ...review, attemptId } });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return NextResponse.json({ error: "The review took too long. Please try again with a shorter submission." }, { status: 504 });
    console.error("Assessment Studio route error", error);
    return NextResponse.json({ error: "Something went wrong while reviewing your submission." }, { status: 500 });
  }
}
