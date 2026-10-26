import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

type VerificationRecord = {
  id: string;
  verification_code: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function generateVerificationCode() {
  return randomBytes(12).toString("hex").toUpperCase();
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isUnexpired(record: VerificationRecord) {
  if (!record.expires_at) {
    return true;
  }

  const expiry = new Date(record.expires_at).getTime();

  return Number.isFinite(expiry) && expiry > Date.now();
}

function isUsable(record: VerificationRecord) {
  return record.is_active && isUnexpired(record);
}

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
    };
  }

  return {
    supabase,
    user,
  };
}

async function getActiveRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
) {
  return supabase
    .from("skill_passport_verifications")
    .select(
      "id,verification_code,is_active,expires_at,created_at,updated_at",
    )
    .eq("student_id", studentId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    if (!user) {
      return jsonError("Authentication required.", 401);
    }

    const { data, error } = await supabase
      .from("skill_passport_verifications")
      .select(
        "id,verification_code,is_active,expires_at,created_at,updated_at",
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Skill Passport verification lookup failed:",
        error.message,
      );

      return jsonError(
        "Unable to load your verification settings.",
        500,
      );
    }

    const verification = data as VerificationRecord | null;

    return NextResponse.json({
      verification,
      isExpired: verification
        ? !isUnexpired(verification)
        : false,
      isUsable: verification
        ? isUsable(verification)
        : false,
    });
  } catch (error) {
    console.error("Skill Passport GET error:", error);

    return jsonError(
      "An unexpected error occurred while loading verification settings.",
      500,
    );
  }
}

