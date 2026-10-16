"use client";

import { useState } from "react";

export default function InstructorAssignmentButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function assignInstructor() {
    const confirmed = window.confirm(
      "Promote Zakariya Hassan to instructor and assign him to the test lab course?"
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await fetch("/api/admin/users/role", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The operation failed.");
      }

      setSuccess(true);
      setMessage(result.message || "Instructor assigned successfully.");
    } catch (error) {
      setSuccess(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={assignInstructor}
        disabled={loading}
        style={{
          background: loading ? "#64748b" : "#00b4d8",
          color: "#0b1e3a",
          border: "none",
          borderRadius: 10,
          padding: "13px 20px",
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading
          ? "Assigning instructor..."
          : "Promote to Instructor"}
      </button>

      {message && (
        <p
          role="status"
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: success ? "#dcfce7" : "#fee2e2",
            color: success ? "#166534" : "#991b1b",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}