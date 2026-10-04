"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SkillBreakdown = {
  id: string;
  name: string;
  category: string;
  score: number;
  level: string;
};

type NextCourse = {
  id: string;
  title: string;
  slug: string;
  level: "beginner" | "intermediate" | "advanced";
  category: string | null;
  short_description: string | null;
  duration_minutes: number | null;
} | null;

type IntelligenceData = {
  overallLearningScore: number;
  assessmentScore: number;
  completedLessons: number;
  learningStreak: number;
  masteredSkills: number;
  developingSkills: number;
  totalSkills: number;
  skillBreakdown: SkillBreakdown[];
  nextCourse: NextCourse;
  latestAssessmentDate: string | null;
};

function formatLevel(level: string) {
  if (!level) {
    return "Not assessed";
  }

  return level.charAt(0).toUpperCase() + level.slice(1);
}

function clampScore(value: number) {
  return Math.min(
    100,
    Math.max(0, Number(value) || 0)
  );
}

function formatAssessmentDate(
  value: string | null
) {
  if (!value) {
    return "No assessment yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No assessment yet";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

export default function LearningIntelligence() {
  const [data, setData] =
    useState<IntelligenceData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  useEffect(() => {
    let active = true;

    async function loadIntelligence() {
      try {
        setLoading(true);
        setError(false);

        const response = await fetch(
          "/api/student/intelligence",
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load learning intelligence."
          );
        }

        const result =
          (await response.json()) as IntelligenceData;

        if (!active) {
          return;
        }

        setData({
          ...result,
          overallLearningScore:
            clampScore(
              result.overallLearningScore
            ),
          assessmentScore:
            clampScore(
              result.assessmentScore
            ),
          completedLessons:
            Math.max(
              0,
              Number(
                result.completedLessons || 0
              )
            ),
          learningStreak:
            Math.max(
              0,
              Number(
                result.learningStreak || 0
              )
            ),
          masteredSkills:
            Math.max(
              0,
              Number(
                result.masteredSkills || 0
              )
            ),
          developingSkills:
            Math.max(
              0,
              Number(
                result.developingSkills || 0
              )
            ),
          totalSkills:
            Math.max(
              0,
              Number(
                result.totalSkills || 0
              )
            ),
          skillBreakdown:
            Array.isArray(
              result.skillBreakdown
            )
              ? result.skillBreakdown
              : [],
        });
      } catch {
        if (active) {
          setError(true);
          setData(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadIntelligence();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">
              LEARNING INTELLIGENCE
            </span>

            <h2>
              Learning Intelligence
            </h2>

            <p>
              Analyzing your learning profile...
            </p>
          </div>
        </div>

        <article className="rn-intelligence-loading">
          <div className="rn-intelligence-loading-bar" />

          <div className="rn-intelligence-loading-bar" />

          <div className="rn-intelligence-loading-bar" />
        </article>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">
              LEARNING INTELLIGENCE
            </span>

            <h2>
              Learning Intelligence
            </h2>

            <p>
              Your learning intelligence could
              not be loaded at this time.
            </p>
          </div>
        </div>

        <article className="rn-empty-state">
          <h3>
            Learning intelligence is unavailable
          </h3>

          <p>
            Your courses and learning progress
            remain available. Refresh the page
            to try loading your learning
            intelligence again.
          </p>

          <Link
            href="/courses"
            className="rn-button rn-button-primary"
          >
            Browse Courses
          </Link>
        </article>
      </section>
    );
  }

  const overallScore =
    clampScore(
      data.overallLearningScore
    );

  const assessmentScore =
    clampScore(
      data.assessmentScore
    );

  return (
    <section className="rn-dashboard-section">
      <div className="rn-dashboard-section-header">
        <div>
          <span className="rn-eyebrow">
            LEARNING INTELLIGENCE
          </span>

          <h2>
            Learning Intelligence
          </h2>

          <p>
            A live view of your skills,
            assessment performance and
            learning activity.
          </p>
        </div>

        <Link
          href="/student/skills"
          className="rn-text-link"
        >
          View full skill profile
        </Link>
      </div>

      <div className="rn-intelligence-metrics">
        <article className="rn-intelligence-score-card">
          <div className="rn-intelligence-score-circle">
            <strong>
              {overallScore}%
            </strong>

            <span>Overall</span>
          </div>

          <div>
            <span className="rn-eyebrow">
              LEARNING SCORE
            </span>

            <h3>
              Overall Learning Score
            </h3>

            <p>
              Based on your current skill
              profile, assessments and
              learning activity.
            </p>
          </div>
        </article>

        <article className="rn-intelligence-metric">
          <span>Assessment</span>

          <strong>
            {assessmentScore}%
          </strong>

          <small>
            {formatAssessmentDate(
              data.latestAssessmentDate
            )}
          </small>
        </article>

        <article className="rn-intelligence-metric">
          <span>Lessons</span>

          <strong>
            {data.completedLessons}
          </strong>

          <small>
            Lessons completed
          </small>
        </article>

        <article className="rn-intelligence-metric">
          <span>Streak</span>

          <strong>
            {data.learningStreak}
          </strong>

          <small>
            {data.learningStreak === 1
              ? "active day"
              : "active days"}
          </small>
        </article>
      </div>

      <div className="rn-intelligence-grid">
        <article className="rn-dashboard-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">
                SKILLS
              </span>

              <h2>
                Skill Progress
              </h2>
            </div>

            <span className="rn-intelligence-count">
              {data.totalSkills} tracked
            </span>
          </div>

          <div className="rn-intelligence-summary">
            <div>
              <strong>
                {data.masteredSkills}
              </strong>

              <span>
                Mastered
              </span>
            </div>

            <div>
              <strong>
                {data.developingSkills}
              </strong>

              <span>
                Developing
              </span>
            </div>
          </div>

          {data.skillBreakdown.length === 0 ? (
            <div className="rn-empty-state">
              <h3>
                No assessed skills yet
              </h3>

              <p>
                Complete an assessment through
                one of your enrolled courses to
                begin building your skill profile.
              </p>

              <Link
                href="/courses"
                className="rn-button rn-button-primary"
              >
                View Courses
              </Link>
            </div>
          ) : (
            <div className="rn-intelligence-skills">
              {data.skillBreakdown
                .slice(0, 8)
                .map((skill) => {
                  const score =
                    clampScore(
                      skill.score
                    );

                  return (
                    <div
                      key={skill.id}
                      className="rn-intelligence-skill"
                    >
                      <div className="rn-intelligence-skill-header">
                        <div>
                          <strong>
                            {skill.name}
                          </strong>

                          <span>
                            {formatLevel(
                              skill.level
                            )}
                          </span>
                        </div>

                        <strong>
                          {score}%
                        </strong>
                      </div>

                      <div className="rn-intelligence-skill-track">
                        <div
                          style={{
                            width: `${score}%`,
                          }}
                        />
                      </div>

                      <small>
                        {skill.category ||
                          "General skill"}
                      </small>
                    </div>
                  );
                })}
            </div>
          )}
        </article>

        <article className="rn-dashboard-card rn-next-course-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">
                NEXT LEARNING STEP
              </span>

              <h2>
                Recommended Next Course
              </h2>
            </div>
          </div>

          {data.nextCourse ? (
            <div className="rn-next-course-content">
              <div className="rn-course-card-meta">
                <span>
                  {formatLevel(
                    data.nextCourse.level
                  )}
                </span>

                {data.nextCourse.category ? (
                  <span>
                    {data.nextCourse.category}
                  </span>
                ) : null}

                {data.nextCourse.duration_minutes ? (
                  <span>
                    {
                      data.nextCourse
                        .duration_minutes
                    }{" "}
                    min
                  </span>
                ) : null}
              </div>

              <h3>
                {data.nextCourse.title}
              </h3>

              <p>
                {data.nextCourse
                  .short_description ||
                  "Continue developing practical digital skills with this course."}
              </p>

              <div className="rn-next-course-reason">
                <strong>
                  Why this course?
                </strong>

                <span>
                  This recommendation is
                  based on your current
                  learning profile, completed
                  learning activity and
                  available course pathways.
                </span>
              </div>

              <div className="rn-dashboard-inline-actions">
                <Link
                  href={`/courses/${data.nextCourse.slug}`}
                  className="rn-button rn-button-primary"
                >
                  View Course
                </Link>

                <Link
                  href="/courses"
                  className="rn-button rn-button-secondary"
                >
                  Browse Courses
                </Link>
              </div>
            </div>
          ) : (
            <div className="rn-empty-state">
              <h3>
                No recommendation yet
              </h3>

              <p>
                Complete more lessons and
                assessments to build enough
                learning data for a personalized
                course recommendation.
              </p>

              <Link
                href="/courses"
                className="rn-button rn-button-primary"
              >
                Explore Courses
              </Link>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}