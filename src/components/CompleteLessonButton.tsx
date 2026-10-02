"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CompleteLessonButton({
  lessonId,
  courseId,
  studentId,
}: {
  lessonId: string;
  courseId: string;
  studentId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function complete() {
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const timestamp = new Date().toISOString();

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
      setLoading(false);
      setError(progressError.message);
      return;
    }

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

    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      {error && <div className="error">{error}</div>}

      <button
        className="btn btn-primary"
        onClick={complete}
        disabled={loading}
      >
        {loading ? "Saving…" : "Mark lesson complete"}
      </button>
    </div>
  );
}