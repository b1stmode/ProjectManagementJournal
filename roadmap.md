# Project Management Journal — Roadmap

## V1 — Core App (IndexedDB, local)
*Goal: Fully functional app, no backend, works offline*

**M1 — Project Foundation** ✓ *(2026-06-16)*
- Folder structure, PWA manifest, service worker skeleton
- IndexedDB setup with full schema
- Routing / navigation shell
- Space Grotesk + base design tokens (colors, spacing, typography)

**M2 — Projects & Milestones** ✓ *(2026-06-16)*
- Apply finalized color tokens across the app (replacing any placeholder colors from M1)
  - Base: `#141414`, Surface: `#1C1C1C`, Accent: `#7B9AB2`, Text: `#EFEFED`
  - No teal, no gradients — accent only on interactive/active elements
- Projects CRUD
- Milestones CRUD + ordering within projects
- Project detail page with inline milestone management
- Active milestone auto-logic

**M3 — Tasks** ✓ *(2026-06-20)*
- Tasks CRUD + ordering within milestones
- Task completion → milestone % auto-update
- Project completion detection
- Milestone auto-complete when all tasks done (and un-complete when a task is unchecked)

**M4 — Home Command Center** ✓ *(2026-06-20)*
- Left sidebar: project list with status badge + milestone progress bar
- Main area: all tasks from active milestone (completed tasks stay visible with strikethrough)
- Finish Session button
- `/` route now renders home; `/projects` kept as fallback

**M5 — Session Log** ✓ *(2026-06-20)*
- Finish Session modal (triggered regardless of task completion state)
- Auto-filled completed tasks (tasks completed since lastSessionAt)
- Not done list, notes field, next session plan field
- Session history readable within project detail (newest-first, read-only)

**M6 — V1 Polish & PWA** ✓ *(2026-06-20)*
- Full design pass across all screens
- Mobile layout — responsive breakpoints, sidebar becomes slide-in overlay on mobile
- Installable PWA — real service worker caching, manifest corrected
- Confirm dialogs styled (replaces window.confirm)
- Edge cases and empty states improved

**Deployment** ✓ *(2026-06-20)*
- Hosted on Cloudflare Pages
- Access restricted via Cloudflare Zero Trust (single-user gate at the network edge)

---

## V2 — Cloud Sync
*Goal: Data lives in the cloud, accessible from any device*

**M7 — Supabase Database + Sync** ✓ *(2026-06-20)*
- Supabase project setup — cloud schema mirroring IndexedDB structure (projects, milestones, tasks, sessions)
- Write layer: all mutations write to both IndexedDB and Supabase
- Read layer: on load, pull latest from Supabase if online
- Note: no Supabase Auth needed — Cloudflare Zero Trust already handles access control
- Note: design schema with per-user RLS in mind (for M12), even if not enforced yet

**M8 — Migration & Stability** ✓ *(2026-06-20)*
- One-time migration: push existing local IndexedDB data up to Supabase on first sync
- Offline-first conflict handling — local state wins when offline, syncs on reconnect
- Multi-device testing — verify data consistency across browsers/devices

---

## V3 — Enhanced Features
*Goal: Smarter planning, better visibility*

**M9 — Calendar & Dates** ✓ *(2026-06-21)*
- Read-only calendar in right sidebar (desktop: fixed column; mobile: slide-in from right)
- Important Dates as a dedicated object within projects (name + date + optional note) — CRUD on project detail
- Calendar shows dots on days with events; click any day to expand a day panel
- Today highlighted with a filled accent circle
- Home deadline alert strip — Important Dates within 7 days surface on the home screen
- IDB store `importantDates` (DB v2), Supabase `important_dates` table
- Scope: Important Dates only — per-task/milestone due dates backlogged

**M10 — Session Intelligence** ✓ *(2026-06-21)*
- Session types: small / mid / big
- Next Session Planning block in Finish Session modal — pick date + type → generates suggested task list from active milestone (small: 2 tasks, mid: 5, big: all) → user can uncheck tasks → saved as a Planned Session → appears on calendar as green-tinted entries
- Backlog per project — add/delete/reorder plain-text items; section on project detail between Dates and Sessions
- Mid-session milestone advance — already worked from M3/M4 completion chain; declared done
- IDB stores `plannedSessions` + `backlog` (DB v3), Supabase `planned_sessions` + `backlog` tables

**Post-M10 — Calendar interactivity** ✓ *(2026-06-21)*
- Clicking any calendar day (not just event days) opens a day panel
- Panel entries (Important Dates + Planned Sessions) are clickable → edit/delete modal
- "+ Schedule" button on every day panel → modal to add an Important Date or Planned Session with date pre-filled, project selector, dynamic fields per type
- All calendar mutations refresh the calendar in place without resetting the month

> Backlogged: per-task and per-milestone due dates — revisit after calendar usage patterns are clear.

---

## V4 — Integrations
*Goal: Connect to external tools*

**M11 — Google Calendar Sync**
- Connect in-app calendar to Google Calendar account
- Push Important Dates and Planned Sessions to Google Calendar so they appear natively on the phone
- Push-only (app → GCal) — no bidirectional sync

---

## V5 — Multi-user / Public Release
*Goal: Ship to other users beyond the single-user personal setup*

**M12 — Supabase Auth**
- Replace Cloudflare Zero Trust gate with in-app Supabase Auth (signup, login, persistent session)
- Row Level Security on all Supabase tables — each user only sees their own data
- User account management (email change, password reset)

---

## Backlogged Features

- **Per-task / per-milestone due dates** — deferred from M9; revisit when calendar usage patterns are clearer.
- **Versions layer** — add one hierarchy level above milestones: Project → Versions → Milestones → Tasks. Developers naturally think in versions (V1, V2, V3); the current system tracks this only in the user's head. Would also enable version-scoped session planning ("big session = finish the current version"). Significant data model change — new IDB store, new Supabase table, migration of existing milestones, UI updates across project detail and home. Scope as its own milestone before M12.
- **First-time setup walkthrough** — guided onboarding for new users explaining the app hierarchy, how to set up their first project, and how to connect the calendar feed. Relevant only when opening to other users (M12). Out of scope for single-user personal use.
