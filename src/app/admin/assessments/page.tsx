import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminAssessmentEditor from "./AdminAssessmentEditor";

type PageProps = {
  searchParams: Promise<{
    course?: string;
  }>;
};

type Role =
  | "admin"
  | "instructor"
  | "student";

type Course = {
  id: string;
  title: string;
  instructor_id: string | null;
};

export default async function AdminAssessmentsPage({
  searchParams,
}: PageProps) {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/admin/assessments"
    );
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    throw new Error(
      "Unable to verify admin access."
    );
  }

  const role =
    profile?.role as Role | null;

  if (
    role !== "admin" &&
    role !== "instructor"
  ) {
    redirect(
      "/student/dashboard"
    );
  }

  let query = supabase
    .from("courses")
    .select(
      "id, title, instructor_id"
    )
    .order("title", {
      ascending: true,
    });

  if (role === "instructor") {
    query = query.eq(
      "instructor_id",
      user.id
    );
  }

  const {
    data: courseData,
    error: courseError,
  } = await query;

  if (courseError) {
    throw new Error(
      "Unable to load courses."
    );
  }

  const courses =
    (courseData ??
      []) as unknown as Course[];

  const params =
    await searchParams;

  const requestedCourseId =
    params.course?.trim() || "";

  const initialCourseId =
    courses.some(
      (course) =>
        course.id ===
        requestedCourseId
    )
      ? requestedCourseId
      : courses[0]?.id;

  return (
    <section className="section">
      <div
        className="container"
        style={{
          maxWidth: 1280,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <div className="rn-brand-kicker">
              RuffNeck Learn
            </div>

            <h1
              style={{
                margin:
                  "4px 0 0",
              }}
            >
              Assessment Management
            </h1>

            <p
              className="muted"
              style={{
                margin:
                  "7px 0 0",
              }}
            >
              Create, review, edit,
              reorder, and remove
              course assessment
              questions.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/admin/lms"
              className="btn btn-ghost"
            >
              LMS Admin
            </Link>

            <Link
              href="/admin/ai-drafts"
              className="btn btn-primary"
            >
              AI Drafts
            </Link>
          </div>
        </div>

        <AdminAssessmentEditor
          courses={courses}
          initialCourseId={
            initialCourseId
          }
        />
      </div>
    </section>
  );
}