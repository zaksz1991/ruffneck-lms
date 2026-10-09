import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load achievement data.";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in to view your learning achievements." }, { status: 401 });
    }

    // Each query is scoped to the authenticated user. Missing optional tables/columns
    // are reported as notices rather than causing the entire dashboard to fail.
    const notices: string[] = [];
    const [enrollmentResult, progressResult, certificatesResult, projectsResult, skillsResult] = await Promise.all([
      supabase.from("enrollments").select("id, course_id, enrollment_status, progress_percent, courses(id,title,slug)").eq("student_id", user.id),
      supabase.from("lesson_progress").select("id, completed, course_id").eq("student_id", user.id),
      supabase.from("course_certificates").select("id, certificate_number, issued_at, course_id").eq("student_id", user.id),
      supabase.from("project_submissions").select("id, status, score, created_at").eq("student_id", user.id),
      supabase.from("learner_skill_profiles").select("id, skill_name, skill_level, score").eq("student_id", user.id),
    ]);

    if (enrollmentResult.error) notices.push("Course enrolment details could not be loaded. Check the enrollments table schema and RLS policies.");
    if (progressResult.error) notices.push("Lesson completion history is unavailable. Check the lesson_progress table schema and RLS policies.");
    if (certificatesResult.error) notices.push("Certificate records could not be loaded. Check the course_certificates table schema and RLS policies.");
    if (projectsResult.error) notices.push("Practical project records could not be loaded. Check the project_submissions table schema and RLS policies.");
    if (skillsResult.error) notices.push("Skill profile records could not be loaded. Check the learner_skill_profiles table schema and RLS policies.");

    const enrollments = enrollmentResult.error ? [] : enrollmentResult.data ?? [];
    const progress = progressResult.error ? [] : progressResult.data ?? [];
    const certificates = certificatesResult.error ? [] : certificatesResult.data ?? [];
    const projects = projectsResult.error ? [] : projectsResult.data ?? [];
    const skills = skillsResult.error ? [] : skillsResult.data ?? [];

    const courses = enrollments.map((enrollment: any) => {
      const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
      const lessons = progress.filter((item: any) => item.course_id === enrollment.course_id);
      const completedLessons = lessons.filter((item: any) => item.completed).length;
      const recordedPercent = Number(enrollment.progress_percent ?? 0);
      return {
        id: String(enrollment.course_id),
        title: course?.title ?? "Enrolled course",
        slug: course?.slug ?? "",
        status: String(enrollment.enrollment_status ?? "active"),
        progressPercent: Math.max(0, Math.min(100, Number.isFinite(recordedPercent) ? recordedPercent : 0)),
        completedLessons,
      };
    });

    const approvedProjects = projects.filter((item: any) => ["approved", "completed", "passed"].includes(String(item.status ?? "").toLowerCase())).length;
    const completedCourses = courses.filter((course: any) => course.progressPercent >= 100 || ["completed", "complete"].includes(course.status.toLowerCase())).length;
    const averageProgress = courses.length ? Math.round(courses.reduce((sum: number, course: any) => sum + course.progressPercent, 0) / courses.length) : 0;

    return NextResponse.json({
      summary: {
        enrolledCourses: courses.length,
        completedCourses,
        averageProgress,
        certificates: certificates.length,
        projectSubmissions: projects.length,
        approvedProjects,
        trackedSkills: skills.length,
      },
      courses,
      certificates: certificates.map((item: any) => ({
        id: String(item.id),
        number: item.certificate_number ? String(item.certificate_number) : null,
        issuedAt: item.issued_at ? String(item.issued_at) : null,
      })),
      projects: projects.map((item: any) => ({
        id: String(item.id),
        status: String(item.status ?? "submitted"),
        score: item.score === null || item.score === undefined ? null : Number(item.score),
        createdAt: item.created_at ? String(item.created_at) : null,
      })),
      skills: skills.map((item: any) => ({
        id: String(item.id),
        name: String(item.skill_name ?? "Skill"),
        level: String(item.skill_level ?? "in progress"),
        score: item.score === null || item.score === undefined ? null : Number(item.score),
      })),
      notices,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: messageOf(error) }, { status: 500 });
  }
}
