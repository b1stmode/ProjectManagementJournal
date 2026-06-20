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
- Deadline alerts section (empty state — wired in M9)
- Finish Session button (rendered, stubbed — wired in M5)
- `/` route now renders home; `/projects` kept as fallback

**M5 — Session Log** ✓ *(2026-06-20)*
- Finish Session modal (triggered regardless of task completion state)
- Auto-filled completed tasks (tasks completed since lastSessionAt)
- Not done list (incomplete tasks from active milestone), notes field, next session plan field
- Session history readable within project detail (newest-first, read-only)

**M6 — V1 Polish & PWA** ✓ *(2026-06-20)*
- Full design pass across all screens
- Mobile layout — responsive breakpoints across all component CSS files
- Installable PWA — real service worker caching, manifest corrected
- Confirm dialogs styled (replaces window.confirm)
- Deadline Alerts stub removed
- Edge cases and empty states improved

---

## V2 — Auth & Sync
*Goal: Cross-device access, personal data in the cloud*

**M7 — Supabase Integration**
- User auth (signup, login, persistent session)
- Cloud schema mirroring IndexedDB structure
- Data sync

**M8 — Migration & Stability**
- Local → cloud data migration on first login
- Multi-device testing
- Offline-first conflict handling (local wins when offline)

---

## V3 — Enhanced Features
*Goal: Smarter planning, better visibility*

**M9 — Calendar & Dates**
- Read-only calendar on home (today highlighted, deadlines marked)
- Important Dates as a dedicated object within projects
- Click date → show deadlines for that day

**M10 — Session Intelligence**
- Session types: short / medium / long → different task counts
- Mid-session milestone completion handling (pull from next milestone)
- Backlog management per project

---

## V4 — Integrations
*Goal: Connect to external tools*

**M11 — Google Calendar Sync**
- Connect in-app calendar to Google Calendar account
- Tasks with due dates appear natively on phone calendar
- View upcoming project tasks without opening the app
