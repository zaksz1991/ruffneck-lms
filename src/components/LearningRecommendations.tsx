"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Recommendation = {
  lessonId: string;
  lessonTitle: string;
  lessonSlug: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  score: number;
  priority: "high" | "medium";
};

export default function LearningRecommendations() {
  const [recommendations, setRecommendations] = useState<
    Recommendation[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          "/api/student/recommendations",
          {
            credentials: "same-origin",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          setMessage(
            data?.error || "Unable to load recommendations."
          );
          return;
        }

        setRecommendations(data.recommendations || []);
        setMessage(data.message || null);
      } catch {
        setMessage("Unable to load recommendations.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <section className="rn-recommendations">
        <div className="rn-section-heading">
          <div>
            <span className="rn-eyebrow">Personalized learning</span>
            <h2>Recommended for you</h2>
          </div>
        </div>

        <div className="rn-recommendation-loading">
          Analysing your learning profile…
        </div>
      </section>
    );
  }

  return (
    <section className="rn-recommendations">
      <div className="rn-section-heading">
        <div>
          <span className="rn-eyebrow">Personalized learning</span>
          <h2>Recommended for you</h2>
          <p>
            Lessons selected from your current skill profile.
          </p>
        </div>

        <Link
          href="/student/skills"
          className="text-link"
        >
          View learning profile →
        </Link>
      </div>

      {!recommendations.length ? (
        <div className="rn-recommendation-empty">
          <h3>
            {message || "Your recommendations will appear here."}
          </h3>

          <p>
            Complete your diagnostic assessment to create a personalized
            learning path.
          </p>

          <Link
            href="/student/assessment"
            className="btn btn-primary"
          >
            Take Diagnostic Assessment
          </Link>
        </div>
      ) : (
        <div className="rn-recommendation-grid">
          {recommendations.map((item) => (
            <article
              className="rn-recommendation-card"
              key={`${item.lessonId}-${item.skillId}`}
            >
              <div className="rn-recommendation-top">
                <span
                  className={`rn-recommendation-priority ${
                    item.priority === "high"
                      ? "high"
                      : "medium"
                  }`}
                >
                  {item.priority === "high"
                    ? "Priority"
                    : "Recommended"}
                </span>

                <span>{item.score}% skill score</span>
              </div>

              <span className="rn-recommendation-course">
                {item.courseTitle}
              </span>

              <h3>{item.lessonTitle}</h3>

              <Link
                href={`/learn/${item.courseSlug}/${item.lessonSlug}`}
                className="btn btn-primary"
              >
                Start lesson
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}