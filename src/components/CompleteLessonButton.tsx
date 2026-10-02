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
    const { error: err } = await supabase.from("lesson_progress").upsert(
      {
        student_id: studentId,
        lesson_id: lessonId,
        course_id: courseId,
        completed: true,
        completed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: "student_id,lesson_id" }
    );
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary" onClick={complete} disabled={loading}>
        {loading ? "Saving…" : "Mark lesson complete"}
      </button>
    </div>
  );
}
