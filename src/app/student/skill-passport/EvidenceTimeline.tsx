"use client";

type EvidenceItem = {
  id: string;
  skillName: string;
  taskTitle: string;
  courseTitle: string;
  score: number | null;
  reviewedAt: string | null;
  evidenceFileName: string | null;
};

type EvidenceTimelineProps = {
  items: EvidenceItem[];
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatScore(score: number | null): string {
  if (score === null || !Number.isFinite(score)) {
    return "Not scored";
  }

  return `${Number.isInteger(score) ? score : score.toFixed(1)}%`;
}

function getEvidenceName(
  evidenceFileName: string | null,
): string {
  const fileName = evidenceFileName?.trim();

  return fileName || "Written submission";
}

export default function EvidenceTimeline({
  items,
}: EvidenceTimelineProps) {
  if (items.length === 0) {
    return (
      <section
        className="card"
        aria-labelledby="evidence-empty-title"
        style={{
          margin: 0,
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: "3rem",
            height: "3rem",
            margin: "0 auto 1rem",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "rgba(0, 180, 216, 0.12)",
            color: "#087f9b",
            fontSize: "1.4rem",
            fontWeight: 700,
          }}
        >
          ✓
        </div>

        <h3
          id="evidence-empty-title"
          style={{
            margin: "0 0 0.5rem",
          }}
        >
          No verified practical evidence yet
        </h3>

        <p
          className="muted"
          style={{
            maxWidth: "34rem",
            margin: "0 auto 1rem",
            lineHeight: 1.7,
          }}
        >
          Your approved Practical Work submissions will
          appear here when they have been recorded as
          skill evidence. Completing a task alone does
          not necessarily mean that evidence has been
          recorded.
        </p>

        <a
          href="/student/practical-work"
          className="button button-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            marginTop: "0.25rem",
          }}
        >
          View Practical Work
        </a>
      </section>
    );
  }

  return (
    <section
      aria-label="Verified practical evidence"
      style={{
        display: "grid",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <p
          className="muted"
          style={{
            margin: 0,
            fontSize: "0.9rem",
          }}
        >
          Approved evidence records
        </p>

        <span
          className="rn-badge rn-badge-success"
          aria-live="polite"
        >
          {items.length}{" "}
          {items.length === 1 ? "record" : "records"}
        </span>
      </div>

      {items.map((item) => (
        <article
          key={item.id}
          className="card"
          style={{
            position: "relative",
            margin: 0,
            padding: "1.25rem",
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 15rem" }}>
              <p
                className="eyebrow"
                style={{
                  marginTop: 0,
                  marginBottom: "0.4rem",
                }}
              >
                {item.skillName || "Skill not specified"}
              </p>

              <h3
                style={{
                  margin: "0 0 0.4rem",
                  overflowWrap: "anywhere",
                }}
              >
                {item.taskTitle || "Practical task"}
              </h3>

              <p
                className="muted"
                style={{
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {item.courseTitle || "Course not specified"}
              </p>
            </div>

            <span
              className="rn-badge rn-badge-success"
              aria-label="Approved evidence"
              style={{
                flexShrink: 0,
              }}
            >
              Verified
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 145px), 1fr))",
              gap: "1rem",
              marginTop: "1.25rem",
              paddingTop: "1rem",
              borderTop: "1px solid rgba(100, 116, 139, 0.2)",
            }}
          >
            <div>
              <p
                className="muted"
                style={{
                  margin: "0 0 0.35rem",
                  fontSize: "0.82rem",
                }}
              >
                Review date
              </p>

              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                }}
              >
                {formatDate(item.reviewedAt)}
              </p>
            </div>

            <div>
              <p
                className="muted"
                style={{
                  margin: "0 0 0.35rem",
                  fontSize: "0.82rem",
                }}
              >
                Score
              </p>

              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                }}
              >
                {formatScore(item.score)}
              </p>
            </div>

            <div>
              <p
                className="muted"
                style={{
                  margin: "0 0 0.35rem",
                  fontSize: "0.82rem",
                }}
              >
                Evidence submitted
              </p>

              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  overflowWrap: "anywhere",
                }}
              >
                {getEvidenceName(item.evidenceFileName)}
              </p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}