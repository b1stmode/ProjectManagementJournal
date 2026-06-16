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

**M3 — Tasks**
- Tasks CRUD + ordering within milestones
- Task completion → milestone % auto-update
- Project completion detection
- Active project set manually
- Auto-advance: next most-progressed project activates on completion, or nothing (user picks)

**M4 — Home Command Center**
- Left sidebar: project list, status, progress bar, dropdown actions
- Main area: today's 4 sequential tasks from active milestone
- Deadline alerts below session
- Finish Session button

**M5 — Session Log**
- Finish Session modal (triggered regardless of task completion state)
- Auto-filled completed tasks
- Not done list, notes field, next session plan field
- Session history readable within project detail

**M6 — V1 Polish & PWA**
- Full design pass across all screens
- Mobile layout
- Installable PWA (manifest + service worker complete)
- Edge cases, empty states, error handling

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
