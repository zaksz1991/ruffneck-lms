"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type NotificationKind =
  | "assessment_result"
  | "instructor_feedback"
  | "project_review"
  | "course_announcement"
  | "certificate"
  | "reminder"
  | "system";

type StudentNotification = {
  id: string;
  type: NotificationKind | string;
  title: string;
  message: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

type ApiResponse = { notifications?: StudentNotification[]; error?: string };

const FILTERS = [
  { id: "all", label: "All activity" },
  { id: "unread", label: "Unread" },
  { id: "learning", label: "Learning" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function iconFor(type: string) {
  switch (type) {
    case "assessment_result": return "✓";
    case "instructor_feedback": return "✎";
    case "project_review": return "▤";
    case "course_announcement": return "▣";
    case "certificate": return "★";
    case "reminder": return "◷";
    default: return "•";
  }
}

function labelFor(type: string) {
  switch (type) {
    case "assessment_result": return "Assessment";
    case "instructor_feedback": return "Instructor feedback";
    case "project_review": return "Project review";
    case "course_announcement": return "Course announcement";
    case "certificate": return "Certificate";
    case "reminder": return "Reminder";
    default: return "Learning update";
  }
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

export default function NotificationsCenter() {
  const [items, setItems] = useState<StudentNotification[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student/notifications", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(payload.error || "Could not load notifications.");
      setItems(Array.isArray(payload.notifications) ? payload.notifications : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);
  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter === "unread") return !item.read_at;
    if (filter === "learning") return ["assessment_result", "instructor_feedback", "project_review", "course_announcement", "certificate", "reminder"].includes(item.type);
    return true;
  }), [items, filter]);

  async function markRead(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current || current.read_at) return;
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/student/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(payload.error || "Could not update this notification.");
      setItems((old) => old.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this notification.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setBusyId("all");
    setError("");
    try {
      const response = await fetch("/api/student/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(payload.error || "Could not mark notifications as read.");
      const now = new Date().toISOString();
      setItems((old) => old.map((item) => item.read_at ? item : { ...item, read_at: now }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark notifications as read.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="nc-shell">
      <style>{`
        .nc-shell{max-width:1120px;margin:0 auto;padding:clamp(18px,3vw,32px);color:#10233f}
        .nc-hero{position:relative;overflow:hidden;display:flex;justify-content:space-between;align-items:flex-end;gap:22px;padding:clamp(24px,4vw,38px);border-radius:24px;background:linear-gradient(125deg,#0b1e3a 0%,#123d62 65%,#087f9d 100%);color:#fff;box-shadow:0 18px 42px #0b1e3a20}
        .nc-hero:after{content:"";position:absolute;width:240px;height:240px;border:1px solid #ffffff24;border-radius:50%;right:-60px;top:-120px;box-shadow:0 0 0 28px #ffffff08,0 0 0 58px #ffffff06;pointer-events:none}
        .nc-eyebrow{margin:0 0 9px;color:#70e1f1;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
        .nc-hero h1{margin:0;font-size:clamp(26px,4vw,38px);line-height:1.12;letter-spacing:-.035em}
        .nc-hero p:not(.nc-eyebrow){max-width:540px;margin:12px 0 0;color:#d8e8f4;line-height:1.65;font-size:14px}
        .nc-count{position:relative;z-index:1;flex-shrink:0;min-width:106px;padding:15px 18px;border:1px solid #ffffff32;border-radius:17px;background:#ffffff10;text-align:center;backdrop-filter:blur(8px)}
        .nc-count strong{display:block;font-size:30px;line-height:1.1}.nc-count span{display:block;margin-top:5px;color:#d8e8f4;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
        .nc-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:25px 0 16px}
        .nc-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:5px;border:1px solid #e2eaf1;border-radius:14px;background:#f5f8fb}
        .nc-tab{border:0;border-radius:10px;background:transparent;color:#63758b;padding:10px 14px;font-size:13px;font-weight:750;cursor:pointer}.nc-tab[aria-pressed="true"]{background:#fff;color:#0b1e3a;box-shadow:0 2px 9px #0b1e3a12}
        .nc-action{border:1px solid #dce6ef;border-radius:11px;background:#fff;color:#24415d;padding:10px 13px;font-size:12px;font-weight:800;cursor:pointer}.nc-action:disabled{opacity:.45;cursor:not-allowed}
        .nc-list{display:grid;gap:10px}.nc-item{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:14px;align-items:start;padding:18px;border:1px solid #e3ebf2;border-radius:17px;background:#fff;transition:border-color .15s,transform .15s,box-shadow .15s}.nc-item:hover{border-color:#b9dce7;box-shadow:0 8px 24px #0b1e3a08}.nc-item.unread{border-color:#c7e9f0;background:linear-gradient(90deg,#f2fcfe 0%,#fff 48%)}
        .nc-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#eaf8fb;color:#087f9d;font-size:20px;font-weight:800}.nc-item:nth-child(3n+2) .nc-icon{background:#eef3ff;color:#3f5fb7}.nc-item:nth-child(3n) .nc-icon{background:#fff7e7;color:#a76b00}
        .nc-itembody{min-width:0}.nc-itemtop{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.nc-item h2{margin:0;color:#132b48;font-size:14px;font-weight:850;line-height:1.45}.nc-tag{padding:4px 7px;border-radius:6px;background:#eef3f7;color:#61758a;font-size:9px;font-weight:850;letter-spacing:.055em;text-transform:uppercase}.nc-new{display:inline-block;width:7px;height:7px;border-radius:50%;background:#00a6c8}.nc-message{margin:7px 0 10px;color:#607287;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}.nc-itembottom{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.nc-time{color:#8292a3;font-size:11px;font-weight:650}.nc-open{color:#087f9d;font-size:12px;font-weight:850;text-decoration:none}.nc-open:hover{text-decoration:underline}.nc-read{align-self:center;border:1px solid #dce6ef;border-radius:9px;background:#fff;color:#53677c;padding:8px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.nc-read:disabled{opacity:.5;cursor:wait}
        .nc-state{padding:42px 20px;border:1px dashed #d4e0e9;border-radius:18px;background:#fbfdff;text-align:center}.nc-stateicon{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 14px;border-radius:17px;background:#eaf8fb;color:#087f9d;font-size:24px;font-weight:800}.nc-state h2{margin:0;color:#17314f;font-size:17px}.nc-state p{max-width:440px;margin:8px auto 0;color:#718196;font-size:13px;line-height:1.65}.nc-retry{margin-top:16px;border:0;border-radius:10px;background:#0b1e3a;color:#fff;padding:10px 15px;font-size:12px;font-weight:800;cursor:pointer}
        .nc-error{margin:0 0 14px;padding:12px 14px;border:1px solid #f3c8c8;border-radius:12px;background:#fff5f5;color:#9c3030;font-size:13px}.nc-footer{margin-top:18px;color:#8292a3;font-size:11px;line-height:1.6}
        @media(max-width:620px){.nc-hero{align-items:flex-start;flex-direction:column}.nc-count{display:flex;align-items:center;gap:10px;padding:10px 13px}.nc-count strong{font-size:23px}.nc-count span{margin:0}.nc-item{grid-template-columns:38px minmax(0,1fr);gap:11px;padding:14px}.nc-icon{width:38px;height:38px;border-radius:12px}.nc-read{grid-column:2;justify-self:start}.nc-tabs{width:100%}.nc-tab{flex:1;padding:10px 7px}}
      `}</style>

      <section className="nc-hero">
        <div>
          <p className="nc-eyebrow">Your learning updates</p>
          <h1>Notifications</h1>
          <p>Keep track of assessment results, project reviews, instructor feedback, course announcements, and certificates in one place.</p>
        </div>
        <div className="nc-count" aria-live="polite"><strong>{unreadCount}</strong><span>Unread updates</span></div>
      </section>

      <div className="nc-toolbar">
        <div className="nc-tabs" role="group" aria-label="Filter notifications">
          {FILTERS.map((item) => <button key={item.id} type="button" className="nc-tab" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}{item.id === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}</button>)}
        </div>
        <button type="button" className="nc-action" onClick={() => void markAllRead()} disabled={unreadCount === 0 || busyId !== null}>{busyId === "all" ? "Updating…" : "Mark all as read"}</button>
      </div>

      {error && <div className="nc-error" role="alert">{error}</div>}

      {loading ? (
        <div className="nc-state" role="status"><div className="nc-stateicon">◷</div><h2>Loading your updates</h2><p>Your notifications will appear here.</p></div>
      ) : visibleItems.length === 0 ? (
        <div className="nc-state"><div className="nc-stateicon">{filter === "unread" ? "✓" : "✦"}</div><h2>{filter === "unread" ? "You’re all caught up" : filter === "learning" ? "No learning updates yet" : "No notifications yet"}</h2><p>{filter === "unread" ? "There are no unread notifications. New learning activity will appear here." : "When there is an assessment result, project review, course update, or certificate notification, you’ll find it here."}</p>{error && <button type="button" className="nc-retry" onClick={() => void loadNotifications()}>Try again</button>}</div>
      ) : (
        <div className="nc-list">
          {visibleItems.map((item) => (
            <article key={item.id} className={`nc-item${item.read_at ? "" : " unread"}`}>
              <div className="nc-icon" aria-hidden="true">{iconFor(item.type)}</div>
              <div className="nc-itembody">
                <div className="nc-itemtop"><h2>{item.title}</h2>{!item.read_at && <span className="nc-new" title="Unread" aria-label="Unread" />}<span className="nc-tag">{labelFor(item.type)}</span></div>
                <p className="nc-message">{item.message}</p>
                <div className="nc-itembottom"><span className="nc-time" title={new Date(item.created_at).toLocaleString()}>{timeAgo(item.created_at)}</span>{item.href && item.href.startsWith("/") && <Link className="nc-open" href={item.href} onClick={() => { if (!item.read_at) void markRead(item.id); }}>View details →</Link>}</div>
              </div>
              {!item.read_at && <button type="button" className="nc-read" onClick={() => void markRead(item.id)} disabled={busyId !== null}>{busyId === item.id ? "Saving…" : "Mark read"}</button>}
            </article>
          ))}
        </div>
      )}
      <p className="nc-footer">Notifications are private to your account. Only updates linked to your signed-in account are shown.</p>
    </main>
  );
}
