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

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      dateStyle: "medium",
    },
  ).format(new Date(value));
}

export default function EvidenceTimeline({
  items,
}: EvidenceTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="card">
        <h3>
          No verified practical evidence yet
        </h3>

        <p className="muted">
          Approved Practical Work submissions
          will appear here and become part of
          your skill evidence.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
      }}
    >
      {items.map((item) => (
        <article
          key={item.id}
          className="card"
          style={{
            position: "relative",
            margin: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p className="eyebrow">
                {item.skillName}
              </p>

              <h3
                style={{
                  marginBottom:
                    "0.35rem",
                }}
              >
                {item.taskTitle}
              </h3>

              <p className="muted">
                {item.courseTitle}
              </p>
            </div>

            <span className="rn-badge rn-badge-success">
              Verified
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1rem",
              marginTop: "1rem",
            }}
          >
            <div>
              <strong>
                Review date
              </strong>

              <p>
                {formatDate(
                  item.reviewedAt,
                )}
              </p>
            </div>

            <div>
              <strong>
                Score
              </strong>

              <p>
                {item.score !== null
                  ? `${item.score}%`
                  : "Not scored"}
              </p>
            </div>

            <div>
              <strong>
                Evidence
              </strong>

              <p>
                {item.evidenceFileName ??
                  "Written submission"}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}