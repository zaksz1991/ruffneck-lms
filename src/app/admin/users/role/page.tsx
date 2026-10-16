import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InstructorAssignmentButton from "./InstructorAssignmentButton";

export const dynamic = "force-dynamic";

export default async function InstructorAssignmentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/users/role");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return (
      <main
        style={{
          maxWidth: 700,
          margin: "60px auto",
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1>Administrator access required</h1>
        <p>You must sign in with an administrator account to use this page.</p>
        <Link href="/admin">Return to Admin</Link>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "40px auto",
        padding: 24,
        fontFamily: "Arial, sans-serif",
        color: "#0b1e3a",
      }}
    >
      <Link
        href="/admin"
        style={{
          color: "#087f9c",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        ← Back to Admin
      </Link>

      <section
        style={{
          marginTop: 24,
          padding: 28,
          border: "1px solid #dbe4ee",
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 8px 24px rgba(11, 30, 58, 0.06)",
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: "#087f9c",
          }}
        >
          RUFFNECK LEARN · ADMINISTRATION
        </p>

        <h1 style={{ fontSize: 28, marginBottom: 8 }}>
          Instructor Assignment
        </h1>

        <p style={{ color: "#475569", lineHeight: 1.7 }}>
          Promote an existing RuffNeck Learn user to instructor and assign
          them to the test lab course.
        </p>

        <div
          style={{
            marginTop: 24,
            marginBottom: 24,
            padding: 18,
            borderRadius: 12,
            background: "#f1f5f9",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
            User: Zakariya Hassan
          </p>
          <p style={{ margin: "0 0 8px", color: "#475569" }}>
            Account: hassan_zakariyya@yahoo.com
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            Action: Set instructor role and assign the test lab course.
          </p>
        </div>

        <InstructorAssignmentButton />

        <p
          style={{
            marginTop: 24,
            fontSize: 13,
            lineHeight: 1.6,
            color: "#64748b",
          }}
        >
          Only an authenticated administrator can complete this action.
        </p>
      </section>
    </main>
  );
}