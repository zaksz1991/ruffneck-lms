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
  const [success, setSuccess] = useState(false);

  async function completeLesson() {
    if (loading || success) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
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

      const { error: progressError } = await supabase
        .from("lesson_progress")
        .upsert(
          {
            student_id: user.id,
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
        console.error(
          "Lesson progress update failed:",
          progressError
        );

        if (progressError.code === "42501") {
          throw new Error(
            "You are not authorized to complete this lesson. Check your course enrollment."
          );
        }

        throw new Error(
          "Unable to save lesson completion. Please try again."
        );
      }

      // Activity logging is supplementary. Its failure must
      // not undo a successfully saved lesson completion.
      const { error: activityError } = await supabase
        .from("learning_activity")
        .insert({
          student_id: user.id,
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

      setSuccess(true);

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
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <p role="status" aria-live="polite">
          Lesson completed successfully.
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary"
        onClick={completeLesson}
        disabled={loading || success}
        aria-busy={loading}
      >
        {loading
          ? "Saving…"
          : success
            ? "Lesson completed"
            : "Mark lesson complete"}
      </button>
    </div>
  );
}