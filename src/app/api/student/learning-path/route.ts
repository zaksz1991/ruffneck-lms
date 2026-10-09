import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
function textValue(row: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) if (typeof row[key] === "string" && String(row[key]).trim()) return String(row[key]).trim();
  return fallback;
}
function scoreValue(row: Record<string, unknown>) {
  const raw = numberValue(row.confidence_score) ?? numberValue(row.proficiency_score) ?? numberValue(row.score) ?? numberValue(row.proficiency) ?? numberValue(row.confidence);
  if (raw === null) return null;
  return Math.round(Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw)));
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const [enrollmentResult, skillsResult, submissionResult] = await Promise.all([
    supabase.from("enrollments").select("course_id, progress_percent, enrollment_status, payment_status, created_at").eq("student_id", user.id),
    supabase.from("learner_skill_profiles").select("*").eq("student_id", user.id),
    supabase.from("project_submissions").select("id, status, score, created_at").eq("student_id", user.id),
  ]);

  const enrollments = enrollmentResult.error ? [] : enrollmentResult.data ?? [];
  const skillRows = skillsResult.error ? [] : (skillsResult.data ?? []) as Array<Record<string, unknown>>;
  const submissions = submissionResult.error ? [] : submissionResult.data ?? [];
  const courseIds = [...new Set(enrollments.map((e) => e.course_id).filter(Boolean))];
  let courses: Array<Record<string, unknown>> = [];
  const coursesResult = await supabase.from("courses").select("id, title, slug, short_description, level, duration_minutes, status, is_free, price_ngn").eq("status", "published");
  if (!coursesResult.error && coursesResult.data) courses = coursesResult.data as Array<Record<string, unknown>>;
  const courseById = new Map(courses.map((course) => [String(course.id), course]));

  const activeCourses = enrollments.map((enrollment) => {
    const course = courseById.get(String(enrollment.course_id)) ?? {};
    const progress = numberValue(enrollment.progress_percent) ?? 0;
    return {
      id: String(enrollment.course_id), title: textValue(course, ["title"], "Enrolled course"), slug: textValue(course, ["slug"], ""),
      progress: Math.round(Math.max(0, Math.min(100, progress))),
      level: textValue(course, ["level"], "All levels"),
      enrollmentStatus: textValue(enrollment as Record<string, unknown>, ["enrollment_status"], "active"),
    };
  }).sort((a, b) => a.progress - b.progress);

  const skills = skillRows.map((row, index) => ({
    id: String(row.id ?? index), name: textValue(row, ["skill_name", "name", "skill", "title"], `Skill ${index + 1}`),
    score: scoreValue(row), level: textValue(row, ["proficiency_level", "level", "skill_level"], "Recorded"),
  }));
  const weakSkills = skills.filter((skill) => skill.score !== null && skill.score < 70).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const unstartedOrEarly = activeCourses.filter((course) => course.progress < 35);
  const inProgress = activeCourses.filter((course) => course.progress >= 35 && course.progress < 100);
  const approvedProjects = submissions.filter((item) => ["approved", "completed", "passed"].includes(String(item.status ?? "").toLowerCase())).length;

  const recommendations: Array<{ type: string; title: string; reason: string; action: string; href: string; priority: number }> = [];
  if (weakSkills.length) recommendations.push({ type: "Skill focus", title: `Practise ${weakSkills[0].name}`, reason: `Your recorded score is ${weakSkills[0].score}%. Review the basics, then complete a practical exercise.`, action: "Open Practical Labs", href: "/student/labs", priority: 1 });
  if (inProgress.length) recommendations.push({ type: "Continue learning", title: `Continue ${inProgress[0].title}`, reason: `You have reached ${inProgress[0].progress}%. Finish the next lesson before starting something new.`, action: "Resume course", href: inProgress[0].slug ? `/courses/${inProgress[0].slug}` : "/student/learning", priority: 2 });
  if (unstartedOrEarly.length) recommendations.push({ type: "Build momentum", title: `Make progress in ${unstartedOrEarly[0].title}`, reason: `This course is at ${unstartedOrEarly[0].progress}%. Set aside a short study session and complete one lesson.`, action: "Open course", href: unstartedOrEarly[0].slug ? `/courses/${unstartedOrEarly[0].slug}` : "/student/learning", priority: 3 });
  if (submissions.length === 0 || approvedProjects === 0) recommendations.push({ type: "Practical experience", title: "Complete a practical lab", reason: "Apply course concepts to a real task and build evidence of your skills.", action: "Explore Practical Labs", href: "/student/labs", priority: 4 });
  if (!skills.length || skills.every((skill) => skill.score === null)) recommendations.push({ type: "Measure your skills", title: "Review your competency dashboard", reason: "Use available assessment and project results to identify your next development goal.", action: "View competencies", href: "/student/competencies", priority: 5 });
  recommendations.push({ type: "Study support", title: "Ask the AI Learning Assistant", reason: "Get an explanation, worked example, quiz, or study plan for a topic you are learning.", action: "Open AI Assistant", href: "/student/assistant", priority: 6 });
  recommendations.sort((a, b) => a.priority - b.priority);

  return NextResponse.json({
    overview: { enrolledCourses: activeCourses.length, coursesInProgress: inProgress.length, completedCourses: activeCourses.filter((course) => course.progress >= 100).length, skillsTracked: skills.length, projectsSubmitted: submissions.length, approvedProjects },
    recommendations: recommendations.slice(0, 5),
    courses: activeCourses.slice(0, 8),
    skills: skills.slice(0, 8),
    notices: [
      ...(enrollmentResult.error ? ["Enrollment data could not be loaded; course recommendations may be limited."] : []),
      ...(skillsResult.error ? ["Skill profile records are not available in this database setup; recommendations use other learning signals."] : []),
      ...(submissionResult.error ? ["Project submission data could not be loaded; practical recommendations are general."] : []),
      ...(coursesResult.error ? ["The published course catalogue could not be loaded."] : []),
    ],
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
