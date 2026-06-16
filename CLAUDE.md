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
├─ Milestones (ordered)
│  └─ Tasks (ordered within milestone)
├─ Session History
├─ Important Dates (later)
└─ Backlog (later)
```

No standalone tasks, milestones, or sessions outside a project context.

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
- Interactive session planning: V2+

---

## Design

**Direction:** Professional developer workspace. Quiet, focused, precise.
**References (in spirit):** Linear, Obsidian, VS Code, GitHub

### What to avoid
- Military/tactical styling — belongs in STANDBY, not here
- AI startup dashboard — no glassmorphism, gradients, neon, floating cards, KPI blocks
- Terminal roleplay — no fake console effects, no monospace everywhere

### Colors
- Background: dark charcoal / dark gray (not pure black)
- Cards: slightly lighter than background, subtle separation
- Text: off-white
- Accent: one color only — muted blue, teal, or amber (TBD)

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

## Status

Planning complete. Data model detail and component breakdown to be done at start of dev session.
