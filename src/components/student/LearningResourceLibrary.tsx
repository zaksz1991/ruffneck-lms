"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type ResourceType =
  | "article"
  | "video"
  | "document"
  | "tool"
  | "website"
  | "other";

type Resource = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  resource_type: ResourceType;
  course_title: string | null;
  topic: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  download_url?: string | null;
};

type ResourceForm = {
  title: string;
  url: string;
  description: string;
  resource_type: ResourceType;
  course_title: string;
  topic: string;
};

type FormMode = "link" | "file";

const types: {
  value: ResourceType | "all";
  label: string;
}[] = [
  { value: "all", label: "All resources" },
  { value: "article", label: "Articles" },
  { value: "video", label: "Videos" },
  { value: "document", label: "Documents" },
  { value: "tool", label: "Tools" },
  { value: "website", label: "Websites" },
  { value: "other", label: "Other" },
];

const initialForm: ResourceForm = {
  title: "",
  url: "",
  description: "",
  resource_type: "article",
  course_title: "",
  topic: "",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ACCEPTED_FILES =
  ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg";

function formatFileSize(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || bytes < 0) return "";

  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function LearningResourceLibrary() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [form, setForm] = useState<ResourceForm>(initialForm);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ResourceType | "all">("all");

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("link");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("q", search.trim());
      }

      if (filter !== "all") {
        params.set("type", filter);
      }

      const response = await fetch(
        `/api/student/learning-resources?${params.toString()}`,
        { cache: "no-store" },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not load resources.",
        );
      }

      setResources(result.resources ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load resources.",
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 180);

    return () => clearTimeout(timer);
  }, [load]);

  const stats = useMemo(
    () => ({
      total: resources.length,
      favorites: resources.filter(
        (resource) => resource.is_favorite,
      ).length,
      courses: new Set(
        resources
          .map((resource) => resource.course_title)
          .filter(Boolean),
      ).size,
      files: resources.filter(
        (resource) => Boolean(resource.file_path),
      ).length,
    }),
    [resources],
  );

  function openForm(mode: FormMode = "link") {
    setFormMode(mode);
    setShowForm(true);
    setMessage("");
  }

  function closeForm() {
    setShowForm(false);
    setForm(initialForm);
    setSelectedFile(null);
    setFormMode("link");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      let response: Response;

      if (formMode === "file") {
        if (!selectedFile) {
          throw new Error("Choose a document to upload.");
        }

        if (selectedFile.size > MAX_FILE_SIZE) {
          throw new Error(
            "The file must not exceed 10 MB.",
          );
        }

        const formData = new FormData();

        formData.append("file", selectedFile);
        formData.append("title", form.title);
        formData.append("description", form.description);
        formData.append("resource_type", "document");
        formData.append("course_title", form.course_title);
        formData.append("topic", form.topic);

        response = await fetch(
          "/api/student/learning-resources",
          {
            method: "POST",
            body: formData,
          },
        );
      } else {
        response = await fetch(
          "/api/student/learning-resources",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(form),
          },
        );
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not save resource.",
        );
      }

      closeForm();

      setMessage(
        formMode === "file"
          ? "Document uploaded to your private library."
          : "Resource saved to your library.",
      );

      setMessageType("success");

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save resource.",
      );
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite(resource: Resource) {
    try {
      const response = await fetch(
        "/api/student/learning-resources",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: resource.id,
            is_favorite: !resource.is_favorite,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not update favorite.",
        );
      }

      setResources((current) =>
        current.map((item) =>
          item.id === resource.id
            ? {
                ...item,
                is_favorite: !item.is_favorite,
              }
            : item,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update favorite.",
      );
      setMessageType("error");
    }
  }

  async function remove(resource: Resource) {
    const confirmed = window.confirm(
      `Remove “${resource.title}” from your library?`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/student/learning-resources?id=${encodeURIComponent(
          resource.id,
        )}`,
        { method: "DELETE" },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not delete resource.",
        );
      }

      setResources((current) =>
        current.filter((item) => item.id !== resource.id),
      );

      setMessage("Resource removed.");
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not delete resource.",
      );
      setMessageType("error");
    }
  }

  return (
    <main className="lrl-wrap">
      <style>{`
        .lrl-wrap {
          --lrl-navy: #0b1e3a;
          --lrl-cyan: #00b4d8;
          color: #15243a;
          max-width: 1120px;
          margin: 0 auto;
          padding: 24px 18px 48px;
          font-family: inherit;
        }

        .lrl-hero {
          background: linear-gradient(125deg, #0b1e3a, #123d63);
          border-radius: 22px;
          padding: 28px;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }

        .lrl-kicker {
          font-size: 12px;
          letter-spacing: .13em;
          text-transform: uppercase;
          color: #7ce7f5;
          font-weight: 800;
        }

        .lrl-hero h1 {
          margin: 8px 0;
          font-size: clamp(25px, 4vw, 36px);
          line-height: 1.15;
        }

        .lrl-hero p {
          margin: 0;
          color: #d6e6f2;
          max-width: 610px;
          line-height: 1.6;
        }

        .lrl-btn {
          border: 0;
          border-radius: 10px;
          background: var(--lrl-cyan);
          color: #062138;
          font-weight: 800;
          padding: 11px 16px;
          cursor: pointer;
          font: inherit;
          font-size: 14px;
        }

        .lrl-btn:disabled {
          opacity: .6;
          cursor: wait;
        }

        .lrl-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 18px 0;
        }

        .lrl-stat,
        .lrl-card,
        .lrl-form {
          border: 1px solid #dfe7ef;
          border-radius: 15px;
          background: #fff;
        }

        .lrl-stat {
          padding: 16px;
        }

        .lrl-stat strong {
          display: block;
          font-size: 25px;
          color: #0b1e3a;
        }

        .lrl-stat span {
          font-size: 13px;
          color: #617188;
        }

        .lrl-toolbar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin: 20px 0;
        }

        .lrl-input,
        .lrl-select,
        .lrl-textarea {
          box-sizing: border-box;
          width: 100%;
          border: 1px solid #cbd7e3;
          border-radius: 9px;
          padding: 11px 12px;
          background: #fff;
          color: #15243a;
          font: inherit;
          font-size: 14px;
        }

        .lrl-input:focus,
        .lrl-select:focus,
        .lrl-textarea:focus {
          outline: 2px solid #00b4d8;
          outline-offset: 1px;
          border-color: #00b4d8;
        }

        .lrl-search {
          flex: 1;
          min-width: 210px;
        }

        .lrl-select {
          width: auto;
          min-width: 155px;
        }

        .lrl-form {
          padding: 18px;
          margin-bottom: 18px;
        }

        .lrl-mode-switch {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 0 0 18px;
          padding: 5px;
          border-radius: 12px;
          background: #f1f5f9;
        }

        .lrl-mode-btn {
          flex: 1;
          min-width: 130px;
          padding: 11px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: #41536a;
          font: inherit;
          font-weight: 750;
          cursor: pointer;
        }

        .lrl-mode-btn.active {
          background: #fff;
          border-color: #dce6ef;
          color: #0b1e3a;
          box-shadow: 0 1px 3px rgba(11, 30, 58, .06);
        }

        .lrl-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .lrl-field label {
          display: block;
          font-size: 13px;
          font-weight: 750;
          margin: 0 0 6px;
        }

        .lrl-field-full {
          grid-column: 1 / -1;
        }

        .lrl-filebox {
          border: 1px dashed #9bb7ca;
          border-radius: 12px;
          background: #f7fbfd;
          padding: 20px;
        }

        .lrl-filebox input {
          display: block;
          width: 100%;
          margin-top: 12px;
          color: #41536a;
          font: inherit;
          font-size: 13px;
        }

        .lrl-filebox p {
          margin: 6px 0 0;
          color: #617188;
          font-size: 12px;
          line-height: 1.6;
        }

        .lrl-file-selected {
          display: block;
          margin-top: 10px;
          color: #07566b;
          font-size: 13px;
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .lrl-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 14px;
        }

        .lrl-btn-secondary {
          background: #edf3f8;
          color: #19334e;
        }

        .lrl-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .lrl-card {
          padding: 17px;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .lrl-cardtop {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }

        .lrl-tag {
          display: inline-block;
          background: #e5f8fc;
          color: #08647b;
          border-radius: 100px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .lrl-tag-file {
          background: #eaf0ff;
          color: #294b96;
        }

        .lrl-card h2 {
          font-size: 18px;
          line-height: 1.35;
          margin: 12px 0 7px;
          overflow-wrap: anywhere;
        }

        .lrl-desc {
          font-size: 14px;
          color: #586a80;
          line-height: 1.55;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .lrl-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .lrl-chip {
          font-size: 12px;
          background: #f1f5f9;
          border-radius: 7px;
          padding: 5px 8px;
          color: #41536a;
        }

        .lrl-file-details {
          margin-top: 12px;
          border: 1px solid #e0e9f0;
          background: #f8fafc;
          padding: 11px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .lrl-file-icon {
          flex-shrink: 0;
          width: 38px;
          height: 42px;
          border-radius: 8px;
          background: #e0f7fc;
          color: #08647b;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 900;
        }

        .lrl-file-name {
          font-size: 13px;
          font-weight: 750;
          color: #19334e;
          overflow-wrap: anywhere;
        }

        .lrl-file-size {
          margin-top: 4px;
          font-size: 12px;
          color: #617188;
        }

        .lrl-cardfoot {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          margin-top: auto;
          padding-top: 16px;
        }

        .lrl-link {
          font-weight: 800;
          color: #087f9c;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .lrl-link:hover {
          text-decoration: underline;
        }

        .lrl-iconbtn {
          border: 1px solid #d5e0e9;
          background: #fff;
          color: #243b53;
          border-radius: 8px;
          padding: 7px 9px;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
        }

        .lrl-iconbtn:disabled {
          opacity: .6;
          cursor: wait;
        }

        .lrl-empty {
          border: 1px dashed #c7d5e2;
          border-radius: 15px;
          padding: 32px 20px;
          text-align: center;
          color: #64748b;
          background: #f8fafc;
          grid-column: 1 / -1;
        }

        .lrl-message {
          padding: 11px 13px;
          border-radius: 10px;
          margin: 14px 0;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .lrl-message-success {
          background: #effbf4;
          border: 1px solid #b8e7ca;
          color: #166534;
        }

        .lrl-message-error {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #9f1239;
        }

        .lrl-message-info {
          background: #effbfe;
          border: 1px solid #bcecf4;
          color: #07566b;
        }

        .lrl-muted {
          color: #617188;
          font-size: 13px;
          line-height: 1.6;
        }

        @media (max-width: 680px) {
          .lrl-wrap {
            padding: 16px 12px 34px;
          }

          .lrl-hero {
            padding: 22px 18px;
          }

          .lrl-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .lrl-stat {
            padding: 12px;
          }

          .lrl-stat strong {
            font-size: 21px;
          }

          .lrl-list,
          .lrl-grid {
            grid-template-columns: 1fr;
          }

          .lrl-field-full {
            grid-column: auto;
          }

          .lrl-select {
            width: 100%;
          }

          .lrl-actions .lrl-btn {
            flex: 1;
          }
        }
      `}</style>

      <section className="lrl-hero">
        <div>
          <div className="lrl-kicker">
            RuffNeck Learn · Your resources
          </div>

          <h1>Learning Resource Library</h1>

          <p>
            Keep useful articles, videos, documents, websites, and
            tools together. Upload your own study materials, organize
            resources by course or topic, and return to them whenever
            you need them.
          </p>
        </div>

        <button
          type="button"
          className="lrl-btn"
          onClick={() => {
            if (showForm) {
              closeForm();
            } else {
              openForm("link");
            }
          }}
        >
          {showForm ? "Close form" : "+ Add resource"}
        </button>
      </section>

      <section
        className="lrl-stats"
        aria-label="Resource statistics"
      >
        <div className="lrl-stat">
          <strong>{stats.total}</strong>
          <span>Resources shown</span>
        </div>

        <div className="lrl-stat">
          <strong>{stats.favorites}</strong>
          <span>Favorites shown</span>
        </div>

        <div className="lrl-stat">
          <strong>{stats.courses}</strong>
          <span>Courses represented</span>
        </div>

        <div className="lrl-stat">
          <strong>{stats.files}</strong>
          <span>Uploaded documents</span>
        </div>
      </section>

      {message && (
        <div
          className={`lrl-message lrl-message-${messageType}`}
          role={messageType === "error" ? "alert" : "status"}
        >
          {message}
        </div>
      )}

      {showForm && (
        <form className="lrl-form" onSubmit={submit}>
          <h2 style={{ marginTop: 0 }}>
            Add to your learning library
          </h2>

          <div
            className="lrl-mode-switch"
            role="group"
            aria-label="Resource type"
          >
            <button
              type="button"
              className={`lrl-mode-btn ${
                formMode === "link" ? "active" : ""
              }`}
              aria-pressed={formMode === "link"}
              onClick={() => {
                setFormMode("link");
                setForm((current) => ({
                  ...current,
                  resource_type:
                    current.resource_type === "document"
                      ? "article"
                      : current.resource_type,
                }));
                setSelectedFile(null);
              }}
            >
              ↗ Save a web link
            </button>

            <button
              type="button"
              className={`lrl-mode-btn ${
                formMode === "file" ? "active" : ""
              }`}
              aria-pressed={formMode === "file"}
              onClick={() => {
                setFormMode("file");
                setForm((current) => ({
                  ...current,
                  resource_type: "document",
                }));
              }}
            >
              ⇧ Upload a document
            </button>
          </div>

          <div className="lrl-grid">
            <div className="lrl-field">
              <label htmlFor="lrl-title">Title *</label>
              <input
                id="lrl-title"
                className="lrl-input"
                required
                maxLength={180}
                value={form.title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title: event.target.value,
                  })
                }
                placeholder={
                  formMode === "file"
                    ? "e.g. Excel practice workbook"
                    : "e.g. Excel PivotTable guide"
                }
              />
            </div>

            {formMode === "link" ? (
              <div className="lrl-field">
                <label htmlFor="lrl-url">
                  Web address (HTTP/HTTPS) *
                </label>

                <input
                  id="lrl-url"
                  className="lrl-input"
                  type="url"
                  required
                  maxLength={2048}
                  value={form.url}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      url: event.target.value,
                    })
                  }
                  placeholder="https://..."
                />
              </div>
            ) : (
              <div className="lrl-field">
                <label htmlFor="lrl-file">
                  Choose document *
                </label>

                <div className="lrl-filebox">
                  <strong>
                    Select a file from your device
                  </strong>

                  <p>
                    PDF, DOC, DOCX, TXT, PNG or JPEG. Maximum
                    file size: 10 MB.
                  </p>

                  <input
                    id="lrl-file"
                    type="file"
                    required
                    accept={ACCEPTED_FILES}
                    onChange={(event) => {
                      const file =
                        event.target.files?.[0] ?? null;

                      setSelectedFile(file);

                      if (file && file.size > MAX_FILE_SIZE) {
                        setMessage(
                          "This file exceeds the 10 MB limit.",
                        );
                        setMessageType("error");
                      } else {
                        setMessage("");
                      }

                      if (
                        file &&
                        !form.title.trim()
                      ) {
                        const nameWithoutExtension =
                          file.name.replace(/\.[^.]+$/, "");

                        setForm((current) => ({
                          ...current,
                          title: nameWithoutExtension.slice(
                            0,
                            180,
                          ),
                          resource_type: "document",
                        }));
                      }
                    }}
                  />

                  {selectedFile && (
                    <span className="lrl-file-selected">
                      Selected: {selectedFile.name} (
                      {formatFileSize(selectedFile.size)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {formMode === "link" && (
              <div className="lrl-field">
                <label htmlFor="lrl-type">
                  Resource type
                </label>

                <select
                  id="lrl-type"
                  className="lrl-input"
                  value={form.resource_type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      resource_type:
                        event.target.value as ResourceType,
                    })
                  }
                >
                  {types
                    .filter((type) => type.value !== "all")
                    .map((type) => (
                      <option
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="lrl-field">
              <label htmlFor="lrl-course">
                Course (optional)
              </label>

              <input
                id="lrl-course"
                className="lrl-input"
                maxLength={180}
                value={form.course_title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    course_title: event.target.value,
                  })
                }
                placeholder="Course name"
              />
            </div>

            <div className="lrl-field">
              <label htmlFor="lrl-topic">
                Topic (optional)
              </label>

              <input
                id="lrl-topic"
                className="lrl-input"
                maxLength={120}
                value={form.topic}
                onChange={(event) =>
                  setForm({
                    ...form,
                    topic: event.target.value,
                  })
                }
                placeholder="e.g. Data analysis"
              />
            </div>

            <div className="lrl-field lrl-field-full">
              <label htmlFor="lrl-description">
                Notes (optional)
              </label>

              <textarea
                id="lrl-description"
                className="lrl-textarea"
                maxLength={1200}
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                  })
                }
                placeholder="What is useful about this resource? What do you want to practise?"
              />
            </div>
          </div>

          <div className="lrl-actions">
            <button
              type="button"
              className="lrl-btn lrl-btn-secondary"
              disabled={busy}
              onClick={closeForm}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="lrl-btn"
              disabled={
                busy ||
                (formMode === "file" &&
                  (!selectedFile ||
                    selectedFile.size > MAX_FILE_SIZE))
              }
            >
              {busy
                ? formMode === "file"
                  ? "Uploading…"
                  : "Saving…"
                : formMode === "file"
                  ? "Upload document"
                  : "Save resource"}
            </button>
          </div>
        </form>
      )}

      <div className="lrl-toolbar">
        <input
          className="lrl-input lrl-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search titles, notes, courses, and topics…"
          aria-label="Search resources"
        />

        <select
          className="lrl-select"
          value={filter}
          onChange={(event) =>
            setFilter(
              event.target.value as ResourceType | "all",
            )
          }
          aria-label="Filter resource type"
        >
          {types.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="lrl-empty" role="status">
          Loading your resources…
        </div>
      ) : (
        <section
          className="lrl-list"
          aria-label="Saved resources"
        >
          {resources.length === 0 ? (
            <div className="lrl-empty">
              <h2
                style={{
                  color: "#19334e",
                  marginTop: 0,
                }}
              >
                Your library is ready
              </h2>

              <p>
                No resources match this view yet. Save a
                useful link or upload a document to start
                building your personal learning collection.
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="lrl-btn"
                  onClick={() => openForm("link")}
                >
                  Save a link
                </button>

                <button
                  type="button"
                  className="lrl-btn lrl-btn-secondary"
                  onClick={() => openForm("file")}
                >
                  Upload a document
                </button>
              </div>
            </div>
          ) : (
            resources.map((resource) => {
              const hasFile = Boolean(resource.file_path);

              return (
                <article
                  className="lrl-card"
                  key={resource.id}
                >
                  <div className="lrl-cardtop">
                    <span
                      className={`lrl-tag ${
                        hasFile ? "lrl-tag-file" : ""
                      }`}
                    >
                      {hasFile
                        ? "Uploaded document"
                        : resource.resource_type}
                    </span>

                    <button
                      type="button"
                      className="lrl-iconbtn"
                      aria-label={
                        resource.is_favorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      title={
                        resource.is_favorite
                          ? "Remove favorite"
                          : "Add favorite"
                      }
                      onClick={() =>
                        void toggleFavorite(resource)
                      }
                    >
                      {resource.is_favorite
                        ? "★ Favorite"
                        : "☆ Favorite"}
                    </button>
                  </div>

                  <h2>{resource.title}</h2>

                  {resource.description && (
                    <p className="lrl-desc">
                      {resource.description}
                    </p>
                  )}

                  {hasFile && (
                    <div className="lrl-file-details">
                      <div
                        className="lrl-file-icon"
                        aria-hidden="true"
                      >
                        {(
                          resource.file_name
                            ?.split(".")
                            .pop() ?? "FILE"
                        )
                          .slice(0, 4)
                          .toUpperCase()}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div className="lrl-file-name">
                          {resource.file_name ??
                            "Uploaded document"}
                        </div>

                        <div className="lrl-file-size">
                          {formatFileSize(
                            resource.file_size,
                          )}
                          {resource.mime_type
                            ? ` · ${resource.mime_type}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="lrl-meta">
                    {resource.course_title && (
                      <span className="lrl-chip">
                        Course: {resource.course_title}
                      </span>
                    )}

                    {resource.topic && (
                      <span className="lrl-chip">
                        Topic: {resource.topic}
                      </span>
                    )}

                    <span className="lrl-chip">
                      Added {formatDate(resource.created_at)}
                    </span>
                  </div>

                  <div className="lrl-cardfoot">
                    {hasFile ? (
                      resource.download_url ? (
                        <a
                          className="lrl-link"
                          href={resource.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                        >
                          Download document ↓
                        </a>
                      ) : (
                        <span
                          className="lrl-muted"
                          role="status"
                        >
                          Download temporarily unavailable
                        </span>
                      )
                    ) : resource.url ? (
                      <a
                        className="lrl-link"
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                      >
                        Open resource ↗
                      </a>
                    ) : null}

                    <button
                      type="button"
                      className="lrl-iconbtn"
                      onClick={() => void remove(resource)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      <p className="lrl-muted" style={{ marginTop: 18 }}>
        Uploaded documents are stored privately. Download links
        expire after five minutes. Supported file types are PDF,
        DOC, DOCX, TXT, PNG, and JPEG, with a 10 MB maximum file
        size.
      </p>
    </main>
  );
}