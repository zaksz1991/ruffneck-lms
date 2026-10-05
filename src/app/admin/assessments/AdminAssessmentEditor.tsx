"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Course = {
  id: string;
  title: string;
  instructor_id: string | null;
};

type AssessmentQuestion = {
  id: string;
  course_id: string;
  skill_id: string | null;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty:
    | "beginner"
    | "intermediate"
    | "advanced";
  points: number;
  question_type:
    | "multiple_choice"
    | "true_false"
    | "short_answer";
  sort_order: number;
};

type QuestionForm = {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty:
    | "beginner"
    | "intermediate"
    | "advanced";
  points: number;
  question_type:
    | "multiple_choice"
    | "true_false"
    | "short_answer";
  skill_id: string;
};

type Props = {
  courses: Course[];
  initialCourseId?: string;
};

const emptyForm: QuestionForm = {
  question: "",
  options: [
    "",
    "",
    "",
  ],
  correct_answer: "",
  explanation: "",
  difficulty: "beginner",
  points: 1,
  question_type:
    "multiple_choice",
  skill_id: "",
};

function normalizeQuestion(
  item: Partial<AssessmentQuestion>
): AssessmentQuestion {
  const options = Array.isArray(
    item.options
  )
    ? item.options.filter(
        (
          value
        ): value is string =>
          typeof value === "string"
      )
    : [];

  return {
    id: String(
      item.id ?? ""
    ),
    course_id: String(
      item.course_id ?? ""
    ),
    skill_id:
      typeof item.skill_id ===
      "string"
        ? item.skill_id
        : null,
    question:
      typeof item.question ===
      "string"
        ? item.question
        : "",
    options,
    correct_answer:
      typeof item.correct_answer ===
      "string"
        ? item.correct_answer
        : "",
    explanation:
      typeof item.explanation ===
      "string"
        ? item.explanation
        : "",
    difficulty:
      item.difficulty ===
        "intermediate" ||
      item.difficulty ===
        "advanced"
        ? item.difficulty
        : "beginner",
    points:
      typeof item.points ===
        "number" &&
      item.points > 0
        ? item.points
        : 1,
    question_type:
      item.question_type ===
        "true_false" ||
      item.question_type ===
        "short_answer"
        ? item.question_type
        : "multiple_choice",
    sort_order:
      typeof item.sort_order ===
        "number"
        ? item.sort_order
        : 0,
  };
}

