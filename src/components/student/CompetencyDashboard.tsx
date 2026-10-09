"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Course = {
id: string;
title: string;
slug: string;
level: string;
progressPercent: number;
completedLessons: number;
trackedLessons: number;
enrollmentStatus: string;
};

type Skill = {
id: string;
name: string;
score: number | null;
level: string;
};

type Project = {
id: string;
status: string;
score: number | null;
submittedAt: string | null;
};

type DashboardData = {
summary: {
enrolledCourses: number;
completedCourses: number;
averageProgress: number;
approvedProjects: number;
submittedProjects: number;
averageProjectScore: number | null;
certificates: number;
trackedSkills: number;
strengths: number;
needsPractice: number;
};
courses: Course[];
skills: Skill[];
projects: Project[];
notices: string[];
};

const initial: DashboardData = {
summary: {
enrolledCourses: 0,
completedCourses: 0,
averageProgress: 0,
approvedProjects: 0,
submittedProjects: 0,
averageProjectScore: null,
certificates: 0,
trackedSkills: 0,
strengths: 0,
needsPractice: 0,
},
courses: [],
skills: [],
projects: [],
notices: [],
};

function prettyStatus(value: string): string {
return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) =>
letter.toUpperCase()
);
}

function dateLabel(value: string | null): string {
if (!value) return "Date not recorded";

const date = new Date(value);

return Number.isNaN(date.getTime())
? "Date not recorded"
: date.toLocaleDateString(undefined, {
day: "numeric",
month: "short",
year: "numeric",
});
}

