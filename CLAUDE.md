# CLAUDE.md — Project Management Journal

## Project Overview

**Name:** Project Management Journal (working title)
**Type:** PWA
**Purpose:** Help developers maintain momentum across multiple projects by centralizing projects, milestones, tasks, and session logs in one place.

**Core success metric:** Within 10 seconds of opening the app, the user knows what to work on next.

---

## Tech Stack

- HTML / CSS / JavaScript
- PWA architecture
- IndexedDB (V1 — local storage, no backend)
- Supabase auth + sync planned for V2/V3

---

## Data Hierarchy

```
Project
├─ Versions (ordered)
│  └─ Milestones (ordered within version)
│     └─ Tasks (ordered within milestone)
├─ Session History
├─ Planned Sessions (M10)
├─ Important Dates (M9)
└─ Backlog (M10)
```

No standalone tasks, milestones, sessions, or versions outside a project context.

---

## Core Logic

- **Active project** — user sets manually, one at a time
- **Active milestone** — auto: lowest-order incomplete milestone in active project
- **Today's tasks** — next 4 uncompleted tasks in sequential order from active milestone
- **Milestone completion** — next milestone auto-activates; all done → project marked complete
- **Project completion** — next most-progressed project activates, or nothing (user picks)
- **Session end** — explicit "Finish Session" button triggers log modal regardless of task state

---

## Session Log Format

Structured, not a diary. Resembles lightweight commit history.

```
2026-06-16

✓ Completed task A
✓ Completed task B

NOT DONE:
✗ Task C

NOTES:
Bug in X — details here

NEXT SESSION:
→ Fix task C
→ Start task D
```

Completed tasks auto-update milestone completion percentage.

---

## Screens (V1)

| Surface | Contents |
|---|---|
| Home | Left sidebar (project list) + main (today's 4 tasks + session) + deadline alerts |
| Project Detail | Project info + milestones + inline tasks + session history |
| Session Log | Modal popup triggered by "Finish Session" |

### Sidebar (project list)
- Project name
- Milestone count
- Status (active / inactive)
- Roadmap progress bar
- Click → dropdown: change status / go to project details

### Calendar
- Read-only in V1
- Today highlighted
- Days with deadline tasks marked
- Click date → shows deadlines for that day
- Planned sessions visible from M10 onwards

---

## Design

**Direction:** Professional developer workspace. Quiet, focused, precise.
**References (in spirit):** Linear, Obsidian, VS Code, GitHub

### What to avoid
- Military/tactical styling — belongs in STANDBY, not here
- AI startup dashboard — no glassmorphism, gradients, neon, floating cards, KPI blocks
- Terminal roleplay — no fake console effects, no monospace everywhere

### Colors (finalized — 60-30-10 rule)
- **60% — Base:** near-black with slight warmth — `#0F0F0F` to `#141414`
- **30% — Surface:** cards, sidebar, panels — `#1C1C1C` to `#202020`
- **10% — Accent:** muted blue-gray — approx. `#7B9AB2`
- **Text:** near-white `#E8E6E1` or `#EFEFED` — not part of the ratio, always readable

Accent appears on: active project indicator, progress bars, current milestone highlight, interactive elements (buttons, ticked checkboxes), Finish Session button.
No teal. No gradients. No neon. Typography and text carry the visual weight.

### Typography
- **Primary font: Space Grotesk**
- Monospace: selectively — session logs, dates, version numbers, technical metadata only

### Visual treatment
- Small/medium border radius
- Subtle borders, minimal shadows
- Progress bars over analytics
- Information attracts attention only when it matters

---

## V1 Scope

**In:**
- Projects CRUD + set active
- Milestones CRUD + ordered
- Tasks CRUD + ordered within milestones
- Home view: today's 4 tasks + deadline alerts
- Session log modal
- Milestone % auto-updates on task completion
- Project completion detection

**Out (later versions):**
- Supabase auth + sync
- Session types (short/medium/long)
- Backlog
- Calendar interaction
- Multi-project home aggregation
- Important dates as dedicated object

---

## Roadmap

### V1 — Core App (IndexedDB, local)
- M1: Project foundation — folder structure, PWA manifest, IndexedDB schema, design tokens
- M2: Projects & milestones — CRUD, ordering, active milestone logic, project detail page
- M3: Tasks — CRUD, ordering, milestone % auto-update, project completion detection, auto-advance logic
- M4: Home command center — sidebar, today's 4 tasks, deadline alerts, Finish Session button
- M5: Session log — modal, auto-filled completed tasks, notes, next session plan, session history
- M6: Polish & PWA — full design pass, mobile layout, installable PWA, edge cases

### V2 — Auth & Sync
- M7: Supabase integration — user auth, cloud schema, data sync
- M8: Migration & stability — local → cloud migration, offline-first conflict handling

### V3 — Enhanced Features
- M9: Calendar & dates — read-only calendar on home, important dates object, deadline visibility
- M10: Session intelligence — session types (small/mid/big), next session planning (pick date + type after Finish Session → generates suggested task list → saved as planned session → visible on calendar), mid-session milestone advance, backlog per project

### V4 — Integrations
- M11: iCal feed — Cloudflare Pages Function serving `.ics` with all Important Dates + Planned Sessions. Token-based URL, Zero Trust bypass, works with any calendar app. ✓

### V5 — Structure
- Versions layer — Project → Versions → Milestones → Tasks. IDB v4, new `versions` store + `versionId` index on milestones. Supabase `versions` table. Completion chain: task → milestone → version → project. ✓

### V6 — Multi-user
- M12: Supabase Auth — user accounts, per-user RLS enforcement. Required only if opening to other users. Schema already designed with RLS in mind.

---

## Backlogged Features

- Per-task / per-milestone due dates — deferred from M9; add when calendar usage patterns are clearer.

---

## Status

**M1–M11 + Versions layer + Roadmap import + UX fixes complete** (as of 2026-06-25). V1–V5 done. App live on Cloudflare Pages with Supabase sync, offline queue, calendar, iCal feed, session workflow, Versions layer, and roadmap import utility. SW at `pm-journal-v12`.

**2026-07-21:** Mobile scaling + real PWA icon assets added (192/512/maskable/apple-touch, manifest + sw.js updated). See changelog.

**2026-07-22:** Cloudflare Zero Trust bypass policy added for the icon/manifest static asset paths (`/icons/*`, `/manifest.json`), same fix category as the existing `/api/calendar` bypass from M11. Confirmed working — PWA icon now shows on mobile.

Next focus after that: real-world usage and V6 (Supabase Auth) when ready to open to other users.
