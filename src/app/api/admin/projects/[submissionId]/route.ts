import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Profile = {
  id: string;
  role:
    | "student"
    | "instructor"
    | "admin";
};

type Submission = {
  id: string;
  project_id: string;
  student_id: string;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
};

type Project = {
  id: string;
  course_id: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      submissionId: string;
    }>;
  }
) {
  const { submissionId } =
    await context.params;

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

  const { data: profileData } =
    await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

  const profile =
    profileData as unknown as Profile | null;

  if (
    !profile ||
    !["admin", "instructor"].includes(
      profile.role
    )
  ) {
    return NextResponse.json(
      {
        error:
          "You are not authorised to review projects.",
      },
      { status: 403 }
    );
  }

  let body: {
    status?: string;
    score?: number | null;
    feedback?: string;
  };

  try {
    body =
      (await request.json()) as {
        status?: string;
        score?: number | null;
        feedback?: string;
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

  const allowedStatuses = [
    "submitted",
    "under_review",
    "approved",
    "revision_required",
  ];

  if (
    !body.status ||
    !allowedStatuses.includes(
      body.status
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid review status.",
      },
      { status: 400 }
    );
  }

  const score =
    body.score === null ||
    body.score === undefined ||
    body.score === ""
      ? null
      : Number(body.score);

  if (
    score !== null &&
    (!Number.isInteger(score) ||
      score < 0 ||
      score > 100)
  ) {
    return NextResponse.json(
      {
        error:
          "Score must be between 0 and 100.",
      },
      { status: 400 }
    );
  }

  const { data: submissionData } =
    await supabase
      .from("project_submissions")
      .select(
        [
          "id",
          "project_id",
          "student_id",
          "status",
        ].join(", ")
      )
      .eq("id", submissionId)
      .maybeSingle();

  const submission =
    submissionData as unknown as Submission | null;

  if (!submission) {
    return NextResponse.json(
      {
        error:
          "Submission not found.",
      },
      { status: 404 }
    );
  }

  const { data: projectData } =
    await supabase
      .from("course_projects")
      .select(
        "id, course_id"
      )
      .eq("id", submission.project_id)
      .maybeSingle();

  const project =
    projectData as unknown as Project | null;

  if (!project) {
    return NextResponse.json(
      {
        error: "Project not found.",
      },
      { status: 404 }
    );
  }

  const { data: courseData } =
    await supabase
      .from("courses")
      .select("id, title, slug")
      .eq("id", project.course_id)
      .maybeSingle();

  const course =
    courseData as unknown as Course | null;

  if (!course) {
    return NextResponse.json(
      {
        error: "Course not found.",
      },
      { status: 404 }
    );
  }

  if (
    profile.role !== "admin"
  ) {
    const { data: ownedCourse } =
      await supabase
        .from("courses")
        .select("id")
        .eq("id", project.course_id)
        .eq(
          "instructor_id",
          user.id
        )
        .maybeSingle();

    if (!ownedCourse) {
      return NextResponse.json(
        {
          error:
            "You do not manage this course.",
        },
        { status: 403 }
      );
    }
  }

  const timestamp =
    new Date().toISOString();

  const { error } =
    await supabase
      .from("project_submissions")
      .update({
        status: body.status,
        score,
        feedback:
          typeof body.feedback === "string"
            ? body.feedback.trim() ||
              null
            : null,
        reviewed_at: timestamp,
        reviewed_by: user.id,
        updated_at: timestamp,
      })
      .eq("id", submission.id);

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }

  /*
   * Revision required:
   * keep the course active because the learner
   * needs to resubmit.
   */
  if (
    body.status ===
    "revision_required"
  ) {
    await supabase
      .from("enrollments")
      .update({
        enrollment_status:
          "active",
        completed_at: null,
      })
      .eq(
        "student_id",
        submission.student_id
      )
      .eq(
        "course_id",
        project.course_id
      );

    return NextResponse.json({
      message:
        "Revision requested. The student can now update and resubmit the project.",
    });
  }

  /*
   * Approval:
   * course completion requires:
   * 1. All published lessons completed
   * 2. At least one course assessment completed
   * 3. Approved capstone
   */
  if (
    body.status === "approved"
  ) {
    const { count: publishedLessons } =
      await supabase
        .from("lessons")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "course_id",
          project.course_id
        )
        .eq("is_published", true);

    const { count: completedLessons } =
      await supabase
        .from("lesson_progress")
        .select("lesson_id", {
          count: "exact",
          head: true,
        })
        .eq(
          "student_id",
          submission.student_id
        )
        .eq(
          "course_id",
          project.course_id
        )
        .eq("completed", true);

    const { count: assessmentAttempts } =
      await supabase
        .from("assessment_attempts")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "student_id",
          submission.student_id
        )
        .eq(
          "course_id",
          project.course_id
        );

    const courseComplete =
      (publishedLessons || 0) > 0 &&
      (completedLessons || 0) >=
        (publishedLessons || 0) &&
      (assessmentAttempts || 0) > 0;

    if (courseComplete) {
      await supabase
        .from("enrollments")
        .update({
          enrollment_status:
            "completed",
          completed_at:
            timestamp,
          progress_percent: 100,
        })
        .eq(
          "student_id",
          submission.student_id
        )
        .eq(
          "course_id",
          project.course_id
        );

      /*
       * Create the certificate automatically.
       * Certificate RLS also validates eligibility.
       */
      const { data: latestAssessment } =
        await supabase
          .from("assessment_attempts")
          .select("score")
          .eq(
            "student_id",
            submission.student_id
          )
          .eq(
            "course_id",
            project.course_id
          )
          .order("completed_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      const { data: studentProfile } =
        await supabase
          .from("profiles")
          .select(
            "full_name, email"
          )
          .eq(
            "id",
            submission.student_id
          )
          .maybeSingle();

      const holderName =
        studentProfile?.full_name ||
        studentProfile?.email ||
        "Learner";

      const { error: certificateError } =
        await supabase
          .from(
            "course_certificates"
          )
          .upsert(
            {
              student_id:
                submission.student_id,
              course_id:
                project.course_id,
              holder_name:
                holderName,
              course_title:
                course.title,
              course_slug:
                course.slug,
              assessment_score:
                latestAssessment?.score ??
                null,
              capstone_score:
                score,
              issued_at:
                timestamp,
              is_revoked: false,
              revoked_at: null,
              revoked_reason: null,
              updated_at: timestamp,
            },
            {
              onConflict:
                "student_id,course_id",
            }
          );

      if (certificateError) {
        console.error(
          "Certificate issuance failed:",
          certificateError
        );
      }
    }
  }

  const { error: activityError } =
    await supabase
      .from("learning_activity")
      .insert({
        student_id:
          submission.student_id,
        course_id:
          project.course_id,
        activity_type:
          body.status === "approved"
            ? "project_approved"
            : "project_reviewed",
        metadata: {
          project_id:
            project.id,
          submission_id:
            submission.id,
          status:
            body.status,
          score,
        },
      });

  if (activityError) {
    console.error(
      "Project review activity logging failed:",
      activityError
    );
  }

  return NextResponse.json({
    message:
      body.status === "approved"
        ? "Project approved and review saved."
        : "Project review saved.",
  });
}