from __future__ import annotations

from pathlib import Path
import shutil
import sys

CSS_PATH = Path("src/app/globals.css")
START_MARKER = "RUFFNECK HEADER BRAND — VISIBILITY + SANS-SERIF"
END_MARKER = "CONTINUE LEARNING CARD"

REPLACEMENT = r'''/* =========================================================
   RUFFNECK LEARN — CONSOLIDATED HEADER DESIGN
   One source of truth for parent branding, navigation and mobile layout.
   ========================================================= */

.rn-parent-brand {
  width: 100%;
  background: #07162d;
  color: #dbeafe;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.rn-parent-brand-inner {
  width: min(1240px, calc(100% - 40px));
  min-height: 40px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
}

.rn-parent-brand-link {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 12px;
  color: #f8fafc;
  text-decoration: none;
}

.rn-parent-brand-link:hover,
.rn-parent-brand-visit:hover {
  text-decoration: none;
}

.rn-parent-brand-link strong {
  color: #fbbf24;
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.085em;
  line-height: 1.3;
}

.rn-parent-brand-link span {
  color: #cbd5e1;
  font-size: 0.75rem;
  font-weight: 450;
  line-height: 1.4;
}

.rn-parent-brand-visit {
  flex: 0 0 auto;
  color: #fbbf24;
  font-size: 0.77rem;
  font-weight: 750;
  text-decoration: none;
  white-space: nowrap;
}

.rn-parent-brand-visit:hover {
  color: #fde68a;
}

/* Main header */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  background: rgba(255, 255, 255, 0.97);
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(11, 30, 58, 0.045);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.site-header .inner {
  width: min(1240px, calc(100% - 40px));
  min-height: 78px;
  margin-inline: auto;
  padding-block: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 22px;
}

.site-header .brand {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-width: 0;
  gap: 12px;
  color: #0b1e3a;
  text-decoration: none;
}

.site-header .brand:hover,
.site-header .brand:focus-visible {
  text-decoration: none;
}

.site-header .brand-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.site-header .brand-logo {
  display: block;
  width: 118px;
  height: 54px;
  object-fit: contain;
  object-position: center;
}

.site-header .brand-name {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  max-width: 290px;
  color: #0b1e3a;
  text-decoration: none;
}

.site-header .brand-name strong {
  display: block;
  color: #0b1e3a;
  font-family: var(--font, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: 1.08rem;
  font-weight: 850;
  line-height: 1.15;
  letter-spacing: -0.025em;
}

.site-header .brand-name span {
  display: block;
  color: #64748b;
  font-family: var(--font, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: 0.72rem;
  font-weight: 450;
  line-height: 1.4;
}

.site-header .brand-name:hover strong {
  color: #0b1e3a;
}

/* Navigation: links wrap instead of being forced into a horizontal scroller. */
.site-header .nav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1 1 620px;
  flex-wrap: wrap;
  gap: 7px;
  min-width: 0;
  width: auto;
  overflow: visible;
}

.site-header .nav > a,
.site-header .nav > button,
.site-header .nav-button,
.site-header .nav .rn-nav-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  max-width: 100%;
  padding: 8px 11px;
  border: 1px solid #dbe3ec;
  border-radius: 9px;
  background: #ffffff;
  color: #26374b;
  font-family: var(--font, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: 0.79rem;
  font-weight: 650;
  line-height: 1.25;
  text-align: center;
  text-decoration: none;
  white-space: normal;
  overflow-wrap: normal;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.site-header .nav > a:visited {
  color: #26374b;
}

.site-header .nav > a:hover,
.site-header .nav > a:focus-visible,
.site-header .nav > button:hover,
.site-header .nav > button:focus-visible,
.site-header .nav-button:hover,
.site-header .nav-button:focus-visible {
  border-color: #a5dce8;
  background: #f0f9fc;
  color: #0b1e3a;
  text-decoration: none;
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(11, 30, 58, 0.07);
}

.site-header .nav .rn-labs-nav-button {
  border-color: #9bdfea;
  background: #e0f7fc;
  color: #0b1e3a;
  font-weight: 750;
}

.site-header .nav .rn-labs-nav-button:hover {
  border-color: #00b4d8;
  background: #c8f0f8;
}

.site-header .nav .rn-role-link--instructor {
  border-color: #82d9e9;
  background: #e0f7fc;
  color: #075985;
  font-weight: 800;
}

.site-header .nav .rn-role-link--instructor:hover {
  border-color: #00b4d8;
  background: #c8f0f8;
}

.site-header .nav .rn-role-link--admin {
  border-color: #0b1e3a;
  background: #0b1e3a;
  color: #ffffff;
  font-weight: 800;
}

.site-header .nav .rn-role-link--admin:visited,
.site-header .nav .rn-role-link--admin:hover {
  color: #ffffff;
}

.site-header .nav .rn-role-link--admin:hover {
  border-color: #15365f;
  background: #15365f;
}

.site-header .nav .rn-signup-button,
.site-header .nav .rn-signup-link,
.site-header .nav a[href="/signup"] {
  border-color: #0b1e3a;
  background: #0b1e3a;
  color: #ffffff;
  font-weight: 750;
}

.site-header .nav .rn-signup-button:visited,
.site-header .nav .rn-signup-link:visited,
.site-header .nav a[href="/signup"]:visited {
  color: #ffffff;
}

.site-header .nav .rn-signup-button:hover,
.site-header .nav .rn-signup-link:hover,
.site-header .nav a[href="/signup"]:hover {
  border-color: #15365f;
  background: #15365f;
  color: #ffffff;
}

.site-header .nav .rn-signout-button:disabled,
.site-header .nav-button:disabled {
  opacity: 0.6;
  cursor: wait;
  transform: none;
  box-shadow: none;
}

.rn-nav-loading {
  color: #64748b;
  font-size: 0.78rem;
}

.rn-signout-error {
  width: min(1200px, calc(100% - 32px));
  margin: 12px auto;
  padding: 12px 16px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Keep the homepage eyebrow legible on the light hero background. */
.rn-home-hero .eyebrow,
.rn-home-hero .hero-eyebrow {
  color: #0b1e3a;
}

/* Responsive header: wrap links onto rows; do not hide them in a scroller. */
@media (max-width: 1040px) {
  .site-header .inner {
    align-items: flex-start;
    gap: 12px;
  }

  .site-header .nav {
    flex-basis: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 600px) {
  .rn-parent-brand-inner {
    width: calc(100% - 24px);
    padding-block: 8px;
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }

  .rn-parent-brand-link {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .rn-parent-brand-link strong {
    font-size: 0.7rem;
  }

  .rn-parent-brand-link span {
    font-size: 0.7rem;
  }

  .rn-parent-brand-visit {
    display: inline-flex;
    white-space: normal;
    font-size: 0.73rem;
  }

  .site-header .inner {
    width: calc(100% - 24px);
    min-height: auto;
    padding-block: 12px;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .site-header .brand {
    width: 100%;
    gap: 10px;
  }

  .site-header .brand-logo {
    width: 82px;
    height: 44px;
  }

  .site-header .brand-name {
    max-width: none;
  }

  .site-header .brand-name strong {
    font-size: 1rem;
  }

  .site-header .brand-name span {
    max-width: 300px;
    font-size: 0.68rem;
  }

  .site-header .nav {
    width: 100%;
    flex: 1 1 auto;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 7px;
    overflow: visible;
    white-space: normal;
  }

  .site-header .nav > a,
  .site-header .nav > button,
  .site-header .nav-button,
  .site-header .nav .rn-nav-button {
    min-height: 35px;
    padding: 7px 9px;
    font-size: 0.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .site-header .nav > a,
  .site-header .nav > button,
  .site-header .nav-button {
    transition: none;
  }
}

'''


