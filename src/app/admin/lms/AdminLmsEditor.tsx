"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "instructor";

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  intro_video_url: string | null;
  category: string | null;
  level: "beginner" | "intermediate" | "advanced";
  price_ngn: number;
  currency: string;
  is_free: boolean;
  status: "draft" | "published" | "archived";
  instructor_id: string | null;
  duration_minutes: number | null;
  learning_outcomes: string[] | null;
  target_audience: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type Section = {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type Lesson = {
  id: string;
  section_id: string;
  course_id: string;
  title: string;
  slug: string;
  content_html: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  duration_seconds: number | null;
  sort_order: number;
  is_preview: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  initialCourses: Course[];
  userId: string;
  role: Role;
};

const emptyCourse = {
  title: "",
  slug: "",
  short_description: "",
  description: "",
  thumbnail_url: "",
  intro_video_url: "",
  category: "",
  level: "beginner" as Course["level"],
  price_ngn: 0,
  status: "draft" as Course["status"],
  duration_minutes: 0,
  learning_outcomes: "",
  target_audience: "",
  seo_title: "",
  seo_description: "",
};

export default function AdminLmsEditor({
  initialCourses,
  userId,
  role,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    initialCourses[0]?.id ?? null
  );

  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [sections, setSections] = useState<Section[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(
    null
  );
  const [editingSectionTitle, setEditingSectionTitle] = useState("");

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({
    section_id: "",
    title: "",
    slug: "",
    content_html: "",
    video_url: "",
    duration_minutes: 0,
    duration_seconds: 0,
    is_preview: false,
    is_published: true,
  });

  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const lessonsForSection = (sectionId: string) =>
    lessons
      .filter((lesson) => lesson.section_id === sectionId)
      .sort((a, b) => a.sort_order - b.sort_order);

  function clearMessages() {
    setMessage("");
    setError("");
  }

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function startNewCourse() {
    clearMessages();
    setEditingCourse(null);
    setCourseForm(emptyCourse);
    setShowCourseForm(true);
    setSelectedCourseId(null);
  }

  function startEditCourse(course: Course) {
    clearMessages();

    setEditingCourse(course);
    setCourseForm({
      title: course.title,
      slug: course.slug,
      short_description: course.short_description ?? "",
      description: course.description ?? "",
      thumbnail_url: course.thumbnail_url ?? "",
      intro_video_url: course.intro_video_url ?? "",
      category: course.category ?? "",
      level: course.level,
      price_ngn: course.price_ngn ?? 0,
      status: course.status,
      duration_minutes: course.duration_minutes ?? 0,
      learning_outcomes: (course.learning_outcomes ?? []).join("\n"),
      target_audience: course.target_audience ?? "",
      seo_title: course.seo_title ?? "",
      seo_description: course.seo_description ?? "",
    });

    setShowCourseForm(true);
  }

  async function saveCourse() {
    clearMessages();

    if (!courseForm.title.trim()) {
      setError("Course title is required.");
      return;
    }

    if (!courseForm.slug.trim()) {
      setError("Course slug is required.");
      return;
    }

    if (courseForm.price_ngn < 0) {
      setError("Price cannot be negative.");
      return;
    }

    setSaving(true);

    const learningOutcomes = courseForm.learning_outcomes
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const publishedAt =
      courseForm.status === "published"
        ? editingCourse?.published_at ?? new Date().toISOString()
        : null;

    const payload = {
      title: courseForm.title.trim(),
      slug: courseForm.slug.trim(),
      short_description: courseForm.short_description.trim() || null,
      description: courseForm.description.trim() || null,
      thumbnail_url: courseForm.thumbnail_url.trim() || null,
      intro_video_url: courseForm.intro_video_url.trim() || null,
      category: courseForm.category.trim() || null,
      level: courseForm.level,
      price_ngn: Number(courseForm.price_ngn) || 0,
      status: courseForm.status,
      duration_minutes: Number(courseForm.duration_minutes) || 0,
      learning_outcomes: learningOutcomes,
      target_audience: courseForm.target_audience.trim() || null,
      seo_title: courseForm.seo_title.trim() || null,
      seo_description: courseForm.seo_description.trim() || null,
      published_at: publishedAt,
    };

    if (editingCourse) {
      const { data, error: updateError } = await supabase
        .from("courses")
        .update(payload)
        .eq("id", editingCourse.id)
        .select("*")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setCourses((current) =>
        current.map((course) =>
          course.id === editingCourse.id ? data : course
        )
      );

      setSelectedCourseId(editingCourse.id);
      setEditingCourse(data);
      setMessage("Course updated.");
    } else {
      const insertPayload = {
        ...payload,
        instructor_id: role === "instructor" ? userId : null,
      };

      const { data, error: insertError } = await supabase
        .from("courses")
        .insert(insertPayload)
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setCourses((current) => [data, ...current]);
      setSelectedCourseId(data.id);
      setEditingCourse(data);
      setSections([]);
      setLessons([]);
      setMessage("Course created.");
    }

    setShowCourseForm(false);
    setSaving(false);
    router.refresh();
  }

  async function loadCurriculum(courseId: string) {
    clearMessages();
    setSelectedCourseId(courseId);
    setLoadingCurriculum(true);

    const [sectionsResult, lessonsResult] = await Promise.all([
      supabase
        .from("course_sections")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (sectionsResult.error) {
      setError(sectionsResult.error.message);
      setLoadingCurriculum(false);
      return;
    }

    if (lessonsResult.error) {
      setError(lessonsResult.error.message);
      setLoadingCurriculum(false);
      return;
    }

    setSections(sectionsResult.data ?? []);
    setLessons(lessonsResult.data ?? []);
    setLoadingCurriculum(false);
  }

  async function addSection() {
    clearMessages();

    if (!selectedCourseId) {
      setError("Select a course first.");
      return;
    }

    if (!newSectionTitle.trim()) {
      setError("Section title is required.");
      return;
    }

    setSaving(true);

    const nextOrder =
      sections.length > 0
        ? Math.max(...sections.map((section) => section.sort_order)) + 1
        : 1;

    const { data, error: insertError } = await supabase
      .from("course_sections")
      .insert({
        course_id: selectedCourseId,
        title: newSectionTitle.trim(),
        sort_order: nextOrder,
      })
      .select("*")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSections((current) => [...current, data]);
    setNewSectionTitle("");
    setMessage("Section added.");
    setSaving(false);
  }

  async function saveSection(sectionId: string) {
    clearMessages();

    if (!editingSectionTitle.trim()) {
      setError("Section title is required.");
      return;
    }

    setSaving(true);

    const { data, error: updateError } = await supabase
      .from("course_sections")
      .update({
        title: editingSectionTitle.trim(),
      })
      .eq("id", sectionId)
      .select("*")
      .single();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSections((current) =>
      current.map((section) => (section.id === sectionId ? data : section))
    );

    setEditingSectionId(null);
    setEditingSectionTitle("");
    setMessage("Section updated.");
    setSaving(false);
  }

  async function deleteSection(section: Section) {
    clearMessages();

    if (
      !window.confirm(
        `Delete "${section.title}"? Its lessons will also be deleted.`
      )
    ) {
      return;
    }

    setSaving(true);

    const { error: deleteError } = await supabase
      .from("course_sections")
      .delete()
      .eq("id", section.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setSections((current) =>
      current.filter((item) => item.id !== section.id)
    );

    setLessons((current) =>
      current.filter((lesson) => lesson.section_id !== section.id)
    );

    setMessage("Section deleted.");
    setSaving(false);
  }

  async function moveSection(section: Section, direction: "up" | "down") {
    const ordered = [...sections].sort(
      (a, b) => a.sort_order - b.sort_order
    );

    const index = ordered.findIndex((item) => item.id === section.id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const target = ordered[targetIndex];

    setSaving(true);
    clearMessages();

    const first = await supabase
      .from("course_sections")
      .update({ sort_order: target.sort_order })
      .eq("id", section.id);

    if (first.error) {
      setError(first.error.message);
      setSaving(false);
      return;
    }

    const second = await supabase
      .from("course_sections")
      .update({ sort_order: section.sort_order })
      .eq("id", target.id);

    if (second.error) {
      setError(second.error.message);
      setSaving(false);
      return;
    }

    await loadCurriculum(selectedCourseId!);
    setMessage("Section order updated.");
    setSaving(false);
  }

  function startNewLesson(sectionId?: string) {
    clearMessages();

    const targetSection = sectionId ?? sections[0]?.id ?? "";

    setEditingLessonId(null);
    setLessonForm({
      section_id: targetSection,
      title: "",
      slug: "",
      content_html: "",
      video_url: "",
      duration_minutes: 0,
      duration_seconds: 0,
      is_preview: false,
      is_published: true,
    });

    setShowLessonForm(true);
  }

  function startEditLesson(lesson: Lesson) {
    clearMessages();

    setEditingLessonId(lesson.id);
    setLessonForm({
      section_id: lesson.section_id,
      title: lesson.title,
      slug: lesson.slug,
      content_html: lesson.content_html ?? "",
      video_url: lesson.video_url ?? "",
      duration_minutes: lesson.duration_minutes ?? 0,
      duration_seconds: lesson.duration_seconds ?? 0,
      is_preview: lesson.is_preview,
      is_published: lesson.is_published,
    });

    setShowLessonForm(true);
  }

  async function saveLesson() {
    clearMessages();

    if (!selectedCourseId) {
      setError("Select a course first.");
      return;
    }

    if (!lessonForm.section_id) {
      setError("Select a section.");
      return;
    }

    if (!lessonForm.title.trim()) {
      setError("Lesson title is required.");
      return;
    }

    if (!lessonForm.slug.trim()) {
      setError("Lesson slug is required.");
      return;
    }

    setSaving(true);

    let sortOrder = 1;

    if (!editingLessonId) {
      const existing = lessonsForSection(lessonForm.section_id);

      sortOrder =
        existing.length > 0
          ? Math.max(...existing.map((lesson) => lesson.sort_order)) + 1
          : 1;
    } else {
      const existingLesson = lessons.find(
        (lesson) => lesson.id === editingLessonId
      );

      sortOrder =
        existingLesson?.section_id === lessonForm.section_id
          ? existingLesson.sort_order
          : (() => {
              const existing = lessonsForSection(lessonForm.section_id);
              return existing.length > 0
                ? Math.max(...existing.map((lesson) => lesson.sort_order)) + 1
                : 1;
            })();
    }

    const payload = {
      section_id: lessonForm.section_id,
      course_id: selectedCourseId,
      title: lessonForm.title.trim(),
      slug: lessonForm.slug.trim(),
      content_html: lessonForm.content_html || null,
      video_url: lessonForm.video_url.trim() || null,
      duration_minutes: Number(lessonForm.duration_minutes) || 0,
      duration_seconds: Number(lessonForm.duration_seconds) || 0,
      sort_order: sortOrder,
      is_preview: lessonForm.is_preview,
      is_published: lessonForm.is_published,
    };

    if (editingLessonId) {
      const { data, error: updateError } = await supabase
        .from("lessons")
        .update(payload)
        .eq("id", editingLessonId)
        .select("*")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setLessons((current) =>
        current.map((lesson) =>
          lesson.id === editingLessonId ? data : lesson
        )
      );

      setMessage("Lesson updated.");
    } else {
      const { data, error: insertError } = await supabase
        .from("lessons")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setLessons((current) => [...current, data]);
      setMessage("Lesson added.");
    }

    setShowLessonForm(false);
    setEditingLessonId(null);
    setSaving(false);
  }

  async function deleteLesson(lesson: Lesson) {
    clearMessages();

    if (!window.confirm(`Delete "${lesson.title}"?`)) {
      return;
    }

    setSaving(true);

    const { error: deleteError } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lesson.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setLessons((current) =>
      current.filter((item) => item.id !== lesson.id)
    );

    setMessage("Lesson deleted.");
    setSaving(false);
  }

  async function moveLesson(lesson: Lesson, direction: "up" | "down") {
    const ordered = lessonsForSection(lesson.section_id);
    const index = ordered.findIndex((item) => item.id === lesson.id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const target = ordered[targetIndex];

    setSaving(true);
    clearMessages();

    const first = await supabase
      .from("lessons")
      .update({ sort_order: target.sort_order })
      .eq("id", lesson.id);

    if (first.error) {
      setError(first.error.message);
      setSaving(false);
      return;
    }

    const second = await supabase
      .from("lessons")
      .update({ sort_order: lesson.sort_order })
      .eq("id", target.id);

    if (second.error) {
      setError(second.error.message);
      setSaving(false);
      return;
    }

    await loadCurriculum(selectedCourseId!);
    setMessage("Lesson order updated.");
    setSaving(false);
  }

  async function deleteCourse(course: Course) {
    if (role !== "admin") {
      return;
    }

    clearMessages();

    if (
      !window.confirm(
        `Delete "${course.title}" permanently? This also removes its sections, lessons, enrollments and lesson progress.`
      )
    ) {
      return;
    }

    setSaving(true);

    const { error: deleteError } = await supabase
      .from("courses")
      .delete()
      .eq("id", course.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    const remaining = courses.filter((item) => item.id !== course.id);

    setCourses(remaining);
    setSelectedCourseId(remaining[0]?.id ?? null);
    setSections([]);
    setLessons([]);
    setShowCourseForm(false);

    if (remaining[0]) {
      await loadCurriculum(remaining[0].id);
    }

    setMessage("Course deleted.");
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      {message && (
        <div className="panel" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      {error && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0 }}>Course Editor</h3>

        <button type="button" onClick={startNewCourse}>
          + New Course
        </button>
      </div>

      {showCourseForm && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>
            {editingCourse ? "Edit Course" : "Create Course"}
          </h3>

          <div className="grid">
            <label>
              Title
              <input
                value={courseForm.title}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    title: event.target.value,
                    slug:
                      editingCourse?.slug ||
                      slugify(event.target.value),
                  })
                }
              />
            </label>

            <label>
              Slug
              <input
                value={courseForm.slug}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    slug: slugify(event.target.value),
                  })
                }
              />
            </label>

            <label>
              Category
              <input
                value={courseForm.category}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    category: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Level
              <select
                value={courseForm.level}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    level: event.target.value as Course["level"],
                  })
                }
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            <label>
              Price (NGN)
              <input
                type="number"
                min="0"
                value={courseForm.price_ngn}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    price_ngn: Number(event.target.value),
                  })
                }
              />
            </label>

            <label>
              Status
              <select
                value={courseForm.status}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    status: event.target.value as Course["status"],
                  })
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label>
              Duration (minutes)
              <input
                type="number"
                min="0"
                value={courseForm.duration_minutes}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    duration_minutes: Number(event.target.value),
                  })
                }
              />
            </label>

            <label>
              Thumbnail URL
              <input
                value={courseForm.thumbnail_url}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    thumbnail_url: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Intro Video URL
              <input
                value={courseForm.intro_video_url}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    intro_video_url: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Target Audience
              <input
                value={courseForm.target_audience}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    target_audience: event.target.value,
                  })
                }
              />
            </label>
          </div>

          <label style={{ display: "block", marginTop: 16 }}>
            Short Description
            <textarea
              rows={3}
              value={courseForm.short_description}
              onChange={(event) =>
                setCourseForm({
                  ...courseForm,
                  short_description: event.target.value,
                })
              }
            />
          </label>

          <label style={{ display: "block", marginTop: 16 }}>
            Description
            <textarea
              rows={7}
              value={courseForm.description}
              onChange={(event) =>
                setCourseForm({
                  ...courseForm,
                  description: event.target.value,
                })
              }
            />
          </label>

          <label style={{ display: "block", marginTop: 16 }}>
            Learning Outcomes
            <span className="muted">
              One outcome per line.
            </span>
            <textarea
              rows={5}
              value={courseForm.learning_outcomes}
              onChange={(event) =>
                setCourseForm({
                  ...courseForm,
                  learning_outcomes: event.target.value,
                })
              }
            />
          </label>

          <div className="grid" style={{ marginTop: 16 }}>
            <label>
              SEO Title
              <input
                value={courseForm.seo_title}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    seo_title: event.target.value,
                  })
                }
              />
            </label>

            <label>
              SEO Description
              <textarea
                rows={3}
                value={courseForm.seo_description}
                onChange={(event) =>
                  setCourseForm({
                    ...courseForm,
                    seo_description: event.target.value,
                  })
                }
              />
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <button type="button" onClick={saveCourse} disabled={saving}>
              {saving ? "Saving..." : "Save Course"}
            </button>

            <button
              type="button"
              onClick={() => setShowCourseForm(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Courses</h3>

        {courses.length === 0 ? (
          <p className="muted">No courses yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.92rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <th style={{ padding: "8px 4px" }}>Title</th>
                  <th style={{ padding: "8px 4px" }}>Status</th>
                  <th style={{ padding: "8px 4px" }}>Price</th>
                  <th style={{ padding: "8px 4px" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {courses.map((course) => (
                  <tr
                    key={course.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <td style={{ padding: "10px 4px" }}>
                      <strong>{course.title}</strong>
                    </td>

                    <td style={{ padding: "10px 4px" }}>
                      <span className="badge">{course.status}</span>
                    </td>

                    <td style={{ padding: "10px 4px" }}>
                      {course.is_free
                        ? "Free"
                        : `₦${course.price_ngn.toLocaleString()}`}
                    </td>

                    <td style={{ padding: "10px 4px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            startEditCourse(course);
                            loadCurriculum(course.id);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => loadCurriculum(course.id)}
                        >
                          Curriculum
                        </button>

                        {course.status === "published" && (
                          <a
                            href={`/courses/${course.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        )}

                        {role === "admin" && (
                          <button
                            type="button"
                            onClick={() => deleteCourse(course)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCourse && (
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                Curriculum: {selectedCourse.title}
              </h3>

              <p className="muted">
                {selectedCourse.status} ·{" "}
                {selectedCourse.is_free
                  ? "Free"
                  : `₦${selectedCourse.price_ngn.toLocaleString()}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => startNewLesson()}
              disabled={sections.length === 0}
            >
              + Add Lesson
            </button>
          </div>

          {sections.length === 0 && !loadingCurriculum && (
            <p className="muted" style={{ marginTop: 20 }}>
              Add a section before adding lessons.
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 20,
              flexWrap: "wrap",
            }}
          >
            <input
              placeholder="New section title"
              value={newSectionTitle}
              onChange={(event) =>
                setNewSectionTitle(event.target.value)
              }
            />

            <button
              type="button"
              onClick={addSection}
              disabled={saving}
            >
              + Add Section
            </button>
          </div>

          {loadingCurriculum ? (
            <p className="muted" style={{ marginTop: 20 }}>
              Loading curriculum...
            </p>
          ) : (
            <div style={{ marginTop: 24 }}>
              {sections
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((section, sectionIndex) => {
                  const sectionLessons = lessonsForSection(section.id);

                  return (
                    <div
                      key={section.id}
                      className="panel"
                      style={{ marginBottom: 16 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        {editingSectionId === section.id ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flex: 1,
                            }}
                          >
                            <input
                              value={editingSectionTitle}
                              onChange={(event) =>
                                setEditingSectionTitle(
                                  event.target.value
                                )
                              }
                            />

                            <button
                              type="button"
                              onClick={() =>
                                saveSection(section.id)
                              }
                              disabled={saving}
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingSectionId(null)
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div>
                            <h4 style={{ margin: 0 }}>
                              {sectionIndex + 1}. {section.title}
                            </h4>

                            <span className="muted">
                              {sectionLessons.length} lesson
                              {sectionLessons.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        )}

                        {editingSectionId !== section.id && (
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                moveSection(section, "up")
                              }
                              disabled={sectionIndex === 0 || saving}
                            >
                              ↑
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                moveSection(section, "down")
                              }
                              disabled={
                                sectionIndex === sections.length - 1 ||
                                saving
                              }
                            >
                              ↓
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingSectionId(section.id);
                                setEditingSectionTitle(section.title);
                              }}
                            >
                              Rename
                            </button>

                            <button
                              type="button"
                              onClick={() => startNewLesson(section.id)}
                            >
                              + Lesson
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteSection(section)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {sectionLessons.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          {sectionLessons.map((lesson, lessonIndex) => (
                            <div
                              key={lesson.id}
                              style={{
                                padding: "12px",
                                borderTop:
                                  "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div>
                                  <strong>
                                    {lessonIndex + 1}. {lesson.title}
                                  </strong>

                                  <div className="muted">
                                    {lesson.is_published
                                      ? "Published"
                                      : "Unpublished"}
                                    {" · "}
                                    {lesson.is_preview
                                      ? "Preview"
                                      : "Members only"}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      moveLesson(lesson, "up")
                                    }
                                    disabled={
                                      lessonIndex === 0 || saving
                                    }
                                  >
                                    ↑
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      moveLesson(lesson, "down")
                                    }
                                    disabled={
                                      lessonIndex ===
                                        sectionLessons.length - 1 ||
                                      saving
                                    }
                                  >
                                    ↓
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditLesson(lesson)
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteLesson(lesson)
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {showLessonForm && (
        <div
          className="panel"
          style={{
            marginTop: 24,
            border: "2px solid var(--border)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {editingLessonId ? "Edit Lesson" : "Add Lesson"}
          </h3>

          <div className="grid">
            <label>
              Section
              <select
                value={lessonForm.section_id}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    section_id: event.target.value,
                  })
                }
              >
                <option value="">Select section</option>

                {sections
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Title
              <input
                value={lessonForm.title}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    title: event.target.value,
                    slug:
                      editingLessonId
                        ? lessonForm.slug
                        : slugify(event.target.value),
                  })
                }
              />
            </label>

            <label>
              Slug
              <input
                value={lessonForm.slug}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    slug: slugify(event.target.value),
                  })
                }
              />
            </label>

            <label>
              Video URL
              <input
                value={lessonForm.video_url}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    video_url: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Duration (minutes)
              <input
                type="number"
                min="0"
                value={lessonForm.duration_minutes}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    duration_minutes: Number(event.target.value),
                  })
                }
              />
            </label>

            <label>
              Duration (seconds)
              <input
                type="number"
                min="0"
                value={lessonForm.duration_seconds}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    duration_seconds: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>

          <label
            style={{
              display: "block",
              marginTop: 16,
            }}
          >
            Lesson HTML Content
            <textarea
              rows={12}
              value={lessonForm.content_html}
              onChange={(event) =>
                setLessonForm({
                  ...lessonForm,
                  content_html: event.target.value,
                })
              }
              placeholder="<p>Lesson content...</p>"
            />
          </label>

          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={lessonForm.is_preview}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    is_preview: event.target.checked,
                  })
                }
              />{" "}
              Preview lesson
            </label>

            <label>
              <input
                type="checkbox"
                checked={lessonForm.is_published}
                onChange={(event) =>
                  setLessonForm({
                    ...lessonForm,
                    is_published: event.target.checked,
                  })
                }
              />{" "}
              Published
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={saveLesson}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Lesson"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowLessonForm(false);
                setEditingLessonId(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}