export default function AdminAssessmentEditor({
  courses,
  initialCourseId,
}: Props) {
  const [selectedCourseId, setSelectedCourseId] =
    useState(
      initialCourseId ||
        courses[0]?.id ||
        ""
    );

  const [questions, setQuestions] =
    useState<AssessmentQuestion[]>([]);

  const [form, setForm] =
    useState<QuestionForm>(
      emptyForm
    );

  const [editingId, setEditingId] =
    useState<string | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const selectedCourse =
    useMemo(
      () =>
        courses.find(
          (course) =>
            course.id ===
            selectedCourseId
        ) ?? null,
      [
        courses,
        selectedCourseId,
      ]
    );

  useEffect(() => {
    if (!selectedCourseId) {
      setQuestions([]);
      return;
    }

    void loadQuestions(
      selectedCourseId
    );
  }, [selectedCourseId]);

  async function loadQuestions(
    courseId: string
  ) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/assessments?courseId=${encodeURIComponent(
            courseId
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        (await response.json()) as {
          questions?: Partial<AssessmentQuestion>[];
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load assessment questions."
        );
      }

      setQuestions(
        (data.questions ?? []).map(
          normalizeQuestion
        )
      );
    } catch (loadError) {
      setQuestions([]);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load assessment questions."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearEditor() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      options: [
        "",
        "",
        "",
      ],
    });
  }

  function beginEdit(
    question: AssessmentQuestion
  ) {
    setEditingId(
      question.id
    );

    setForm({
      question:
        question.question,
      options:
        question.options.length >=
        2
          ? [
              ...question.options,
            ]
          : [
              "",
              "",
              "",
            ],
      correct_answer:
        question.correct_answer,
      explanation:
        question.explanation,
      difficulty:
        question.difficulty,
      points:
        question.points,
      question_type:
        question.question_type,
      skill_id:
        question.skill_id ?? "",
    });

    setMessage("");
    setError("");
  }

  function setOption(
    index: number,
    value: string
  ) {
    setForm((current) => {
      const options = [
        ...current.options,
      ];

      options[index] = value;

      return {
        ...current,
        options,
      };
    });
  }

  function addOption() {
    setForm((current) => ({
      ...current,
      options: [
        ...current.options,
        "",
      ],
    }));
  }

  function removeOption(
    index: number
  ) {
    setForm((current) => {
      if (
        current.options.length <=
        2
      ) {
        return current;
      }

      const removedAnswer =
        current.options[
          index
        ];

      const nextOptions =
        current.options.filter(
          (_, itemIndex) =>
            itemIndex !==
            index
        );

      return {
        ...current,
        options:
          nextOptions,
        correct_answer:
          current.correct_answer ===
          removedAnswer
            ? ""
            : current.correct_answer,
      };
    });
  }

  function validateForm() {
    const question =
      form.question.trim();

    const options =
      form.options
        .map(
          (option) =>
            option.trim()
        )
        .filter(Boolean);

    if (!question) {
      return "Question text is required.";
    }

    if (
      form.question_type ===
        "multiple_choice" &&
      options.length < 2
    ) {
      return "Multiple-choice questions need at least two options.";
    }

    if (
      form.question_type ===
        "multiple_choice" &&
      !options.some(
        (option) =>
          option.toLowerCase() ===
          form.correct_answer
            .trim()
            .toLowerCase()
      )
    ) {
      return "Select a correct answer that exactly matches one of the options.";
    }

    if (
      !Number.isInteger(
        Number(form.points)
      ) ||
      Number(form.points) <=
        0
    ) {
      return "Points must be a positive whole number.";
    }

    return null;
  }

  async function saveQuestion() {
    setError("");
    setMessage("");

    const validation =
      validateForm();

    if (validation) {
      setError(validation);
      return;
    }

    if (!selectedCourseId) {
      setError(
        "Select a course first."
      );
      return;
    }

    setSaving(true);

    const payload = {
      course_id:
        selectedCourseId,
      question:
        form.question.trim(),
      options:
        form.options
          .map(
            (option) =>
              option.trim()
          )
          .filter(Boolean),
      correct_answer:
        form.correct_answer.trim(),
      explanation:
        form.explanation.trim(),
      difficulty:
        form.difficulty,
      points:
        Number(form.points),
      question_type:
        form.question_type,
      skill_id:
        form.skill_id.trim() ||
        null,
    };

    try {
      const response =
        await fetch(
          "/api/admin/assessments",
          {
            method: editingId
              ? "PATCH"
              : "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              editingId
                ? {
                    id: editingId,
                    ...payload,
                  }
                : payload
            ),
          }
        );

      const data =
        (await response.json()) as {
          question?: Partial<AssessmentQuestion>;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save assessment question."
        );
      }

      clearEditor();

      setMessage(
        editingId
          ? "Assessment question updated."
          : "Assessment question added."
      );

      await loadQuestions(
        selectedCourseId
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save assessment question."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(
    question: AssessmentQuestion
  ) {
    if (
      !window.confirm(
        `Delete this assessment question?\n\n${question.question}`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response =
        await fetch(
          `/api/admin/assessments?id=${encodeURIComponent(
            question.id
          )}`,
          {
            method: "DELETE",
          }
        );

      const data =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to delete assessment question."
        );
      }

      if (
        editingId ===
        question.id
      ) {
        clearEditor();
      }

      setMessage(
        "Assessment question deleted."
      );

      await loadQuestions(
        selectedCourseId
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete assessment question."
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveQuestion(
    question: AssessmentQuestion,
    direction:
      | "up"
      | "down"
  ) {
    const index =
      questions.findIndex(
        (item) =>
          item.id === question.id
      );

    if (index < 0) {
      return;
    }

    const targetIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >=
        questions.length
    ) {
      return;
    }

    const current =
      questions[index];

    const target =
      questions[targetIndex];

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const firstResponse =
        await fetch(
          "/api/admin/assessments",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              id: current.id,
              course_id:
                current.course_id,
              question:
                current.question,
              options:
                current.options,
              correct_answer:
                current.correct_answer,
              explanation:
                current.explanation,
              difficulty:
                current.difficulty,
              points:
                current.points,
              question_type:
                current.question_type,
              skill_id:
                current.skill_id,
              sort_order:
                target.sort_order,
            }),
          }
        );

      /*
       * The route accepts the question payload and preserves
       * all editable values. A second update below completes
       * the swap.
       */
      const firstData =
        (await firstResponse.json()) as {
          error?: string;
        };

      if (!firstResponse.ok) {
        throw new Error(
          firstData.error ||
            "Unable to move assessment question."
        );
      }

      const secondResponse =
        await fetch(
          "/api/admin/assessments",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              id: target.id,
              course_id:
                target.course_id,
              question:
                target.question,
              options:
                target.options,
              correct_answer:
                target.correct_answer,
              explanation:
                target.explanation,
              difficulty:
                target.difficulty,
              points:
                target.points,
              question_type:
                target.question_type,
              skill_id:
                target.skill_id,
              sort_order:
                current.sort_order,
            }),
          }
        );

      const secondData =
        (await secondResponse.json()) as {
          error?: string;
        };

      if (!secondResponse.ok) {
        throw new Error(
          secondData.error ||
            "Unable to complete question ordering."
        );
      }

      await loadQuestions(
        selectedCourseId
      );

      setMessage(
        "Assessment question order updated."
      );
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Unable to reorder assessment questions."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          padding:
            "18px 20px",
          border:
            "1px solid #dbe3ed",
          borderRadius: 14,
          background:
            "#ffffff",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing:
                "0.08em",
              textTransform:
                "uppercase",
              color: "#64748b",
              marginBottom: 5,
            }}
          >
            RuffNeck Learn
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 22,
              lineHeight: 1.2,
              color: "#0f172a",
            }}
          >
            Assessment Editor
          </h2>

          <p
            style={{
              margin:
                "7px 0 0",
              color: "#64748b",
              fontSize: 13,
            }}
          >
            Review and maintain
            course assessment
            questions before
            students take the
            assessment.
          </p>
        </div>

        <Link
          href="/admin/lms"
          className="btn btn-ghost"
        >
          ← LMS Admin
        </Link>
      </div>

      <div
        style={{
          border:
            "1px solid #dbe3ed",
          borderRadius: 14,
          background:
            "#ffffff",
          padding: 18,
        }}
      >
        <label
          style={{
            display: "grid",
            gap: 7,
            maxWidth: 760,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            Course
          </span>

          <select
            value={
              selectedCourseId
            }
            onChange={(event) => {
              setSelectedCourseId(
                event.target.value
              );
              clearEditor();
              setMessage("");
              setError("");
            }}
            style={{
              width: "100%",
              boxSizing:
                "border-box",
              padding:
                "10px 12px",
              border:
                "1px solid #cbd5e1",
              borderRadius: 9,
              background:
                "#ffffff",
              color: "#0f172a",
              fontSize: 14,
            }}
          >
            {courses.length ===
            0 ? (
              <option value="">
                No courses available
              </option>
            ) : (
              courses.map(
                (course) => (
                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.title}
                  </option>
                )
              )
            )}
          </select>
        </label>
      </div>

      {selectedCourse ? (
        <div
          style={{
            display: "grid",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <div
              style={{
                padding: 14,
                border:
                  "1px solid #dbe3ed",
                borderRadius: 12,
                background:
                  "#ffffff",
              }}
            >
              <div
                style={{
                  color:
                    "#64748b",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Course
              </div>

              <strong
                style={{
                  display:
                    "block",
                  color:
                    "#0f172a",
                  lineHeight: 1.35,
                }}
              >
                {
                  selectedCourse.title
                }
              </strong>
            </div>

            <div
              style={{
                padding: 14,
                border:
                  "1px solid #dbe3ed",
                borderRadius: 12,
                background:
                  "#ffffff",
              }}
            >
              <div
                style={{
                  color:
                    "#64748b",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Questions
              </div>

              <strong
                style={{
                  fontSize: 20,
                  color:
                    "#0f172a",
                }}
              >
                {
                  questions.length
                }
              </strong>
            </div>
          </div>

          {message ? (
            <div
              style={{
                padding:
                  "11px 13px",
                borderRadius: 9,
                background:
                  "#ecfdf5",
                border:
                  "1px solid #a7f3d0",
                color:
                  "#166534",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                padding:
                  "11px 13px",
                borderRadius: 9,
                background:
                  "#fef2f2",
                border:
                  "1px solid #fecaca",
                color:
                  "#991b1b",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
              gap: 18,
              alignItems:
                "start",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  padding:
                    "4px 0",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    color:
                      "#0f172a",
                  }}
                >
                  Assessment Questions
                </h3>

                <p
                  style={{
                    margin:
                      "5px 0 0",
                    color:
                      "#64748b",
                    fontSize: 13,
                  }}
                >
                  {questions.length ===
                  0
                    ? "No assessment questions yet."
                    : "Manage the questions students will receive."}
                </p>
              </div>

              {loading ? (
                <div
                  style={{
                    padding: 18,
                    border:
                      "1px solid #dbe3ed",
                    borderRadius: 12,
                    background:
                      "#ffffff",
                    color:
                      "#64748b",
                  }}
                >
                  Loading assessment questions...
                </div>
              ) : null}

              {!loading &&
              questions.length ===
                0 ? (
                <div
                  style={{
                    padding: 22,
                    border:
                      "1px dashed #cbd5e1",
                    borderRadius: 12,
                    background:
                      "#f8fafc",
                    textAlign:
                      "center",
                  }}
                >
                  <strong
                    style={{
                      display:
                        "block",
                      color:
                        "#0f172a",
                      marginBottom: 5,
                    }}
                  >
                    No questions yet
                  </strong>

                  <span
                    style={{
                      color:
                        "#64748b",
                      fontSize: 13,
                    }}
                  >
                    Add the first
                    question using
                    the editor.
                  </span>
                </div>
              ) : null}

              {!loading &&
                questions.map(
                  (
                    question,
                    index
                  ) => (
                    <article
                      key={
                        question.id
                      }
                      style={{
                        border:
                          "1px solid #dbe3ed",
                        borderRadius: 12,
                        background:
                          "#ffffff",
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "flex-start",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              color:
                                "#64748b",
                              fontSize:
                                12,
                              fontWeight:
                                700,
                              marginBottom:
                                6,
                            }}
                          >
                            Question{" "}
                            {index +
                              1}
                            {" · "}
                            {
                              question.points
                            }{" "}
                            point
                            {question.points ===
                            1
                              ? ""
                              : "s"}
                          </div>

                          <h4
                            style={{
                              margin:
                                0,
                              color:
                                "#0f172a",
                              lineHeight:
                                1.5,
                            }}
                          >
                            {
                              question.question
                            }
                          </h4>
                        </div>

                        <span
                          style={{
                            flex:
                              "0 0 auto",
                            padding:
                              "4px 8px",
                            borderRadius:
                              999,
                            background:
                              "#f1f5f9",
                            color:
                              "#475569",
                            fontSize:
                              11,
                            fontWeight:
                              800,
                          }}
                        >
                          {
                            question.difficulty
                          }
                        </span>
                      </div>

                      <div
                        style={{
                          display:
                            "grid",
                          gap: 7,
                          marginTop: 13,
                        }}
                      >
                        {question.options.map(
                          (
                            option,
                            optionIndex
                          ) => {
                            const isCorrect =
                              option.toLowerCase() ===
                              question.correct_answer
                                .toLowerCase();

                            return (
                              <div
                                key={`${question.id}-${optionIndex}`}
                                style={{
                                  display:
                                    "flex",
                                  gap: 8,
                                  alignItems:
                                    "flex-start",
                                  padding:
                                    "8px 10px",
                                  border:
                                    "1px solid #e2e8f0",
                                  borderRadius:
                                    8,
                                  background:
                                    isCorrect
                                      ? "#f0fdf4"
                                      : "#ffffff",
                                }}
                              >
                                <strong>
                                  {String.fromCharCode(
                                    65 +
                                      optionIndex
                                  )}
                                  .
                                </strong>

                                <span
                                  style={{
                                    flex:
                                      1,
                                  }}
                                >
                                  {
                                    option
                                  }
                                </span>

                                {isCorrect ? (
                                  <span
                                    style={{
                                      fontSize:
                                        11,
                                      fontWeight:
                                        800,
                                      color:
                                        "#166534",
                                    }}
                                  >
                                    Correct
                                  </span>
                                ) : null}
                              </div>
                            );
                          }
                        )}
                      </div>

                      {question.explanation ? (
                        <div
                          style={{
                            marginTop:
                              12,
                            padding:
                              10,
                            borderRadius:
                              8,
                            background:
                              "#f8fafc",
                            color:
                              "#475569",
                            fontSize:
                              13,
                            lineHeight:
                              1.55,
                          }}
                        >
                          <strong>
                            Explanation:
                          </strong>{" "}
                          {
                            question.explanation
                          }
                        </div>
                      ) : null}

                      <div
                        style={{
                          display:
                            "flex",
                          flexWrap:
                            "wrap",
                          gap: 7,
                          marginTop:
                            14,
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() =>
                            moveQuestion(
                              question,
                              "up"
                            )
                          }
                          disabled={
                            saving ||
                            index === 0
                          }
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() =>
                            moveQuestion(
                              question,
                              "down"
                            )
                          }
                          disabled={
                            saving ||
                            index ===
                              questions.length -
                                1
                          }
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() =>
                            beginEdit(
                              question
                            )
                          }
                          disabled={
                            saving
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() =>
                            deleteQuestion(
                              question
                            )
                          }
                          disabled={
                            saving
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  )
                )}
            </div>

            <aside
              style={{
                border:
                  "1px solid #dbe3ed",
                borderRadius: 14,
                background:
                  "#ffffff",
                padding: 18,
                position:
                  "sticky",
                top: 20,
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: 10,
                  marginBottom:
                    15,
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color:
                        "#0f172a",
                    }}
                  >
                    {editingId
                      ? "Edit Question"
                      : "Add Question"}
                  </h3>

                  <p
                    style={{
                      margin:
                        "5px 0 0",
                      color:
                        "#64748b",
                      fontSize:
                        12,
                    }}
                  >
                    Build a clear,
                    answerable assessment
                    item.
                  </p>
                </div>

                {editingId ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={
                      clearEditor
                    }
                    disabled={
                      saving
                    }
                  >
                    Cancel
                  </button>
                ) : null}
              </div>

              <div
                style={{
                  display:
                    "grid",
                  gap: 14,
                }}
              >
                <label
                  style={{
                    display:
                      "grid",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize:
                        13,
                      fontWeight:
                        700,
                      color:
                        "#334155",
                    }}
                  >
                    Question
                  </span>

                  <textarea
                    value={
                      form.question
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          question:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    rows={5}
                    placeholder="Write the assessment question."
                    style={{
                      width:
                        "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "10px 12px",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius:
                        9,
                      resize:
                        "vertical",
                      fontSize:
                        14,
                      lineHeight:
                        1.5,
                    }}
                  />
                </label>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <label
                    style={{
                      display:
                        "grid",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize:
                          13,
                        fontWeight:
                          700,
                        color:
                          "#334155",
                      }}
                    >
                      Type
                    </span>

                    <select
                      value={
                        form.question_type
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            question_type:
                              event
                                .target
                                .value as QuestionForm["question_type"],
                          })
                        )
                      }
                      style={{
                        padding:
                          "10px 12px",
                        border:
                          "1px solid #cbd5e1",
                        borderRadius:
                          9,
                        background:
                          "#fff",
                        fontSize:
                          14,
                      }}
                    >
                      <option value="multiple_choice">
                        Multiple choice
                      </option>
                      <option value="true_false">
                        True / False
                      </option>
                      <option value="short_answer">
                        Short answer
                      </option>
                    </select>
                  </label>

                  <label
                    style={{
                      display:
                        "grid",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize:
                          13,
                        fontWeight:
                          700,
                        color:
                          "#334155",
                      }}
                    >
                      Difficulty
                    </span>

                    <select
                      value={
                        form.difficulty
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            difficulty:
                              event
                                .target
                                .value as QuestionForm["difficulty"],
                          })
                        )
                      }
                      style={{
                        padding:
                          "10px 12px",
                        border:
                          "1px solid #cbd5e1",
                        borderRadius:
                          9,
                        background:
                          "#fff",
                        fontSize:
                          14,
                      }}
                    >
                      <option value="beginner">
                        Beginner
                      </option>
                      <option value="intermediate">
                        Intermediate
                      </option>
                      <option value="advanced">
                        Advanced
                      </option>
                    </select>
                  </label>
                </div>

                <label
                  style={{
                    display:
                      "grid",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize:
                        13,
                      fontWeight:
                        700,
                      color:
                        "#334155",
                    }}
                  >
                    Points
                  </span>

                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={
                      form.points
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          points:
                            Number(
                              event
                                .target
                                .value
                            ),
                        })
                      )
                    }
                    style={{
                      padding:
                        "10px 12px",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius:
                        9,
                      fontSize:
                        14,
                    }}
                  />
                </label>

                {form.question_type ===
                "multiple_choice" ? (
                  <div
                    style={{
                      display:
                        "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize:
                            13,
                          fontWeight:
                            700,
                          color:
                            "#334155",
                        }}
                      >
                        Answer options
                      </span>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={
                          addOption
                        }
                        disabled={
                          saving
                        }
                      >
                        + Option
                      </button>
                    </div>

                    {form.options.map(
                      (
                        option,
                        index
                      ) => (
                        <div
                          key={index}
                          style={{
                            display:
                              "flex",
                            gap: 7,
                            alignItems:
                              "center",
                          }}
                        >
                          <span
                            style={{
                              width:
                                24,
                              fontSize:
                                12,
                              fontWeight:
                                800,
                              color:
                                "#64748b",
                            }}
                          >
                            {String.fromCharCode(
                              65 +
                                index
                            )}
                          </span>

                          <input
                            value={
                              option
                            }
                            onChange={(
                              event
                            ) =>
                              setOption(
                                index,
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder={`Option ${String.fromCharCode(
                              65 +
                                index
                            )}`}
                            style={{
                              flex:
                                1,
                              minWidth:
                                0,
                              padding:
                                "10px 12px",
                              border:
                                "1px solid #cbd5e1",
                              borderRadius:
                                9,
                              fontSize:
                                14,
                            }}
                          />

                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() =>
                              removeOption(
                                index
                              )
                            }
                            disabled={
                              saving ||
                              form
                                .options
                                .length <=
                                2
                            }
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}

                    <label
                      style={{
                        display:
                          "grid",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize:
                            13,
                          fontWeight:
                            700,
                          color:
                            "#334155",
                        }}
                      >
                        Correct answer
                      </span>

                      <select
                        value={
                          form.correct_answer
                        }
                        onChange={(
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,
                              correct_answer:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        style={{
                          padding:
                            "10px 12px",
                          border:
                            "1px solid #cbd5e1",
                          borderRadius:
                            9,
                          background:
                            "#fff",
                          fontSize:
                            14,
                        }}
                      >
                        <option value="">
                          Select correct answer
                        </option>

                        {form.options
                          .filter(
                            (
                              option
                            ) =>
                              option.trim()
                          )
                          .map(
                            (
                              option
                            ) => (
                              <option
                                key={
                                  option
                                }
                                value={
                                  option
                                }
                              >
                                {
                                  option
                                }
                              </option>
                            )
                          )}
                      </select>
                    </label>
                  </div>
                ) : form.question_type ===
                  "true_false" ? (
                  <label
                    style={{
                      display:
                        "grid",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize:
                          13,
                        fontWeight:
                          700,
                        color:
                          "#334155",
                      }}
                    >
                      Correct answer
                    </span>

                    <select
                      value={
                        form.correct_answer
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            correct_answer:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      style={{
                        padding:
                          "10px 12px",
                        border:
                          "1px solid #cbd5e1",
                        borderRadius:
                          9,
                        background:
                          "#fff",
                        fontSize:
                          14,
                      }}
                    >
                      <option value="">
                        Select answer
                      </option>
                      <option value="True">
                        True
                      </option>
                      <option value="False">
                        False
                      </option>
                    </select>
                  </label>
                ) : (
                  <label
                    style={{
                      display:
                        "grid",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize:
                          13,
                        fontWeight:
                          700,
                        color:
                          "#334155",
                      }}
                    >
                      Correct answer
                    </span>

                    <input
                      value={
                        form.correct_answer
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            correct_answer:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="Enter the expected answer."
                      style={{
                        padding:
                          "10px 12px",
                        border:
                          "1px solid #cbd5e1",
                        borderRadius:
                          9,
                        fontSize:
                          14,
                      }}
                    />
                  </label>
                )}

                <label
                  style={{
                    display:
                      "grid",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize:
                        13,
                      fontWeight:
                        700,
                      color:
                        "#334155",
                    }}
                  >
                    Explanation
                  </span>

                  <textarea
                    value={
                      form.explanation
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          explanation:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    rows={5}
                    placeholder="Explain why the answer is correct."
                    style={{
                      width:
                        "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "10px 12px",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius:
                        9,
                      resize:
                        "vertical",
                      fontSize:
                        14,
                      lineHeight:
                        1.5,
                    }}
                  />
                </label>

                <label
                  style={{
                    display:
                      "grid",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize:
                        13,
                      fontWeight:
                        700,
                      color:
                        "#334155",
                    }}
                  >
                    Skill ID
                    <span
                      style={{
                        marginLeft:
                          5,
                        fontSize:
                          11,
                        fontWeight:
                          500,
                        color:
                          "#94a3b8",
                      }}
                    >
                      optional
                    </span>
                  </span>

                  <input
                    value={
                      form.skill_id
                    }
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          skill_id:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder="Optional learning skill UUID"
                    style={{
                      padding:
                        "10px 12px",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius:
                        9,
                      fontSize:
                        14,
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={
                    saveQuestion
                  }
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Question"
                    : "Add Question"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 24,
            border:
              "1px dashed #cbd5e1",
            borderRadius: 12,
            background:
              "#f8fafc",
            textAlign:
              "center",
            color:
              "#64748b",
          }}
        >
          Select a course to
          manage its assessment.
        </div>
      )}
    </section>
  );
}