import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 🟨 FIX 1: Preserve the existing user and course IDs.
const USER_ID = "c2ded758-b63f-4998-9d9c-2f6e8c393adc";
const COURSE_ID = "ed6c001a-7a0f-44ad-98e3-404d690c2831";

export async function POST() {
try {
const supabase = await createClient();

```
// 🟨 FIX 2: Verify the user's authenticated session.
const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();

if (authError || !user) {
  return NextResponse.json(
    { error: "Please sign in first." },
    { status: 401 }
  );
}

// 🟨 FIX 3: Verify administrator permissions.
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .maybeSingle();

if (profileError) {
  console.error("Administrator verification failed:", profileError.message);

  return NextResponse.json(
    { error: "Unable to verify administrator permissions." },
    { status: 500 }
  );
}

if (profile?.role !== "admin") {
  return NextResponse.json(
    { error: "Only administrators can perform this action." },
    { status: 403 }
  );
}

// 🟨 FIX 4: Confirm that the target profile exists.
const { data: targetProfile, error: targetError } = await supabase
  .from("profiles")
  .select("id")
  .eq("id", USER_ID)
  .maybeSingle();

if (targetError) {
  console.error("Target profile lookup failed:", targetError.message);

  return NextResponse.json(
    { error: "Unable to verify the target user." },
    { status: 500 }
  );
}

if (!targetProfile) {
  return NextResponse.json(
    { error: "The target user profile does not exist." },
    { status: 404 }
  );
}

// 🟨 FIX 5: Confirm the target course exists.
const { data: course, error: courseError } = await supabase
  .from("courses")
  .select("id, title")
  .eq("id", COURSE_ID)
  .maybeSingle();

if (courseError) {
  console.error("Course lookup failed:", courseError.message);

  return NextResponse.json(
    { error: "Unable to verify the target course." },
    { status: 500 }
  );
}

if (!course) {
  return NextResponse.json(
    { error: "The target course does not exist." },
    { status: 404 }
  );
}

// 🟨 FIX 6: Call the database function with its expected parameters.
const { error: assignmentError } = await supabase.rpc(
  "admin_promote_instructor_and_assign_course",
  {
    p_user_id: USER_ID,
    p_course_id: COURSE_ID,
  }
);

if (assignmentError) {
  console.error("Instructor assignment failed:", assignmentError.message);

  return NextResponse.json(
    {
      error:
        "Instructor assignment failed. Check the database function and permissions.",
    },
    { status: 500 }
  );
}

// 🟨 FIX 7: Return success only when the database function succeeds.
return NextResponse.json({
  success: true,
  message: `Instructor role and course assignment updated successfully for ${course.title}.`,
});
```

} catch (error) {
console.error("Instructor role route error:", error);

```
return NextResponse.json(
  { error: "An unexpected error occurred." },
  { status: 500 }
);
```

}
}
