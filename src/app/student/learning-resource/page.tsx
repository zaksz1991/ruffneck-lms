"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Resource = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  resource_type: string;
  course_title: string | null;
  topic: string | null;
  is_favorite: boolean;
  created_at: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  download_url?: string | null;
};

const API = "/api/student/learning-resources";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const RESOURCE_TYPES = [
  "article",
  "video",
  "document",
  "website",
  "image",
  "other",
];

function formatSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function getErrorMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }

  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return fallback;
}

export default function LearningResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [resourceMode, setResourceMode] = useState<"link" | "file">("link");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    url: "",
    description: "",
    resource_type: "article",
    course_title: "",
    topic: "",
  });

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API, {
        method: "GET",
        cache: "no-store",
      });

      const data: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href =
          "/login?next=/student/learning-resources";
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not load your resources."),
        );
      }

      let rows: unknown[] = [];

      if (Array.isArray(data)) {
        rows = data;
      } else if (data && typeof data === "object") {
        const result = data as Record<string, unknown>;

        if (Array.isArray(result.resources)) {
          rows = result.resources;
        } else if (Array.isArray(result.data)) {
          rows = result.data;
        } else if (Array.isArray(result.items)) {
          rows = result.items;
        }
      }

      setResources(rows as Resource[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load your resources.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  function updateForm(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setSelectedFile(null);

    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "image/png",
      "image/jpeg",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Choose a PDF, TXT, PNG, or JPEG file.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The file must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);

    setForm((current) => ({
      ...current,
      title: current.title || file.name.replace(/\.[^.]+$/, ""),
      resource_type: file.type.startsWith("image/")
        ? "image"
        : "document",
    }));
  }

  function resetForm() {
    setForm({
      title: "",
      url: "",
      description: "",
      resource_type: "article",
      course_title: "",
      topic: "",
    });

    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.title.trim()) {
      setError("Enter a resource title.");
      return;
    }

    if (resourceMode === "link") {
      try {
        const parsedUrl = new URL(form.url.trim());

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          setError("Enter a valid HTTP or HTTPS link.");
          return;
        }
      } catch {
        setError("Enter a valid resource URL.");
        return;
      }
    } else if (!selectedFile) {
      setError("Select a file to upload.");
      return;
    }

    setSaving(true);

    try {
      let response: Response;

      if (resourceMode === "file" && selectedFile) {
        const body = new FormData();

        body.append("file", selectedFile);
        body.append("title", form.title.trim());
        body.append("description", form.description.trim());
        body.append("resource_type", form.resource_type);
        body.append("course_title", form.course_title.trim());
        body.append("topic", form.topic.trim());

        response = await fetch(API, {
          method: "POST",
          body,
        });
      } else {
        response = await fetch(API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: form.title.trim(),
            url: form.url.trim(),
            description: form.description.trim(),
            resource_type: form.resource_type,
            course_title: form.course_title.trim(),
            topic: form.topic.trim(),
          }),
        });
      }

      const data: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.href =
          "/login?next=/student/learning-resources";
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not save this resource."),
        );
      }

      resetForm();
      setShowForm(false);
      setNotice("Resource saved successfully.");
      await loadResources();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save this resource.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite(resource: Resource) {
    setError("");
    setNotice("");

    const previous = resources;

    setResources((current) =>
      current.map((item) =>
        item.id === resource.id
          ? { ...item, is_favorite: !item.is_favorite }
          : item,
      ),
    );

    try {
      const response = await fetch(API, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: resource.id,
          is_favorite: !resource.is_favorite,
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not update this resource."),
        );
      }
    } catch (err) {
      setResources(previous);
      setError(
        err instanceof Error
          ? err.message
          : "Could not update this resource.",
      );
    }
  }

  async function deleteResource(resource: Resource) {
    const confirmed = window.confirm(
      `Delete "${resource.title}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch(API, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: resource.id }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not delete this resource."),
        );
      }

      setResources((current) =>
        current.filter((item) => item.id !== resource.id),
      );

      setNotice("Resource deleted.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete this resource.",
      );
    }
  }

  const filteredResources = resources.filter((resource) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      [
        resource.title,
        resource.description,
        resource.topic,
        resource.course_title,
        resource.file_name,
        resource.resource_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

    const matchesFilter =
      filter === "all" ||
      (filter === "favorites" && resource.is_favorite) ||
      (filter === "files" && Boolean(resource.file_path)) ||
      (filter === "links" && Boolean(resource.url));

    return matchesSearch && matchesFilter;
  });

  const favoriteCount = resources.filter(
    (resource) => resource.is_favorite,
  ).length;

  const fileCount = resources.filter(
    (resource) => Boolean(resource.file_path),
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <a
          href="/student"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-cyan-700"
        >
          <span aria-hidden="true">←</span>
          Student dashboard
        </a>

        <section className="overflow-hidden rounded-3xl bg-[#0b1e3a] shadow-xl">
          <div className="relative px-6 py-9 sm:px-10 sm:py-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[36px] border-cyan-400/10"
            />

            <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-center">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">
                  RuffNeck Learn
                </p>

                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Learning Resource Centre
                </h1>

                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                  Keep useful links, course materials, documents, and study
                  references together in your personal learning library.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setNotice("");
                  setShowForm((current) => !current);
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 font-bold text-[#0b1e3a] shadow-lg transition hover:bg-cyan-300 focus:outline-none focus:ring-4 focus:ring-cyan-200/30"
              >
                <span className="text-xl" aria-hidden="true">
                  +
                </span>
                Add resource
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="All resources"
            value={resources.length}
            icon="▤"
          />
          <StatCard
            label="Saved favourites"
            value={favoriteCount}
            icon="♡"
          />
          <StatCard
            label="Uploaded files"
            value={fileCount}
            icon="↥"
          />
        </section>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}

        {showForm && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Add a resource</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Save a web link or upload a file to your private library.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setResourceMode("link");
                  setError("");
                }}
                className={`rounded-lg px-4 py-3 text-sm font-bold transition ${
                  resourceMode === "link"
                    ? "bg-white text-[#0b1e3a] shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Save a link
              </button>

              <button
                type="button"
                onClick={() => {
                  setResourceMode("file");
                  setError("");
                }}
                className={`rounded-lg px-4 py-3 text-sm font-bold transition ${
                  resourceMode === "file"
                    ? "bg-white text-[#0b1e3a] shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Upload a file
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {resourceMode === "file" && (
                <div>
                  <label
                    htmlFor="resource-file"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Select file
                  </label>

                  <input
                    ref={fileInputRef}
                    id="resource-file"
                    type="file"
                    accept=".pdf,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,image/png,image/jpeg"
                    onChange={handleFileChange}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#0b1e3a] file:px-4 file:py-2 file:font-semibold file:text-white"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    PDF, TXT, PNG, or JPEG. Maximum file size: 10 MB.
                  </p>

                  {selectedFile && (
                    <p className="mt-2 text-sm font-medium text-cyan-800">
                      {selectedFile.name} · {formatSize(selectedFile.size)}
                    </p>
                  )}
                </div>
              )}

              {resourceMode === "link" && (
                <Field
                  label="Resource URL"
                  name="url"
                  value={form.url}
                  onChange={updateForm}
                  placeholder="https://example.com/learning-resource"
                  type="url"
                  required
                />
              )}

              <Field
                label="Title"
                name="title"
                value={form.title}
                onChange={updateForm}
                placeholder="e.g. Introduction to Data Analysis"
                required
                maxLength={180}
              />

              <div>
                <label
                  htmlFor="resource-description"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="resource-description"
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                  rows={3}
                  maxLength={1200}
                  placeholder="What is this resource useful for?"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="resource-type"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Resource type
                  </label>

                  <select
                    id="resource-type"
                    name="resource_type"
                    value={form.resource_type}
                    onChange={updateForm}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  >
                    {RESOURCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <Field
                  label="Course"
                  name="course_title"
                  value={form.course_title}
                  onChange={updateForm}
                  placeholder="Optional course name"
                  maxLength={180}
                />

                <Field
                  label="Topic"
                  name="topic"
                  value={form.topic}
                  onChange={updateForm}
                  placeholder="e.g. Artificial Intelligence"
                  maxLength={180}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0b1e3a] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#15345d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : resourceMode === "file"
                      ? "Upload resource"
                      : "Save resource"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Your library
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search and manage your saved learning materials.
              </p>
            </div>

            <div className="w-full sm:max-w-xs">
              <label htmlFor="resource-search" className="sr-only">
                Search resources
              </label>

              <input
                id="resource-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your resources..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              ["all", "All resources"],
              ["favorites", "Favourites"],
              ["files", "Uploaded files"],
              ["links", "Web links"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === value
                    ? "bg-[#0b1e3a] text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-2xl text-cyan-700">
                ▤
              </div>

              <h3 className="mt-4 text-lg font-bold">
                {resources.length === 0
                  ? "Your library is empty"
                  : "No matching resources"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {resources.length === 0
                  ? "Save useful web links or upload study materials to build your personal learning library."
                  : "Try another search term or change the selected filter."}
              </p>

              {resources.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="mt-5 rounded-xl bg-[#0b1e3a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#15345d]"
                >
                  Add your first resource
                </button>
              )}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredResources.map((resource) => {
                const isFile = Boolean(resource.file_path);
                const resourceHref = isFile
                  ? resource.download_url
                  : resource.url;

                return (
                  <article
                    key={resource.id}
                    className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-xl text-cyan-800">
                        {isFile
                          ? "▧"
                          : resource.resource_type === "video"
                            ? "▷"
                            : resource.resource_type === "image"
                              ? "▧"
                              : "↗"}
                      </div>

                      <button
                        type="button"
                        onClick={() => void toggleFavorite(resource)}
                        aria-label={
                          resource.is_favorite
                            ? "Remove from favourites"
                            : "Add to favourites"
                        }
                        title={
                          resource.is_favorite
                            ? "Remove from favourites"
                            : "Add to favourites"
                        }
                        className={`rounded-lg px-3 py-2 text-xl transition ${
                          resource.is_favorite
                            ? "text-amber-500 hover:bg-amber-50"
                            : "text-slate-300 hover:bg-slate-100 hover:text-amber-500"
                        }`}
                      >
                        {resource.is_favorite ? "★" : "☆"}
                      </button>
                    </div>

                    <div className="mt-4 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                          {resource.resource_type || "other"}
                        </span>

                        {isFile && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                            Private file
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 break-words text-lg font-bold leading-6 text-slate-900">
                        {resource.title}
                      </h3>

                      {resource.description && (
                        <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-slate-500">
                          {resource.description}
                        </p>
                      )}

                      {(resource.course_title || resource.topic) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {resource.course_title && (
                            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                              {resource.course_title}
                            </span>
                          )}

                          {resource.topic && (
                            <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                              {resource.topic}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <div className="min-w-0 text-xs text-slate-400">
                        {isFile && resource.file_name ? (
                          <>
                            <p className="truncate font-medium text-slate-600">
                              {resource.file_name}
                            </p>
                            <p className="mt-1">
                              {formatSize(resource.file_size)}
                            </p>
                          </>
                        ) : (
                          <p>Added {formatDate(resource.created_at)}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        {resourceHref ? (
                          <a
                            href={resourceHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-800 transition hover:bg-cyan-100"
                          >
                            {isFile ? "Download" : "Open"} ↗
                          </a>
                        ) : (
                          <span
                            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500"
                            title="A download link is not currently available."
                          >
                            Unavailable
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => void deleteResource(resource)}
                          aria-label={`Delete ${resource.title}`}
                          title="Delete resource"
                          className="rounded-lg px-2 py-2 text-sm font-semibold text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-xl text-cyan-800">
          {icon}
        </span>
      </div>

      <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#0b1e3a]">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  maxLength,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const id = `resource-${name.replace(/_/g, "-")}`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>

      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
      />
    </div>
  );
}