import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Enrollment = {
  course_id: string;
  enrollment_status: string;
};

type PracticalTask = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string;
  submission_type:
    | "text"
    | "document"
    | "spreadsheet"
    | "presentation"
    | "mixed";
  max_score: number;
  sort_order: number;
  is_published: boolean;
  skill_id: string | null;
};

type PracticalSubmission = {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string | null;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
}

export async function GET() {
  try {
    const { supabase, user } =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const {
      data: enrollmentData,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select(
        "course_id, enrollment_status"
      )
      .eq("student_id", user.id)
      .in("enrollment_status", [
        "active",
        "completed",
      ]);

    if (enrollmentError) {
      console.error(
        "Practical work enrollment error:",
        enrollmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your course access.",
        },
        { status: 500 }
      );
    }

    const enrollments =
      (enrollmentData ?? []) as Enrollment[];

    const courseIds = [
      ...new Set(
        enrollments.map(
          (enrollment) =>
            enrollment.course_id
        )
      ),
    ];

    if (courseIds.length === 0) {
      return NextResponse.json({
        tasks: [],
        submissions: [],
      });
    }

    const {
      data: taskData,
      error: taskError,
    } = await supabase
      .from("course_practical_tasks")
      .select(
        `
          id,
          course_id,
          title,
          scenario,
          instructions,
          expected_outcome,
          submission_type,
          max_score,
          sort_order,
          is_published,
          skill_id
        `
      )
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("sort_order", {
        ascending: true,
      });

    if (taskError) {
      console.error(
        "Practical tasks load error:",
        taskError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load practical tasks.",
        },
        { status: 500 }
      );
    }

    /*
     * Supabase's generated response type can become a
     * GenericStringError when the project database types
     * do not contain the newest practical-work columns.
     *
     * Cast the validated response explicitly so this
     * route remains compatible with the current schema.
     */
    const tasks =
      (taskData ?? []) as unknown as PracticalTask[];

    const taskIds = tasks.map(
      (task) => task.id
    );

    let submissions: PracticalSubmission[] = [];

    if (taskIds.length > 0) {
      const {
        data: submissionData,
        error: submissionError,
      } = await supabase
        .from(
          "student_practical_task_submissions"
        )
        .select(
          `
            id,
            task_id,
            student_id,
            submission_text,
            status,
            score,
            reviewer_feedback,
            submitted_at,
            reviewed_at
          `
        )
        .eq("student_id", user.id)
        .in("task_id", taskIds);

      if (submissionError) {
        console.error(
          "Practical submissions load error:",
          submissionError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load your practical submissions.",
          },
          { status: 500 }
        );
      }

      submissions =
        (submissionData ??
          []) as unknown as PracticalSubmission[];
    }

    const submissionMap = new Map<
      string,
      PracticalSubmission
    >();

    for (const submission of submissions) {
      submissionMap.set(
        submission.task_id,
        submission
      );
    }

    const enrichedTasks = tasks.map((task) => ({
      ...task,
      submission:
        submissionMap.get(task.id) ?? null,
    }));

    return NextResponse.json({
      tasks: enrichedTasks,
      submissions,
    });
  } catch (error) {
    console.error(
      "Practical work GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while loading practical work.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const { supabase, user } =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    let body: {
      taskId?: unknown;
      submissionText?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const taskId =
      typeof body.taskId === "string"
        ? body.taskId.trim()
        : "";

    const submissionText =
      typeof body.submissionText === "string"
        ? body.submissionText.trim()
        : "";

    if (!taskId) {
      return NextResponse.json(
        {
          error: "Task ID is required.",
        },
        { status: 400 }
      );
    }

    if (!submissionText) {
      return NextResponse.json(
        {
          error:
            "Please enter your practical work before submitting.",
        },
        { status: 400 }
      );
    }

    if (submissionText.length > 50000) {
      return NextResponse.json(
        {
          error:
            "Your submission is too long. Maximum length is 50,000 characters.",
        },
        { status: 400 }
      );
    }

    const {
      data: taskData,
      error: taskError,
    } = await supabase
      .from("course_practical_tasks")
      .select(
        `
          id,
          course_id,
          title,
          scenario,
          instructions,
          expected_outcome,
          submission_type,
          max_score,
          sort_order,
          is_published,
          skill_id
        `
      )
      .eq("id", taskId)
      .eq("is_published", true)
      .maybeSingle();

    if (taskError) {
      console.error(
        "Practical task lookup error:",
        taskError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify the practical task.",
        },
        { status: 500 }
      );
    }

    const task =
      taskData as unknown as PracticalTask | null;

    if (!task) {
      return NextResponse.json(
        {
          error:
            "Practical task not found or is not currently available.",
        },
        { status: 404 }
      );
    }

    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select(
        "id, enrollment_status"
      )
      .eq("student_id", user.id)
      .eq("course_id", task.course_id)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Practical work enrollment verification error:",
        enrollmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your course enrollment.",
        },
        { status: 500 }
      );
    }

    if (!enrollment) {
      return NextResponse.json(
        {
          error:
            "You must be enrolled in this course before submitting practical work.",
        },
        { status: 403 }
      );
    }

    const {
      data: existingData,
      error: existingError,
    } = await supabase
      .from(
        "student_practical_task_submissions"
      )
      .select(
        `
          id,
          task_id,
          student_id,
          submission_text,
          status,
          score,
          reviewer_feedback,
          submitted_at,
          reviewed_at
        `
      )
      .eq("task_id", task.id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Existing practical submission lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check your previous submission.",
        },
        { status: 500 }
      );
    }

    const existingSubmission =
      existingData as unknown as PracticalSubmission | null;

    if (
      existingSubmission?.status ===
        "approved" ||
      existingSubmission?.status ===
        "under_review"
    ) {
      return NextResponse.json(
        {
          error:
            "This practical task cannot be resubmitted while the current submission is approved or under review.",
        },
        { status: 409 }
      );
    }

    const now =
      new Date().toISOString();

    const {
      data: savedData,
      error: saveError,
    } = await supabase
      .from(
        "student_practical_task_submissions"
      )
      .upsert(
        {
          task_id: task.id,
          student_id: user.id,
          submission_text:
            submissionText,
          status: "submitted",
          score: null,
          reviewer_feedback: null,
          submitted_at: now,
          reviewed_at: null,
        },
        {
          onConflict:
            "task_id,student_id",
        }
      )
      .select(
        `
          id,
          task_id,
          student_id,
          submission_text,
          status,
          score,
          reviewer_feedback,
          submitted_at,
          reviewed_at
        `
      )
      .single();

    if (saveError) {
      console.error(
        "Practical submission save error:",
        saveError
      );

      return NextResponse.json(
        {
          error:
            "Unable to submit your practical work.",
        },
        { status: 500 }
      );
    }

    const submission =
      savedData as unknown as PracticalSubmission;

    return NextResponse.json({
      success: true,
      submission,
    });
  } catch (error) {
    console.error(
      "Practical work POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while submitting practical work.",
      },
      { status: 500 }
    );
  }
}