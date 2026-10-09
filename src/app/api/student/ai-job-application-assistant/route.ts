import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_TEXT = 12000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type Payload = { documentType?: unknown; role?: unknown; company?: unknown; jobDescription?: unknown; experience?: unknown; skills?: unknown; tone?: unknown };
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in to use the Job Application Assistant." }, { status: 401 });

    const body = await request.json() as Payload;
    const documentType = text(body.documentType, 40);
    const role = text(body.role, 180);
    const company = text(body.company, 180);
    const jobDescription = text(body.jobDescription, MAX_TEXT);
    const experience = text(body.experience, 8000);
    const skills = text(body.skills, 5000);
    const tone = text(body.tone, 40);
    const allowedTypes = new Set(["cover_letter", "application_email", "job_match_analysis", "application_pack"]);
    const allowedTones = new Set(["professional", "confident", "entry-level", "concise"]);
    if (!allowedTypes.has(documentType) || !allowedTones.has(tone) || !role || !jobDescription || !experience) {
      return NextResponse.json({ error: "Provide a valid document type, writing style, target role, job description, and experience." }, { status: 400 });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 503 });

    const prompt = `You are a careful job-application writing assistant. Draft the requested application material using ONLY the applicant facts supplied. Never invent qualifications, employers, dates, metrics, awards, references, or experience. If a key fact is missing, use a clear [ADD DETAIL] placeholder or mention the gap. Do not guarantee hiring outcomes. Do not claim the applicant meets a requirement unless their supplied facts support it. Be respectful and concise. Do not repeat unnecessary sensitive personal data.\n\nRequested output: ${documentType}\nWriting style: ${tone}\nTarget role: ${role}\nOrganisation: ${company || "Not specified"}\n\nVACANCY DESCRIPTION:\n${jobDescription}\n\nAPPLICANT EXPERIENCE AND ACHIEVEMENTS:\n${experience}\n\nAPPLICANT SKILLS AND CERTIFICATIONS:\n${skills || "Not provided"}\n\nInstructions: ${documentType === "job_match_analysis" ? "Give a grounded match analysis: supported matches, requirements not evidenced, honest skills gaps, and practical next steps. Do not fabricate a match score." : documentType === "application_email" ? "Write a suitable subject line and application email." : documentType === "application_pack" ? "Provide a cover letter, an application email with subject line, and a pre-submission checklist." : "Write a tailored cover letter with a professional opening, evidence-based fit, and clear close."}\nFormat with clear headings. Keep the result ready for the applicant to review and edit.`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.45, maxOutputTokens: 3000 } }),
      signal: AbortSignal.timeout(45000),
    });
    const resultBody = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      console.error("Gemini job application request failed", geminiResponse.status, resultBody?.error?.message || "Unknown provider error");
      return NextResponse.json({ error: "The AI service could not prepare the draft. Please try again later." }, { status: 502 });
    }
    const result = resultBody?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim();
    if (!result) return NextResponse.json({ error: "The AI service returned an empty draft. Please try again." }, { status: 502 });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("AI Job Application Assistant error", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "A server error occurred while preparing your draft." }, { status: 500 });
  }
}