export async function POST() {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    if (!user) {
      return jsonError("Authentication required.", 401);
    }

    /*
     * Reuse a valid active verification code.
     * Expired active codes are deactivated before a replacement is created.
     */
    const {
      data: activeData,
      error: activeError,
    } = await getActiveRecords(supabase, user.id);

    if (activeError) {
      console.error(
        "Active verification lookup failed:",
        activeError.message,
      );

      return jsonError(
        "Unable to check your existing verification link.",
        500,
      );
    }

    const activeRecords =
      (activeData ?? []) as VerificationRecord[];

    const validRecord = activeRecords.find(isUsable);

    if (validRecord) {
      return NextResponse.json({
        verification: validRecord,
        message: "Your verification link is already active.",
      });
    }

    if (activeRecords.length > 0) {
      const expiredIds = activeRecords.map((record) => record.id);

      const { error: deactivateError } = await supabase
        .from("skill_passport_verifications")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", user.id)
        .in("id", expiredIds)
        .eq("is_active", true);

      if (deactivateError) {
        console.error(
          "Expired verification cleanup failed:",
          deactivateError.message,
        );

        return jsonError(
          "Unable to refresh your expired verification link.",
          500,
        );
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const verificationCode = generateVerificationCode();

      const {
        data,
        error: insertError,
      } = await supabase
        .from("skill_passport_verifications")
        .insert({
          student_id: user.id,
          verification_code: verificationCode,
          is_active: true,
        })
        .select(
          "id,verification_code,is_active,expires_at,created_at,updated_at",
        )
        .single();

      if (!insertError && data) {
        return NextResponse.json(
          {
            verification: data as VerificationRecord,
            message: "Verification link created successfully.",
          },
          { status: 201 },
        );
      }

      /*
       * PostgreSQL unique-constraint violations normally use code 23505.
       * Check the code rather than matching the English error message.
       */
      if (insertError?.code === "23505") {
        const {
          data: concurrentData,
          error: concurrentError,
        } = await getActiveRecords(supabase, user.id);

        if (concurrentError) {
          console.error(
            "Verification retry lookup failed:",
            concurrentError.message,
          );

          return jsonError(
            "Unable to confirm the verification link.",
            500,
          );
        }

        const concurrentRecord = (
          (concurrentData ?? []) as VerificationRecord[]
        ).find(isUsable);

        if (concurrentRecord) {
          return NextResponse.json({
            verification: concurrentRecord,
            message: "Your verification link is already active.",
          });
        }

        // A duplicate code may be retried with a new random code.
        // A different unique constraint may still prevent insertion.
        continue;
      }

      console.error(
        "Verification record creation failed:",
        insertError?.message,
      );

      return jsonError(
        "Unable to create a verification link. Please try again.",
        500,
      );
    }

    return jsonError(
      "Unable to generate a unique verification code. Please try again.",
      500,
    );
  } catch (error) {
    console.error("Skill Passport POST error:", error);

    return jsonError(
      "An unexpected error occurred while creating verification.",
      500,
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    if (!user) {
      return jsonError("Authentication required.", 401);
    }

    let body: { is_active?: unknown };

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    if (typeof body.is_active !== "boolean") {
      return jsonError("is_active must be a boolean.", 400);
    }

    const shouldActivate = body.is_active;
    const timestamp = new Date().toISOString();

    /*
     * Deactivation disables every active verification code for this
     * learner, including older codes. That prevents a previous sharing
     * link from remaining active after the learner switches sharing off.
     */
    if (!shouldActivate) {
      const { data, error } = await supabase
        .from("skill_passport_verifications")
        .update({
          is_active: false,
          updated_at: timestamp,
        })
        .eq("student_id", user.id)
        .eq("is_active", true)
        .select(
          "id,verification_code,is_active,expires_at,created_at,updated_at",
        );

      if (error) {
        console.error(
          "Verification deactivation failed:",
          error.message,
        );

        return jsonError(
          "Unable to deactivate your verification link.",
          500,
        );
      }

      const records = (data ?? []) as VerificationRecord[];

      if (records.length === 0) {
        return jsonError(
          "There is no active verification link to deactivate.",
          404,
        );
      }

      return NextResponse.json({
        verification: records[0],
        message: "Verification links have been deactivated.",
      });
    }

    /*
     * First check whether the learner already has a usable active code.
     */
    const {
      data: activeData,
      error: activeError,
    } = await getActiveRecords(supabase, user.id);

    if (activeError) {
      console.error(
        "Active verification lookup failed:",
        activeError.message,
      );

      return jsonError(
        "Unable to check your current verification settings.",
        500,
      );
    }

    const activeRecords =
      (activeData ?? []) as VerificationRecord[];

    const validActiveRecord = activeRecords.find(isUsable);

    if (validActiveRecord) {
      /*
       * If older active codes exist, disable them so only the selected
       * current link remains active.
       */
      const oldActiveIds = activeRecords
        .filter((record) => record.id !== validActiveRecord.id)
        .map((record) => record.id);

      if (oldActiveIds.length > 0) {
        const { error: cleanupError } = await supabase
          .from("skill_passport_verifications")
          .update({
            is_active: false,
            updated_at: timestamp,
          })
          .eq("student_id", user.id)
          .in("id", oldActiveIds)
          .eq("is_active", true);

        if (cleanupError) {
          console.error(
            "Old verification cleanup failed:",
            cleanupError.message,
          );

          return jsonError(
            "Unable to clean up older verification links.",
            500,
          );
        }
      }

      return NextResponse.json({
        verification: validActiveRecord,
        message: "Your verification link is already active.",
      });
    }

    // Expired active records should not be reactivated.
    if (activeRecords.length > 0) {
      const { error: deactivateError } = await supabase
        .from("skill_passport_verifications")
        .update({
          is_active: false,
          updated_at: timestamp,
        })
        .eq("student_id", user.id)
        .eq("is_active", true);

      if (deactivateError) {
        console.error(
          "Expired verification deactivation failed:",
          deactivateError.message,
        );

        return jsonError(
          "Unable to deactivate expired verification links.",
          500,
        );
      }
    }

    /*
     * Reactivate the newest unexpired inactive code.
     * If all existing codes have expired, the caller should use POST
     * to create a fresh verification code instead.
     */
    const {
      data: inactiveData,
      error: inactiveError,
    } = await supabase
      .from("skill_passport_verifications")
      .select(
        "id,verification_code,is_active,expires_at,created_at,updated_at",
      )
      .eq("student_id", user.id)
      .eq("is_active", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inactiveError) {
      console.error(
        "Inactive verification lookup failed:",
        inactiveError.message,
      );

      return jsonError(
        "Unable to locate a verification link to activate.",
        500,
      );
    }

    const inactiveRecord =
      inactiveData as VerificationRecord | null;

    if (!inactiveRecord) {
      return jsonError(
        "No verification code exists yet. Create a verification link first.",
        404,
      );
    }

    if (!isUnexpired(inactiveRecord)) {
      return jsonError(
        "This verification code has expired. Create a new verification link instead.",
        410,
      );
    }

    const {
      data: updatedRecord,
      error: updateError,
    } = await supabase
      .from("skill_passport_verifications")
      .update({
        is_active: true,
        updated_at: timestamp,
      })
      .eq("id", inactiveRecord.id)
      .eq("student_id", user.id)
      .eq("is_active", false)
      .select(
        "id,verification_code,is_active,expires_at,created_at,updated_at",
      )
      .maybeSingle();

    if (updateError) {
      console.error(
        "Verification activation failed:",
        updateError.message,
      );

      return jsonError(
        "Unable to activate your verification link.",
        500,
      );
    }

    if (!updatedRecord) {
      return jsonError(
        "The verification link changed before it could be activated. Reload the page and try again.",
        409,
      );
    }

    return NextResponse.json({
      verification: updatedRecord as VerificationRecord,
      message: "Verification link activated.",
    });
  } catch (error) {
    console.error("Skill Passport PATCH error:", error);

    return jsonError(
      "An unexpected error occurred while updating verification settings.",
      500,
    );
  }
}