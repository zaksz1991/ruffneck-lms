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
  thumbnail_url: string | null;
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
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export default function LearningIntelligence() {
  const [data, setData] =
    useState<IntelligenceData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadIntelligence() {
      try {
        const response = await fetch(
          "/api/student/intelligence",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load learning intelligence"
          );
        }

        const result =
          (await response.json()) as IntelligenceData;

        if (active) {
          setData(result);
        }
      } catch {
        if (active) {
          setError(true);
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

            <h2>Learning Intelligence</h2>

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

            <h2>Learning Intelligence</h2>

            <p>
              Complete an assessment or learning activity
              to build your intelligence profile.
            </p>
          </div>
        </div>

        <article className="rn-empty-state">
          <h3>Learning intelligence is unavailable</h3>

          <p>
            Your existing courses and progress remain
            available. Try refreshing the page or complete
            the diagnostic assessment.
          </p>

          <Link
            href="/student/assessment"
            className="rn-button rn-button-primary"
          >
            Take Assessment
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="rn-dashboard-section">
      <div className="rn-dashboard-section-header">
        <div>
          <span className="rn-eyebrow">
            LEARNING INTELLIGENCE
          </span>

          <h2>Learning Intelligence</h2>

          <p>
            A live view of your skills, assessment
            performance and learning activity.
          </p>
        </div>

        <Link
          href="/student/skills"
          className="rn-text-link"
        >
          View full skill profile
        </Link>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* INTELLIGENCE METRICS                                           */}
      {/* -------------------------------------------------------------- */}

      <div className="rn-intelligence-metrics">
        <article className="rn-intelligence-score-card">
          <div className="rn-intelligence-score-circle">
            <strong>
              {data.overallLearningScore}%
            </strong>

            <span>Overall</span>
          </div>

          <div>
            <span className="rn-eyebrow">
              LEARNING SCORE
            </span>

            <h3>Overall Learning Score</h3>

            <p>
              Based on your current skill profile,
              assessment and learning activity.
            </p>
          </div>
        </article>

        <article className="rn-intelligence-metric">
          <span>Assessment</span>

          <strong>{data.assessmentScore}%</strong>

          <small>Latest diagnostic result</small>
        </article>

        <article className="rn-intelligence-metric">
          <span>Lessons</span>

          <strong>{data.completedLessons}</strong>

          <small>Lessons completed</small>
        </article>

        <article className="rn-intelligence-metric">
          <span>Streak</span>

          <strong>{data.learningStreak}</strong>

          <small>
            {data.learningStreak === 1
              ? "active day"
              : "active days"}
          </small>
        </article>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* SKILL SUMMARY                                                  */}
      {/* -------------------------------------------------------------- */}

      <div className="rn-intelligence-grid">
        <article className="rn-dashboard-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">
                SKILLS
              </span>

              <h2>Skill Progress</h2>
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

              <span>Mastered</span>
            </div>

            <div>
              <strong>
                {data.developingSkills}
              </strong>

              <span>Developing</span>
            </div>
          </div>

          <div className="rn-intelligence-skills">
            {data.skillBreakdown
              .slice(0, 8)
              .map((skill) => (
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
                        {formatLevel(skill.level)}
                      </span>
                    </div>

                    <strong>
                      {skill.score}%
                    </strong>
                  </div>

                  <div className="rn-intelligence-skill-track">
                    <div
                      style={{
                        width: `${skill.score}%`,
                      }}
                    />
                  </div>

                  <small>
                    {skill.category}
                  </small>
                </div>
              ))}
          </div>
        </article>

        {/* ---------------------------------------------------------- */}
        {/* NEXT COURSE                                                */}
        {/* ---------------------------------------------------------- */}

        <article className="rn-dashboard-card rn-next-course-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">
                NEXT LEARNING STEP
              </span>

              <h2>Recommended Next Course</h2>
            </div>
          </div>

          {data.nextCourse ? (
            <>
              {data.nextCourse.thumbnail_url ? (
                <div className="rn-next-course-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      data.nextCourse.thumbnail_url
                    }
                    alt={data.nextCourse.title}
                  />
                </div>
              ) : null}

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
                  <strong>Why this course?</strong>

                  <span>
                    Your current learning profile shows
                    strong foundational skills. This
                    course provides a higher-level learning
                    path.
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
            </>
          ) : (
            <div className="rn-empty-state">
              <h3>
                Keep building your profile
              </h3>

              <p>
                Complete more lessons and assessments
                to generate a personalized next-step
                recommendation.
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