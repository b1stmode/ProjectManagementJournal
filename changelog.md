# Changelog

## 2026-06-16 — Session 1

### M1 — Project Foundation ✓

**Files created:**
- `index.html` — single-page shell, PWA meta tags, manifest link, SW registration
- `manifest.json` — PWA manifest (name, display: standalone, theme_color)
- `sw.js` — service worker skeleton (install/activate/fetch, no caching yet)
- `icons/icon.svg` — minimal SVG icon (placeholder for proper PNG icons in M6)
- `css/tokens.css` — full CSS custom property system (backgrounds, text, accent, spacing, radius, typography)
- `css/base.css` — reset, body styles, Space Grotesk + JetBrains Mono via Google Fonts
- `js/db.js` — complete IndexedDB schema (4 stores: projects, milestones, tasks, sessions) + full CRUD layer for all stores
- `js/router.js` — hash-based router with `:param` segment support
- `js/app.js` — boot sequence: initDB → defineRoutes → initRouter
- `js/views/home.js` — placeholder (M4)
- `js/views/project.js` — placeholder (replaced in M2)

**DB schema established:**
- `projects` — id, name, description, status, lastSessionAt, createdAt
- `milestones` — id, projectId, name, description, order, isComplete, completedAt, createdAt
- `tasks` — id, milestoneId, projectId, name, description, order, isComplete, completedAt, dueDate, createdAt
- `sessions` — id, projectId, completedTaskIds, notDoneTasks, notes, nextSessionPlan, finishedAt