def main() -> int:
    if not CSS_PATH.is_file():
        print(f"ERROR: {CSS_PATH} was not found.")
        print("Place this script in the RuffNeck Learn repository root and run it there.")
        return 1

    css = CSS_PATH.read_text(encoding="utf-8")
    if css.count(START_MARKER) != 1:
        print(f"ERROR: Expected exactly one start marker: {START_MARKER!r}")
        print("No files were changed. Your CSS may differ from the inspected main branch.")
        return 2

    start_marker_pos = css.index(START_MARKER)
    start = css.rfind("/*", 0, start_marker_pos)
    end_marker_pos = css.find(END_MARKER, start)
    if end_marker_pos == -1:
        print(f"ERROR: Could not find the end marker: {END_MARKER!r}")
        print("No files were changed.")
        return 3

    end = css.rfind("/*", 0, end_marker_pos)
    if end == -1:
        print("ERROR: Could not locate the start of the end section. No files were changed.")
        return 4

    old_section = css[start:end]
    if len(old_section) < 8000:
        print("ERROR: The header section is much shorter than expected.")
        print("No files were changed, to avoid replacing the wrong CSS region.")
        return 5

    backup = CSS_PATH.with_name("globals.css.before-header-cleanup.bak")
    if backup.exists():
        print(f"ERROR: Backup already exists: {backup}")
        print("Rename the existing backup first. No files were changed.")
        return 6

    shutil.copy2(CSS_PATH, backup)
    updated = css[:start] + REPLACEMENT + css[end:]
    CSS_PATH.write_text(updated, encoding="utf-8", newline="\n")

    print("RuffNeck Learn header CSS cleanup completed.")
    print(f"Updated: {CSS_PATH}")
    print(f"Backup:  {backup}")
    print(f"Removed {len(old_section.splitlines())} lines of conflicting header styles and replaced them with one consolidated section.")
    print("This deliberately preserves page-specific CSS for courses, dashboards, labs, assessments, and certificates.")
    print("Next: inspect the site locally or deploy to a preview before merging into production.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
