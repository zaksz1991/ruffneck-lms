import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Course = {
  id: string;
  title: string;
  slug: string;
};

type Assessment = {
  score: number | null;
};

type Project = {
  id: string;
};

type ApprovedSubmission = {
  score: number | null;
};

export async function POST(
  request: Request
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Authentication required.",
      },
      { status: 401 }
    );
  }

  let body: {
    courseId?: string;
  };

  try {
    body =
      (await request.json()) as {
        courseId?: string;
      };
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      { status: 400 }
    );
  }

  const courseId = body.courseId;

  if (!courseId) {
    return NextResponse.json(
      {
        error:
          "Course ID is required.",
      },
      { status: 400 }
    );
  }

  const { data: courseData } =
    await supabase
      .from("courses")
      .select("id, title, slug")
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle();

  const course =
    courseData as unknown as Course | null;

  if (!course) {
    return NextResponse.json(
      {
        error:
          "Course not found.",
      },
      { status: 404 }
    );
  }

  const { data: enrollment } =
    await supabase
      .from("enrollments")
      .select(
        "id, enrollment_status"
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

  if (
    !enrollment ||
    enrollment.enrollment_status !==
      "completed"
  ) {
    return NextResponse.json(
      {
        error:
          "Complete the course before requesting a certificate.",
      },
      { status: 403 }
    );
  }

  const { count: publishedLessons } =
    await supabase
      .from("lessons")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("course_id", courseId)
      .eq("is_published", true);

  const { count: completedLessons } =
    await supabase
      .from("lesson_progress")
      .select("lesson_id", {
        count: "exact",
        head: true,
      })
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .eq("completed", true);

  if (
    (publishedLessons || 0) === 0 ||
    (completedLessons || 0) <
      (publishedLessons || 0)
  ) {
    return NextResponse.json(
      {
        error:
          "Complete all published lessons before requesting a certificate.",
      },
      { status: 403 }
    );
  }

  const { data: assessmentData } =
    await supabase
      .from("assessment_attempts")
      .select("score")
      .eq(
        "student_id",
        user.id
      )
      .eq("course_id", courseId)
      .order("completed_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  const assessment =
    assessmentData as unknown as Assessment | null;

  if (!assessment) {
    return NextResponse.json(
      {
        error:
          "Complete the course assessment before requesting a certificate.",
      },
      { status: 403 }
    );
  }

  const { data: projectsData } =
    await supabase
      .from("course_projects")
      .select("id")
      .eq("course_id", courseId)
      .eq("is_published", true);

  const projects =
    (projectsData as unknown as Project[]) ||
    [];

  const projectIds = projects.map(
    (project) => project.id
  );

  if (projectIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "This course does not have a published capstone.",
      },
      { status: 403 }
    );
  }

  const { data: approvedData } =
    await supabase
      .from("project_submissions")
      .select("score")
      .in("project_id", projectIds)
      .eq("student_id", user.id)
      .eq("status", "approved")
      .order("reviewed_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  const approved =
    approvedData as unknown as ApprovedSubmission | null;

  if (!approved) {
    return NextResponse.json(
      {
        error:
          "Your capstone must be approved before a certificate can be issued.",
      },
      { status: 403 }
    );
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select(
        "full_name, email"
      )
      .eq("id", user.id)
      .maybeSingle();

  const holderName =
    profile?.full_name ||
    profile?.email ||
    "Learner";

  const { data: existing } =
    await supabase
      .from("course_certificates")
      .select(
        "id, certificate_number"
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

  if (existing) {
    return NextResponse.json({
      certificateId: existing.id,
      certificateNumber:
        existing.certificate_number,
    });
  }

  const { data: certificate, error } =
    await supabase
      .from("course_certificates")
      .insert({
        student_id: user.id,
        course_id: courseId,
        holder_name: holderName,
        course_title: course.title,
        course_slug: course.slug,
        assessment_score:
          assessment.score,
        capstone_score:
          approved.score,
        is_revoked: false,
      })
      .select(
        "id, certificate_number"
      )
      .single();

  if (error || !certificate) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to issue certificate.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    certificateId:
      certificate.id,
    certificateNumber:
      certificate.certificate_number,
  });
}