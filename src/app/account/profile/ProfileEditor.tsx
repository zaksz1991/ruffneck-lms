"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./ProfilePage.module.css";

type ProfileEditorProps = {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string | null;
};

function formatRole(value: string) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initials(name: string, email: string) {
  const trimmed = name.trim();

  if (trimmed) {
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  return (email.trim().charAt(0) || "R").toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(parsed);
}

export default function ProfileEditor({
  userId,
  fullName,
  email,
  phone,
  role,
  createdAt,
}: ProfileEditorProps) {
  const [name, setName] = useState(fullName);
  const [phoneNumber, setPhoneNumber] = useState(phone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const completion = useMemo(() => {
    const requiredFields = [
      Boolean(name.trim()),
      Boolean(email.trim()),
    ];

    return Math.round(
      (requiredFields.filter(Boolean).length / requiredFields.length) * 100
    );
  }, [name, email]);

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const cleanName = name.trim().replace(/\s+/g, " ");
    const cleanPhone = phoneNumber.trim();

    if (cleanName.length < 2) {
      setError("Enter your full name using at least two characters.");
      return;
    }

    if (cleanName.length > 100) {
      setError("Your name must be 100 characters or fewer.");
      return;
    }

    if (
      cleanPhone &&
      (!/^[+()\d\s.-]{7,32}$/.test(cleanPhone) ||
        !/\d{7,}/.test(cleanPhone))
    ) {
      setError(
        "Enter a valid phone number, including its country code when applicable."
      );
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const { data: updatedRow, error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: cleanName,
          phone: cleanPhone || null,
        })
        .eq("id", userId)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("Profile update failed:", updateError.message);

        setError(
          "Your changes could not be saved. Check your connection and try again."
        );

        return;
      }

      if (!updatedRow) {
        console.error(
          "Profile update failed: No updated profile row was returned."
        );

        setError(
          "Your profile could not be updated. Please refresh the page and try again."
        );

        return;
      }

      setName(cleanName);
      setPhoneNumber(cleanPhone);
      setMessage("Profile saved successfully.");
    } catch (saveError) {
      console.error("Unexpected profile update failure:", saveError);

      setError("Something went wrong while saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setName(fullName);
    setPhoneNumber(phone);
    clearFeedback();
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.profileCard}>
        <div
          className={styles.avatar}
          aria-label={`${name || email} initials`}
        >
          {initials(name, email)}
        </div>

        <h2>{name.trim() || "Your name"}</h2>

        <p className={styles.profileEmail}>
          {email || "Email unavailable"}
        </p>

        <span className={styles.roleBadge}>{formatRole(role)}</span>

        <div className={styles.completionBlock}>
          <div className={styles.completionHeading}>
            <span>Profile completeness</span>
            <strong>{completion}%</strong>
          </div>

          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Profile completeness"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${completion}%` }} />
          </div>

          <p>
            {completion === 100
              ? "Your essential profile details are complete. Adding a phone number is optional."
              : "Enter your full name to complete your essential profile details."}
          </p>
        </div>

        <div className={styles.profileMeta}>
          <span>Account created</span>
          <strong>{formatDate(createdAt)}</strong>
        </div>
      </aside>

      <section className={styles.formCard}>
        <div className={styles.formIntro}>
          <span className={styles.eyebrow}>PERSONAL INFORMATION</span>

          <h2>Profile details</h2>

          <p>
            Update your personal information. Your email and account role
            remain read-only to protect your account and permissions.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span>
              Full name <b aria-hidden="true">*</b>
            </span>

            <input
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearFeedback();
              }}
              maxLength={100}
              required
              disabled={saving}
              placeholder="Enter your full name"
            />
          </label>

          <label className={styles.field}>
            <span>Email address</span>

            <input
              value={email}
              type="email"
              readOnly
              disabled
              aria-describedby="email-help"
            />

            <small id="email-help">
              Your email is managed by your sign-in account.
            </small>
          </label>

          <label className={styles.field}>
            <span>Phone number</span>

            <input
              autoComplete="tel"
              inputMode="tel"
              value={phoneNumber}
              onChange={(event) => {
                setPhoneNumber(event.target.value);
                clearFeedback();
              }}
              maxLength={32}
              disabled={saving}
              placeholder="e.g. +234 800 000 0000"
            />

            <small>
              Optional. Include your country code when applicable.
            </small>
          </label>

          <label className={styles.field}>
            <span>Account role</span>

            <input value={formatRole(role)} readOnly disabled />

            <small>
              Only an authorised administrator can change account roles.
            </small>
          </label>

          {error ? (
            <p className={styles.errorMessage} role="alert">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className={styles.successMessage} role="status">
              {message}
            </p>
          ) : null}

          <div className={styles.formActions}>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving changes…" : "Save profile"}
            </button>

            <button
              className={styles.secondaryButton}
              type="button"
              disabled={saving}
              onClick={discardChanges}
            >
              Discard changes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}