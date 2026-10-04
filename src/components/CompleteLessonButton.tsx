"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CompleteLessonButtonProps = {
  lessonId: string;
  courseId: string;
  studentId: string;
};

export function CompleteLessonButton({
  lessonId,
  courseId,
  studentId,
}: CompleteLessonButtonProps) {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function completeLesson() {
    if (loading) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      /*
       * Confirm that the current authenticated user is the
       * student whose progress is being updated.
       */
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      if (!user) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      if (user.id !== studentId) {
        throw new Error(
          "You are not authorized to update this lesson."
        );
      }

      const timestamp = new Date().toISOString();

      /*
       * Upsert makes completion idempotent:
       *
       * - First click creates the progress record.
       * - Repeated completion does not create duplicates.
       * - Existing completion remains completed.
       */
      const { error: progressError } = await supabase
        .from("lesson_progress")
        .upsert(
          {
            student_id: studentId,
            lesson_id: lessonId,
            course_id: courseId,
            completed: true,
            completed_at: timestamp,
            last_accessed_at: timestamp,
          },
          {
            onConflict: "student_id,lesson_id",
          }
        );

      if (progressError) {
        throw new Error(
          `Unable to save lesson completion: ${progressError.message}`
        );
      }

      /*
       * Learning activity is supplementary analytics.
       *
       * A failure here must not invalidate the successful
       * lesson completion.
       */
      const { error: activityError } = await supabase
        .from("learning_activity")
        .insert({
          student_id: studentId,
          course_id: courseId,
          lesson_id: lessonId,
          activity_type: "lesson_completed",
          metadata: {
            completed: true,
          },
        });

      if (activityError) {
        console.error(
          "Learning activity logging failed:",
          activityError
        );
      }

      /*
       * Refresh the server-rendered lesson page.
       *
       * The lesson page recalculates:
       * - completed lessons
       * - course percentage
       * - current lesson status
       * - 100% completion
       */
      router.refresh();
    } catch (completionError) {
      console.error(
        "Lesson completion failed:",
        completionError
      );

      setError(
        completionError instanceof Error
          ? completionError.message
          : "Unable to mark this lesson as complete."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error ? (
        <div
          className="error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-primary"
        onClick={completeLesson}
        disabled={loading}
        aria-busy={loading}
      >
        {loading
          ? "Saving…"
          : "Mark lesson complete"}
      </button>
    </div>
  );
}