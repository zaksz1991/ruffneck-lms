import AIAssessmentCoach from "@/components/student/AIAssessmentCoach";
import Link from "next/link";

export const metadata = {
  title: "AI Assessment Coach | RuffNeck Learn",
  description:
    "Get learning hints, review your attempts, and practise assessment questions.",
};

export default function AIAssessmentCoachPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f6fa",
        padding: "32px 20px 56px",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/student"
          style={{
            display: "inline-block",
            marginBottom: "24px",
            color: "#0b1e3a",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          ← Back to Student Dashboard
        </Link>

        <header style={{ marginBottom: "24px" }}>
          <p
            style={{
              color: "#087f9c",
              fontWeight: 800,
              fontSize: "12px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
            }}
          >
            RUFFNECK LEARN
          </p>

          <h1
            style={{
              color: "#0b1e3a",
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 800,
              lineHeight: 1.2,
              margin: "8px 0 12px",
            }}
          >
            AI Assessment Coach
          </h1>

          <p
            style={{
              color: "#53657a",
              fontSize: "16px",
              lineHeight: 1.7,
              maxWidth: "680px",
            }}
          >
            Understand difficult concepts, get hints, review your own answers,
            and generate similar practice questions to strengthen your skills.
          </p>
        </header>

        <AIAssessmentCoach />

        <p
          style={{
            color: "#64748b",
            fontSize: "13px",
            lineHeight: 1.6,
            marginTop: "18px",
          }}
        >
          The coach supports independent learning. It does not change your
          assessment scores, course progress, or certificate eligibility.
        </p>
      </div>
    </main>
  );
}