import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AssessmentClient from "./AssessmentClient";

export default async function AssessmentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="container">
        <div className="auth-box">
          <h1>Diagnostic Assessment</h1>
          <p>Please log in to continue.</p>
          <Link href="/login" className="btn btn-primary">
            Log in
          </Link>
        </div>
      </main>
    );
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug, short_description")
    .eq("slug", "ai-literacy")
    .maybeSingle();

  if (!course) {
    return (
      <main className="container">
        <div className="rn-empty-state">
          <h1>Assessment unavailable</h1>
          <p>The diagnostic assessment course could not be found.</p>
        </div>
      </main>
    );
  }

  const { data: questions, error } = await supabase
    .from("assessment_questions")
    .select(
      `
        id,
        question,
        question_text,
        question_type,
        options,
        difficulty,
        sort_order,
        skill_id
      `
    )
    .eq("course_id", course.id)
    .order("sort_order", { ascending: true });

  if (error || !questions?.length) {
    return (
      <main className="container">
        <div className="rn-empty-state">
          <h1>Assessment unavailable</h1>
          <p>
            The diagnostic questions are not currently available. Please try
            again later.
          </p>
        </div>
      </main>
    );
  }

  const normalizedQuestions = questions.map((question) => ({
    id: question.id,
    question: question.question || question.question_text || "",
    questionType: question.question_type || "multiple_choice",
    options: Array.isArray(question.options)
      ? question.options
      : [],
    difficulty: question.difficulty || "beginner",
    sortOrder: question.sort_order,
    skillId: question.skill_id,
  }));

  return (
    <main className="container">
      <div className="rn-assessment-shell">
        <div className="rn-assessment-header">
          <div>
            <span className="rn-eyebrow">RuffNeck Learn</span>
            <h1>Diagnostic Assessment</h1>
            <p>
              Assess your current knowledge so RuffNeck Learn can personalize
              your learning path.
            </p>
          </div>

          <Link
            href="/student/dashboard"
            className="btn btn-ghost"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="rn-assessment-info">
          <div>
            <strong>{normalizedQuestions.length}</strong>
            <span>Questions</span>
          </div>

          <div>
            <strong>Multiple choice</strong>
            <span>Assessment format</span>
          </div>

          <div>
            <strong>Personalized</strong>
            <span>Learning profile</span>
          </div>
        </div>

        <AssessmentClient
          courseId={course.id}
          courseTitle={course.title}
          questions={normalizedQuestions}
        />
      </div>
    </main>
  );
}