**Design note:** M1 tokens used a teal accent (#4ecdc4) as a placeholder. Design was finalized during M2 planning — corrected in M2.

---

### M2 — Projects & Milestones ✓

**Files created:**
- `css/components/modal.css` — modal overlay, form fields, actions
- `css/components/projects.css` — project list, project cards, status badges
- `css/components/project-detail.css` — project header, milestone list, milestone items, reorder controls
- `js/utils/milestones.js` — `getActiveMilestone()`, `getMilestoneProgress()` stub
- `js/utils/modal.js` — `openModal()` / `closeModal()`, Escape key support, click-outside dismiss
- `js/views/projects.js` — full projects list view with CRUD, Set Active, delete
- `js/views/project.js` — full project detail view with milestone CRUD and reordering

**Files modified:**
- `css/tokens.css` — applied finalized 60-30-10 color system (see below)
- `css/base.css` — added shared `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-icon` styles
- `js/app.js` — added `/projects` and `/project/:id` routes; `/` redirects to `/projects`
- `index.html` — linked component CSS files

**Finalized color system (60-30-10):**
- Base (60%): `#141414`
- Surface (30%): `#1C1C1C`
- Elevated: `#202020`
- Accent (10%): `#7B9AB2` (muted blue-gray)
- Text primary: `#E8E6E1`
- No teal, no gradients, no neon

**Features working:**
- Create / delete projects
- Set a project as active (mutual exclusion — previous active goes inactive)
- Navigate into project detail
- Add / edit / delete milestones
- Reorder milestones with ↑↓ buttons (order persists in IndexedDB)
- Active milestone auto-detected (first incomplete by order), shown with badge and accent border
- Modal system shared across both views
- Cascade delete: removing a project removes all its milestones, tasks, and sessions

---

## 2026-06-20 — Session 2

### M3 — Tasks ✓

**Files created:**
- `css/components/tasks.css` — task list, task items, checkbox button, progress bar, reorder controls, "+ Add Task" button

**Files modified:**
- `js/db.js` — added `getMilestone(id)` and `getTask(id)` single-record lookups
- `js/utils/milestones.js` — implemented `getMilestoneProgress()` stub (was returning zeros)
- `js/views/project.js` — full task CRUD + reordering; completion logic chain; replaced milestone placeholder
- `index.html` — linked `tasks.css`

**Features working:**
- Add / edit / delete tasks within milestones
- Reorder tasks with ↑↓ buttons
- Task completion toggle (checkbox button, not `<input type="checkbox">` — keeps event model consistent)
- Milestone auto-completes when all its tasks are done; reverts if a task is unchecked
- Project status auto-sets to `complete` when all milestones done; reverts to `inactive` if a task is unchecked
- Progress bar per milestone (X/Y tasks count + thin accent bar)
- Completed tasks stay visible with strikethrough and filled checkbox

---

### M4 — Home Command Center ✓

**Files created:**
- `css/components/home.css` — two-column grid layout (260px sidebar + fluid main), sidebar item styles, main sections, Finish Session button

**Files modified:**
- `js/utils/milestones.js` — added `checkMilestoneCompletion()` and `checkProjectCompletion()` as shared exports (extracted from project.js)
- `js/views/project.js` — removed private completion functions; imports them from milestones.js; back link changed from `#/projects` → `#/` ("← Home")
- `js/views/home.js` — full implementation (sidebar + main area + task toggle + new project modal)
- `js/app.js` — `'/'` route now calls `renderHome` instead of redirecting to `/projects`; added `renderHome` import
- `index.html` — linked `home.css`

**Features working:**
- Home screen is the entry point (`/`)
- Sidebar shows all projects sorted (active first, then inactive, then complete) with name, status badge, milestone progress bar
- Clicking a sidebar project navigates to its project detail page
- "+ New" button in sidebar opens create project modal
- Main area shows active project name + active milestone name
- All tasks from the active milestone are listed (completed tasks stay visible with strikethrough — same behavior as project view)
- Toggling a task from home triggers the full completion chain (milestone auto-complete → project auto-complete)
- Deadline Alerts section present as empty-state stub (wired in M9)
- Finish Session button rendered and styled; click is a no-op stub (wired in M5)

**Key decisions:**
- Sidebar dropdown ("change status / go to project detail") deferred to M6 — clicking a project navigates directly
- Home shows ALL tasks in the active milestone, not just the next 4 (changed during implementation based on UX feedback)
- Sidebar progress bar reuses `.milestone-progress-bar-*` classes from `tasks.css` — no duplication

---

### M6 — V1 Polish & PWA ✓

**Files modified:**
- `sw.js` — full rewrite: precache list of all static assets on install; cache-first for assets; network-first for navigation; separate font cache for Google Fonts (fonts.googleapis.com + fonts.gstatic.com); stale cache cleanup on activate
- `manifest.json` — fixed invalid `"purpose": "any maskable"` (split into two entries); removed `"orientation": "portrait-primary"` (broke desktop PWA); added `id`, `lang`, `scope`, `categories`; corrected `theme_color`/`background_color` to `#141414`
- `js/utils/modal.js` — added optional 5th `confirmClass` param to `openModal` (default `'btn-primary'`); added `openConfirmModal(message, onConfirm)` — wraps `openModal` with danger styling
- `js/views/project.js` — replaced 2× `window.confirm()` with `openConfirmModal`; added `openConfirmModal` import
- `js/views/projects.js` — replaced 1× `window.confirm()` with `openConfirmModal`; added `openConfirmModal` import
- `css/components/home.css` — added `.home-no-active-title`, `.mobile-projects-link` (hidden on desktop, visible ≤640px), responsive breakpoint at 640px: single-column layout, sidebar hidden, padding reduced
- `css/components/tasks.css` — added `@media (hover: none)` to always show task actions on touch; added `@media (max-width: 640px)` to wrap task items and force actions visible
- `css/components/project-detail.css` — added `@media (max-width: 640px)`: reduced padding, milestone items wrap, milestone actions move to full-width row with top border
- `css/components/modal.css` — added `@media (max-width: 480px)`: reduced padding, stacked full-width buttons; added `@supports` safe-area-inset for iOS home indicator
- `js/views/home.js` — removed hardcoded "Deadline Alerts" section (M9 feature, looked broken as a stub); improved `renderMainEmpty()` with title + styled text; added `mobile-projects-link` to both active and empty main states

**Features working:**
- App loads offline after first visit (all assets cached by service worker)
- Google Fonts cached on first load, served from cache on repeat visits
- Manifest passes Chrome PWA audit (installable on desktop)
- Home view is single-column on mobile (≤640px); sidebar hidden; "← All Projects" link visible
- Task action buttons (Edit/Delete) always visible on touch devices
- Milestone items stack vertically on narrow screens; action buttons move to bottom row
- Modal buttons stack full-width on very narrow screens; safe-area inset respected on iPhone
- Deleting a project/milestone/task shows a styled in-app confirmation modal (not browser dialog)
- No fake "Deadline Alerts" section on home screen

**Key decisions:**
- PNG icons deferred — SVG is sufficient for desktop Chrome installability; PNG requires image asset creation outside this codebase
- Deadline Alerts removed entirely rather than left as a stub — comes back in M9 with real logic
- `@media (hover: none)` used for touch task actions rather than `max-width` — correctly targets iPads in landscape

---

### M5 — Session Log ✓

**Files created:**
- `css/components/sessions.css` — session modal styles + session history entry styles

**Files modified:**
- `js/views/home.js` — Finish Session button wired; `openSessionModal()` implemented; added `updateProject`, `getTasksForProject`, `createSession` imports; `formatDate` helper
- `js/views/project.js` — Sessions section added to `renderProject()` HTML; `renderSessions()`, `renderSessionEntry()`, `formatDate()` functions added; `getSessionsForProject` import added
- `index.html` — linked `sessions.css`
- `roadmap.md` — M5 marked ✓

**Features working:**
- Clicking "Finish Session" opens a session log modal (600px wide, custom overlay — wider than the standard 480px modal)
- Modal auto-fills completed tasks: tasks where `completedAt > project.lastSessionAt` across the whole project (catches tasks from any milestone completed that session)
- Modal auto-fills "Not Done": incomplete tasks from the current active milestone only
- Notes and Next Session plan are free-text fields
- Save Session: calls `createSession()`, updates `project.lastSessionAt`, closes modal, re-renders home
- Cancel / Escape / backdrop click — close without saving
- Project detail page shows Session History section below milestones, newest-first
- Session entries display: date (monospace), completed task names (looked up from IDs; "(deleted task)" fallback), not done list, notes, next session plan
- Empty state: "No sessions recorded yet."
- Sessions already cascade-delete with project (schema established in M1)

**Key decisions:**
- Custom session modal overlay instead of `openModal()` — session log needs 600px width and a more structured read-only/editable layout that doesn't fit the generic title/body/confirm pattern
- Task names in session history resolved via `getTask(id)` at render time, not stored in the session record — avoids schema change; acceptable at V1 scale; deleted tasks show "(deleted task)"
- Not-done tasks stored as newline-separated text string in `session.notDoneTasks` (matches existing `createSession` schema)

**Bug fix (same session):**
- Not Done section in the session modal was incorrectly showing the *next* milestone's tasks when the previous milestone auto-completed during the session (checking the last task → milestone marks complete → active pointer advances → Finish Session captured the new `activeMilestone`)
- Fix: "not done" is now derived from milestones where completed tasks actually originated this session (`workedMilestoneIds`), not from the current active milestone. If all tasks in a worked milestone were completed, not-done is empty (section hidden). Falls back to current active milestone only when no tasks were completed at all (empty session).

---

### Post-M6 — Mobile sidebar overlay (UX fix)

**Files modified:**
- `css/components/home.css` — replaced `display: none` on `.home-sidebar` with fixed-position slide-in overlay (`position: fixed`, `transform: translateX(-100%)`, `transition`); added `.home-sidebar.is-open` (visible state); added `.sidebar-backdrop` and `.sidebar-backdrop.is-active`; added `.mobile-sidebar-btn` trigger; removed `.mobile-projects-link`
- `js/views/home.js` — replaced `mobile-projects-link` anchor with `mobile-sidebar-btn` button in `renderMainActive()` and `renderMainEmpty()`; added sidebar open/close logic (backdrop appended inside `.home-view` so it auto-cleans on re-render; Escape key + backdrop click + project click all close it)

**Problem:** M6's `display: none` approach hid the sidebar but left the main content area cramped on mobile — task names wrapping to one word per line because `.home-main-inner` padding + font size left very little readable width.

**Fix:** Sidebar is now a slide-in overlay (`width: min(280px, 85vw)`, z-index 50). Main content fills the full screen width by default. A "Projects" button (visible only at ≤640px) opens the overlay. Backdrop covers the rest of the screen and dismisses on tap. Desktop layout is unchanged.

**Key decision:** Backdrop appended to `.home-view` instead of `document.body` — automatically destroyed when `app.innerHTML` is replaced on any navigation or re-render, no manual cleanup needed.

---

## 2026-06-20 — Session 3

### M7 — Supabase Database + Sync ✓

**Files created:**
- `js/config.js` — Supabase project URL + anon public key (committed; anon key is designed to be public, security enforced by RLS)
- `js/supabase.js` — Supabase client via CDN ESM import (`@supabase/supabase-js@2`)
- `js/sync.js` — full sync layer: `syncRecord`, `deleteRecord`, `syncUp`, `syncDown`, `firstTimeSync`; camelCase↔snake_case field mapping helpers

**Files modified:**
- `js/db.js` — added `import { syncRecord, deleteRecord } from './sync.js'`; all 10 mutation functions now fire-and-forget sync after each successful IDB write
- `js/app.js` — added `import { firstTimeSync } from './sync.js'`; `firstTimeSync()` called in boot sequence after `initDB()`
- `sw.js` — added `config.js`, `supabase.js`, `sync.js` to PRECACHE_URLS

**Supabase setup (manual, one-time):**
- 4 tables created: `projects`, `milestones`, `tasks`, `sessions` — bigint PKs, client-provided (no Supabase sequences), FK CASCADE on deletes, Unix ms timestamps as bigint
- RLS enabled on all tables with open `USING (true)` policies — locked down in M12 when Supabase Auth is added
- Hosted region: West EU (Ireland)

**Architecture decisions:**
- **ID strategy:** IDB autoIncrement integers used as-is in Supabase (client provides the value). Works because single-user sequential use means no ID collisions. IDB spec guarantees key generator advances past any ID provided via `put()`, so pulling Supabase data into a fresh IDB works correctly.
- **Write-through (fire and forget):** Sync calls have no `await` — IDB write returns immediately to the caller; Supabase call runs in background. Failures logged to console but silently swallowed. No retry queue (M8).
- **firstTimeSync logic:** On load, checks both sides — Supabase empty + IDB has data → `syncUp` (push existing local data to cloud); IDB empty + Supabase has data → `syncDown` (pull cloud data into fresh IDB); both have data → trust local (M8 handles conflicts).
- **Circular import avoided:** `sync.js` uses dynamic `await import('./db.js')` inside async functions rather than a static top-level import. `db.js` imports `sync.js` statically. No initialization-order issues.
- **config.js committed:** No build step means CF Pages can't inject env vars — file must exist in repo. Anon keys are public by Supabase design.
- **Offline:** `navigator.onLine` guard on all Supabase calls — app continues to work offline, sync simply skipped.

---

### M8 — Migration & Stability ✓

**Files modified:**
- `js/sync.js` — full rewrite: offline queue added, `syncRecord`/`deleteRecord` now enqueue on failure, new `flushQueue` export, `syncDown` updated to handle cross-device deletions, `firstTimeSync` updated to always flush+pull
- `js/app.js` — added `flushQueue` import; `window.addEventListener('online', () => flushQueue())` wired after boot

**Features working:**
- Offline queue: any create/update/delete made while offline is serialized to `localStorage` under `'pm-sync-queue'` and replayed when connectivity returns
- `flushQueue()` fires automatically on the `online` event (browser restores connection) and on app load (catches queue from previous sessions)
- `syncDown()` now diffs local IDB keys against Supabase keys and deletes local records that no longer exist in Supabase — handles deletions made on another device
- `firstTimeSync` always calls `flushQueue()` first, then pulls from Supabase if Supabase has any data (replaces the M7 "trust local" no-op for the "both have data" case)

**Architecture decisions:**
- Queue stored in `localStorage` as JSON array — simple, survives browser restarts, no extra IDB store needed
- `syncDown` uses two-phase approach: readonly IDB transaction to collect local keys, then async Supabase fetch, then readwrite transaction to upsert + delete. This avoids the IDB restriction that transactions auto-close when the call stack goes idle.
- Failed queue entries are kept and retried next time — no data loss on persistent errors
- Conflict resolution: last-write-wins at the Supabase level. For a single-user personal tool with sequential device use, this is acceptable. True conflict resolution deferred indefinitely (not planned until V5+).
