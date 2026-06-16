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
