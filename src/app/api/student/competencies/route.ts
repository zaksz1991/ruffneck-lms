import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function labelFrom(row: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const [enrollmentResult, progressResult, submissionResult, skillsResult, certificatesResult] = await Promise.all([
    supabase.from("enrollments").select("course_id, progress_percent, enrollment_status, payment_status, created_at").eq("student_id", user.id),
    supabase.from("lesson_progress").select("course_id, lesson_id, completed").eq("student_id", user.id),
    supabase.from("project_submissions").select("id, project_id, status, score, created_at").eq("student_id", user.id),
    supabase.from("learner_skill_profiles").select("*").eq("student_id", user.id),
    supabase.from("course_certificates").select("*").eq("student_id", user.id),
  ]);

  // Optional tables may differ between installations; return the available signals instead of failing the whole dashboard.
  const enrollments = enrollmentResult.error ? [] : enrollmentResult.data ?? [];
  const progress = progressResult.error ? [] : progressResult.data ?? [];
  const submissions = submissionResult.error ? [] : submissionResult.data ?? [];
  const skillRows = skillsResult.error ? [] : skillsResult.data ?? [];
  const certificates = certificatesResult.error ? [] : certificatesResult.data ?? [];

  const courseIds = [...new Set(enrollments.map((row) => row.course_id).filter(Boolean))];
  let courseRows: Array<Record<string, unknown>> = [];
  if (courseIds.length) {
    const coursesResult = await supabase.from("courses").select("id, title, slug, level, duration_minutes").in("id", courseIds);
    if (!coursesResult.error && coursesResult.data) courseRows = coursesResult.data as Array<Record<string, unknown>>;
  }
  const courseById = new Map(courseRows.map((course) => [String(course.id), course]));

  const courseProgress = enrollments.map((enrollment) => {
    const course = courseById.get(String(enrollment.course_id)) ?? {};
    const relatedLessons = progress.filter((row) => String(row.course_id) === String(enrollment.course_id));
    const completedLessons = relatedLessons.filter((row) => row.completed === true).length;
    const percent = Math.max(0, Math.min(100, asNumber(enrollment.progress_percent) ?? (relatedLessons.length ? Math.round(completedLessons / relatedLessons.length * 100) : 0)));
    return {
      id: String(enrollment.course_id ?? course.slug ?? "course"),
      title: labelFrom(course, ["title"], "Enrolled course"),
      slug: labelFrom(course, ["slug"], ""),
      level: labelFrom(course, ["level"], "In progress"),
      progressPercent: Math.round(percent),
      completedLessons,
      trackedLessons: relatedLessons.length,
      enrollmentStatus: labelFrom(enrollment as Record<string, unknown>, ["enrollment_status"], "active"),
    };
  });

  const normalizedSkills = skillRows.map((row, index) => {
    const record = row as Record<string, unknown>;
    const skillName = labelFrom(record, ["skill_name", "name", "skill", "title"], `Skill ${index + 1}`);
    const rawScore = asNumber(record.confidence_score) ?? asNumber(record.proficiency_score) ?? asNumber(record.score) ?? asNumber(record.proficiency) ?? asNumber(record.confidence);
    const score = rawScore === null ? null : Math.round(Math.max(0, Math.min(100, rawScore <= 1 ? rawScore * 100 : rawScore)));
    return { id: String(record.id ?? index), name: skillName, score, level: labelFrom(record, ["proficiency_level", "level", "skill_level"], score === null ? "Profile recorded" : score >= 80 ? "Strong" : score >= 50 ? "Developing" : "Needs practice") };
  });

  const approved = submissions.filter((row) => ["approved", "completed", "passed"].includes(String(row.status ?? "").toLowerCase())).length;
  const reviewedScores = submissions.map((row) => asNumber(row.score)).filter((value): value is number => value !== null);
  const averageScore = reviewedScores.length ? Math.round(reviewedScores.reduce((sum, value) => sum + value, 0) / reviewedScores.length) : null;
  const completedCourses = courseProgress.filter((course) => course.progressPercent >= 100).length;
  const averageProgress = courseProgress.length ? Math.round(courseProgress.reduce((sum, course) => sum + course.progressPercent, 0) / courseProgress.length) : 0;
  const strengths = normalizedSkills.filter((skill) => skill.score !== null && skill.score >= 80).length;
  const needsPractice = normalizedSkills.filter((skill) => skill.score !== null && skill.score < 50).length;

  return NextResponse.json({
    summary: {
      enrolledCourses: courseProgress.length,
      completedCourses,
      averageProgress,
      approvedProjects: approved,
      submittedProjects: submissions.length,
      averageProjectScore: averageScore,
      certificates: certificates.length,
      trackedSkills: normalizedSkills.length,
      strengths,
      needsPractice,
    },
    courses: courseProgress,
    skills: normalizedSkills,
    projects: submissions.slice().sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))).slice(0, 8).map((row, index) => ({
      id: String(row.id ?? index),
      status: labelFrom(row as Record<string, unknown>, ["status"], "submitted"),
      score: asNumber(row.score),
      submittedAt: typeof row.created_at === "string" ? row.created_at : null,
    })),
    notices: [
      ...(enrollmentResult.error ? ["Course enrolment data could not be loaded from this database schema."] : []),
      ...(skillsResult.error ? ["Detailed skill profiles are not available yet; course and project signals are shown instead."] : []),
      ...(certificatesResult.error ? ["Certificate records could not be read; other competency data remains available."] : []),
    ],
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
