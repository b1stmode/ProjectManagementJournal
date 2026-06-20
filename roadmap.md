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

**M7 — Supabase Database + Sync**
- Supabase project setup — cloud schema mirroring IndexedDB structure (projects, milestones, tasks, sessions)
- Write layer: all mutations write to both IndexedDB and Supabase
- Read layer: on load, pull latest from Supabase if online
- Note: no Supabase Auth needed — Cloudflare Zero Trust already handles access control
- Note: design schema with per-user RLS in mind (for M12), even if not enforced yet

**M8 — Migration & Stability**
- One-time migration: push existing local IndexedDB data up to Supabase on first sync
- Offline-first conflict handling — local state wins when offline, syncs on reconnect
- Multi-device testing — verify data consistency across browsers/devices

---

## V3 — Enhanced Features
*Goal: Smarter planning, better visibility*

**M9 — Calendar & Dates**
- Read-only calendar on home (today highlighted, deadlines marked)
- Important Dates as a dedicated object within projects
- Click date → show deadlines for that day

**M10 — Session Intelligence**
- Session types: short / medium / long → different task counts shown on home
- Mid-session milestone completion handling (pull tasks from next milestone)
- Backlog management per project

---

## V4 — Integrations
*Goal: Connect to external tools*

**M11 — Google Calendar Sync**
- Connect in-app calendar to Google Calendar account
- Tasks with due dates appear natively on phone calendar
- View upcoming project tasks without opening the app

---

## V5 — Multi-user / Public Release
*Goal: Ship to other users beyond the single-user personal setup*

**M12 — Supabase Auth**
- Replace Cloudflare Zero Trust gate with in-app Supabase Auth (signup, login, persistent session)
- Row Level Security on all Supabase tables — each user only sees their own data
- User account management (email change, password reset)