export default function CompetencyDashboard() {
const [data, setData] = useState<DashboardData>(initial);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

const load = useCallback(async () => {
setLoading(true);
setError("");

```
try {
  const response = await fetch("/api/student/competencies", {
    cache: "no-store",
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || "Could not load competency data."
    );
  }

  setData({
    ...initial,
    ...result,
    summary: {
      ...initial.summary,
      ...(result.summary ?? {}),
    },
  });
} catch (e) {
  setError(
    e instanceof Error
      ? e.message
      : "Could not load competency data."
  );
} finally {
  setLoading(false);
}
```

}, []);

useEffect(() => {
void load();
}, [load]);

const { summary } = data;

return ( <main className="competency-page"> <style>{`
.competency-page {
min-height: 100vh;
background: #f3f7fb;
color: #13243b;
padding: clamp(18px, 4vw, 42px);
font-family: Arial, Helvetica, sans-serif;
}

```
    .comp-wrap {
      max-width: 1180px;
      margin: 0 auto;
    }

    .comp-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .comp-eyebrow {
      font-size: 12px;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: #087f9e;
      font-weight: 800;
    }

    .comp-title {
      font-size: clamp(28px, 4vw, 42px);
      letter-spacing: -.04em;
      margin: 8px 0;
    }

    .comp-subtitle {
      color: #64748b;
      max-width: 700px;
      line-height: 1.6;
      margin: 0;
    }

    .comp-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .comp-btn {
      border: 1px solid #cbd5e1;
      border-radius: 11px;
      padding: 11px 15px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      background: white;
      color: #13243b;
      cursor: pointer;
    }

    .comp-btn:disabled {
      cursor: wait;
      opacity: .65;
    }

    .comp-btn.primary {
      background: #0b1e3a;
      color: white;
      border-color: #0b1e3a;
    }

    .comp-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin: 24px 0;
    }

    .comp-stat {
      background: white;
      border: 1px solid #e0e8f0;
      border-radius: 17px;
      padding: 20px;
      box-shadow: 0 7px 22px #0b1e3a08;
    }

    .comp-stat-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 700;
    }

    .comp-stat-value {
      font-size: 31px;
      font-weight: 800;
      letter-spacing: -.04em;
      margin: 10px 0 4px;
    }

    .comp-stat-note {
      font-size: 12px;
      color: #718096;
    }

    .comp-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(300px, .85fr);
      gap: 18px;
    }

    .comp-panel {
      background: white;
      border: 1px solid #e0e8f0;
      border-radius: 18px;
      padding: 22px;
      margin-bottom: 18px;
      box-shadow: 0 7px 22px #0b1e3a08;
    }

    .comp-panel-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 18px;
    }

    .comp-panel h2 {
      font-size: 18px;
      margin: 0 0 6px;
    }

    .comp-muted {
      color: #64748b;
      font-size: 13px;
      line-height: 1.55;
      margin: 0;
    }

    .comp-course {
      padding: 16px 0;
      border-top: 1px solid #edf2f7;
    }

    .comp-course:first-of-type {
      border-top: 0;
    }

    .comp-course-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .comp-course-title {
      font-size: 14px;
      font-weight: 800;
      margin: 0 0 6px;
    }

    .comp-course-meta {
      font-size: 12px;
      color: #64748b;
    }

    .comp-percent {
      font-weight: 800;
      color: #087f9e;
      font-size: 14px;
      white-space: nowrap;
    }

    .comp-track {
      height: 8px;
      background: #e8eef5;
      border-radius: 20px;
      overflow: hidden;
      margin: 12px 0 8px;
    }

    .comp-fill {
      height: 100%;
      background: linear-gradient(90deg, #00b4d8, #0b789b);
      border-radius: 20px;
      transition: width .3s ease;
    }

    .comp-skills {
      display: grid;
      gap: 14px;
    }

    .comp-skill-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }

    .comp-skill-name {
      font-size: 13px;
      font-weight: 700;
    }

    .comp-badge {
      display: inline-flex;
      padding: 5px 8px;
      border-radius: 99px;
      background: #edf7fb;
      color: #087f9e;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    .comp-badge.good {
      background: #e9f8ef;
      color: #187345;
    }

    .comp-badge.warn {
      background: #fff5df;
      color: #996500;
    }

    .comp-empty {
      padding: 22px 14px;
      text-align: center;
      color: #64748b;
      background: #f8fafc;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.6;
    }

    .comp-project {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-top: 1px solid #edf2f7;
      padding: 13px 0;
    }

    .comp-project:first-of-type {
      border-top: 0;
    }

    .comp-project-title {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 5px;
    }

    .comp-footnote {
      font-size: 11px;
      color: #718096;
      line-height: 1.55;
      margin-top: 16px;
    }

    .comp-alert {
      background: #fff7e6;
      color: #875a00;
      border: 1px solid #f4dfac;
      padding: 12px 14px;
      border-radius: 12px;
      margin: 12px 0;
      font-size: 12px;
      line-height: 1.5;
    }

    .comp-error {
      background: #fff1f2;
      color: #9f1239;
      border: 1px solid #fecdd3;
      padding: 14px;
      border-radius: 12px;
      margin: 14px 0;
    }

    .comp-loading {
      padding: 26px;
      text-align: center;
      color: #64748b;
    }

    .comp-quicklinks {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .comp-quicklink {
      padding: 14px;
      border-radius: 12px;
      border: 1px solid #e0e8f0;
      text-decoration: none;
      color: #13243b;
      font-size: 13px;
      font-weight: 800;
      transition: border-color .2s ease, transform .2s ease;
    }

    .comp-quicklink:hover {
      border-color: #00b4d8;
      transform: translateY(-1px);
    }

    .comp-quicklink span {
      display: block;
      color: #64748b;
      font-size: 11px;
      font-weight: 400;
      margin-top: 6px;
      line-height: 1.45;
    }

    @media (max-width: 900px) {
      .comp-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .comp-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 480px) {
      .comp-grid {
        gap: 9px;
      }

      .comp-stat {
        padding: 15px;
      }

      .comp-stat-value {
        font-size: 25px;
      }

      .comp-panel {
        padding: 17px;
      }

      .comp-quicklinks {
        grid-template-columns: 1fr 1fr;
      }

      .comp-project {
        align-items: flex-start;
      }
    }
  `}</style>

  <div className="comp-wrap">
    <header className="comp-top">
      <div>
        <div className="comp-eyebrow">
          RuffNeck Learn · Learning intelligence
        </div>

        <h1 className="comp-title">Competency Dashboard</h1>

        <p className="comp-subtitle">
          See what you have learned, where you are progressing, and which
          skills need more practice. Your dashboard is based on the
          learning records currently available.
        </p>
      </div>

      <div className="comp-actions">
        <button
          className="comp-btn"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh data"}
        </button>

        <Link className="comp-btn primary" href="/student/labs">
          Open practical labs
        </Link>
      </div>
    </header>

    {error && (
      <div className="comp-error" role="alert">
        {error}

        <button
          className="comp-btn"
          onClick={() => void load()}
          style={{ marginLeft: 8 }}
        >
          Try again
        </button>
      </div>
    )}

    {loading && !error && (
      <div className="comp-loading">
        Loading your learning records…
      </div>
    )}

    {!loading && (
      <>
        <section
          className="comp-grid"
          aria-label="Competency summary"
        >
          <Stat
            label="Enrolled courses"
            value={summary.enrolledCourses}
            note={`${summary.completedCourses} completed`}
          />

          <Stat
            label="Average course progress"
            value={`${summary.averageProgress}%`}
            note="Across your enrolled courses"
          />

          <Stat
            label="Approved projects"
            value={summary.approvedProjects}
            note={`${summary.submittedProjects} total submissions`}
          />

          <Stat
            label="Certificates"
            value={summary.certificates}
            note={`${summary.trackedSkills} tracked skills`}
          />
        </section>

        {data.notices.map((notice, index) => (
          <div className="comp-alert" key={`${notice}-${index}`}>
            {notice}
          </div>
        ))}

        <div className="comp-layout">
          <div>
            <section className="comp-panel">
              <div className="comp-panel-head">
                <div>
                  <h2>Course progress</h2>
                  <p className="comp-muted">
                    Progress recorded for your current enrolments.
                  </p>
                </div>

                <span className="comp-badge">
                  {data.courses.length} courses
                </span>
              </div>

              {data.courses.length > 0 ? (
                data.courses.map((course) => {
                  const progress = Math.max(
                    0,
                    Math.min(100, course.progressPercent)
                  );

                  return (
                    <div className="comp-course" key={course.id}>
                      <div className="comp-course-head">
                        <div>
                          <p className="comp-course-title">
                            {course.title}
                          </p>

                          <div className="comp-course-meta">
                            {course.completedLessons} lesson records
                            completed
                            {course.trackedLessons
                              ? ` · ${course.trackedLessons} tracked`
                              : ""}
                          </div>
                        </div>

                        <div className="comp-percent">{progress}%</div>
                      </div>

                      <div className="comp-track">
                        <div
                          className="comp-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="comp-course-meta">
                        {progress >= 100
                          ? "Course progress complete"
                          : prettyStatus(course.enrollmentStatus)}

                        {course.slug ? (
                          <>
                            {" · "}
                            <Link
                              href={`/courses/${course.slug}`}
                              style={{
                                color: "#087f9e",
                                fontWeight: 700,
                              }}
                            >
                              Open course
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="comp-empty">
                  No course enrolments were found yet. Enrol in a course
                  and your progress will appear here.
                </div>
              )}
            </section>

            <section className="comp-panel">
              <div className="comp-panel-head">
                <div>
                  <h2>Practical project record</h2>
                  <p className="comp-muted">
                    Submission status and scores help show how you apply
                    learning.
                  </p>
                </div>
              </div>

              {data.projects.length > 0 ? (
                data.projects.map((project) => (
                  <div className="comp-project" key={project.id}>
                    <div>
                      <div className="comp-project-title">
                        Practical project submission
                      </div>

                      <div className="comp-course-meta">
                        {dateLabel(project.submittedAt)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        className={`comp-badge ${
                          ["approved", "completed", "passed"].includes(
                            project.status.toLowerCase()
                          )
                            ? "good"
                            : "warn"
                        }`}
                      >
                        {prettyStatus(project.status)}
                      </span>

                      {project.score !== null && (
                        <div
                          className="comp-course-meta"
                          style={{ marginTop: 6 }}
                        >
                          Score: {project.score}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="comp-empty">
                  Your project submissions will appear here when you
                  submit practical work.
                </div>
              )}

              {summary.averageProjectScore !== null && (
                <p className="comp-footnote">
                  Average recorded project score:{" "}
                  <strong>{summary.averageProjectScore}</strong>. Scores
                  use the values saved by the current project review
                  workflow.
                </p>
              )}
            </section>
          </div>

          <div>
            <section className="comp-panel">
              <div className="comp-panel-head">
                <div>
                  <h2>Skill profile</h2>
                  <p className="comp-muted">
                    A snapshot of the skill scores currently stored for
                    your account.
                  </p>
                </div>
              </div>

              {data.skills.length > 0 ? (
                <div className="comp-skills">
                  {data.skills.map((skill) => {
                    const score =
                      skill.score === null
                        ? null
                        : Math.max(0, Math.min(100, skill.score));

                    const badgeClass =
                      score !== null && score >= 80
                        ? "good"
                        : score !== null && score < 50
                          ? "warn"
                          : "";

                    return (
                      <div key={skill.id}>
                        <div className="comp-skill-row">
                          <span className="comp-skill-name">
                            {skill.name}
                          </span>

                          <span
                            className={`comp-badge ${badgeClass}`}
                          >
                            {score === null
                              ? prettyStatus(skill.level)
                              : `${score}%`}
                          </span>
                        </div>

                        {score !== null && (
                          <div className="comp-track">
                            <div
                              className="comp-fill"
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        )}

                        <div className="comp-course-meta">
                          {prettyStatus(skill.level)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="comp-empty">
                  Detailed skill scores are not available yet. Continue
                  lessons and assessments; this panel will populate when
                  skill-profile records are created.
                </div>
              )}

              <p className="comp-footnote">
                Skill labels and scores reflect saved profile fields.
                They are not independently re-assessed by this page.
              </p>
            </section>

            <section className="comp-panel">
              <div className="comp-panel-head">
                <div>
                  <h2>Next actions</h2>
                  <p className="comp-muted">
                    Build evidence of practical competence.
                  </p>
                </div>
              </div>

              <div className="comp-quicklinks">
                <Link
                  className="comp-quicklink"
                  href="/student/courses"
                >
                  My learning
                  <span>Continue lessons and assessments.</span>
                </Link>

                <Link
                  className="comp-quicklink"
                  href="/student/labs"
                >
                  Practical labs
                  <span>Apply concepts to real tasks.</span>
                </Link>

                <Link
                  className="comp-quicklink"
                  href="/student/assistant"
                >
                  AI assistant
                  <span>Ask for explanations and practice.</span>
                </Link>

                <Link
                  className="comp-quicklink"
                  href="/student/portfolio"
                >
                  Portfolio
                  <span>Showcase projects and achievements.</span>
                </Link>
              </div>

              <p className="comp-footnote">
                This dashboard summarizes available records. It does not
                issue certificates or alter course completion requirements.
              </p>
            </section>
          </div>
        </div>
      </>
    )}
  </div>
</main>
```

);
}

function Stat({
label,
value,
note,
}: {
label: string;
value: string | number;
note: string;
}) {
return ( <div className="comp-stat"> <div className="comp-stat-label">{label}</div> <div className="comp-stat-value">{value}</div> <div className="comp-stat-note">{note}</div> </div>
);
}
