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
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(parsed);
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
    const requiredFields = [Boolean(name.trim()), Boolean(email.trim()), Boolean(phoneNumber.trim())];
    return Math.round((requiredFields.filter(Boolean).length / requiredFields.length) * 100);
  }, [name, email, phoneNumber]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

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
    if (cleanPhone && (!/^[+()\d\s.-]{7,32}$/.test(cleanPhone) || !/\d{7,}/.test(cleanPhone))) {
      setError("Enter a valid phone number, including its country code when applicable.");
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

      if (updateError || !updatedRow) {
        console.error("Profile update failed:", updateError.message);
        setError("Your changes could not be saved. Check your connection and try again.");
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

  return (
    <div className={styles.layout}>
      <aside className={styles.profileCard}>
        <div className={styles.avatar} aria-label={`${name || email} initials`}>
          {initials(name, email)}
        </div>
        <h2>{name.trim() || "Your name"}</h2>
        <p className={styles.profileEmail}>{email || "Email unavailable"}</p>
        <span className={styles.roleBadge}>{formatRole(role)}</span>
        <div className={styles.completionBlock}>
          <div className={styles.completionHeading}>
            <span>Profile completeness</span>
            <strong>{completion}%</strong>
          </div>
          <div className={styles.progressTrack} aria-label={`Profile completeness ${completion}%`}>
            <span style={{ width: `${completion}%` }} />
          </div>
          <p>Add a phone number if you want your profile to be more complete.</p>
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
          <p>Only the fields below are editable here. Your email and account role are read-only to prevent accidental account or permission changes.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span>Full name <b aria-hidden="true">*</b></span>
            <input
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
              disabled={saving}
              placeholder="Enter your full name"
            />
          </label>

          <label className={styles.field}>
            <span>Email address</span>
            <input value={email} type="email" readOnly disabled aria-describedby="email-help" />
            <small id="email-help">Email is managed by your sign-in account, not this profile form.</small>
          </label>

          <label className={styles.field}>
            <span>Phone number</span>
            <input
              autoComplete="tel"
              inputMode="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              maxLength={32}
              disabled={saving}
              placeholder="e.g. +234 800 000 0000"
            />
            <small>Optional. Include the country code if you use one.</small>
          </label>

          <label className={styles.field}>
            <span>Account role</span>
            <input value={formatRole(role)} readOnly disabled />
            <small>Only an authorised administrator can change account roles.</small>
          </label>

          {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
          {message ? <p className={styles.successMessage} role="status">{message}</p> : null}

          <div className={styles.formActions}>
            <button className={styles.primaryButton} type="submit" disabled={saving}>
              {saving ? "Saving changes…" : "Save profile"}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={saving}
              onClick={() => {
                setName(fullName);
                setPhoneNumber(phone);
                setError("");
                setMessage("");
              }}
            >
              Discard changes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
