# Project Management Journal

A project-management workspace designed to make it immediately clear **what to work on next** while keeping the bigger picture of a project visible.

PM Journal was originally built to solve a personal project-management problem: when working on multiple software projects at once, a traditional task list can tell you *what exists*, but not necessarily *what matters right now*. The journal combines project structure, milestones, tasks, planning, and work-session tracking into one workflow.

## Features

* **Project management** — Organize work across multiple projects.
* **Version-based planning** — Break projects into versions and milestones instead of treating everything as one large task list.
* **Task management** — Track individual pieces of work and their current state.
* **Session workflow** — Keep track of what was worked on and maintain continuity between sessions.
* **Calendar integration** — Plan work around scheduled time and access calendar information through the application.
* **iCal support** — Generate calendar-compatible feeds from the journal.
* **Offline support** — Continue working when a connection is unavailable and synchronize changes when connectivity returns.
* **Supabase backend** — Store and synchronize project data through Supabase.
* **Progress tracking** — Follow project and version progress without losing the underlying task structure.
* **PWA support** — Install and use the journal as a Progressive Web App.

## The Core Structure

PM Journal is organized around a hierarchy that keeps high-level goals connected to actual work:

```text
Project
└── Version
    └── Milestone
        └── Task
```

This structure is complemented by work-session history and planning features.

The goal isn't to create another giant task database. The goal is to maintain enough structure that opening the application answers a simple question:

> **What should I work on next?**

## Why I Built It

PM Journal started as a solution to my own project-management problem.

I work on multiple software projects simultaneously, and over time it became increasingly difficult to keep track of where each project stood, what I had already completed, and what the next meaningful step was.

Instead of adapting my workflow to an existing project-management platform, I built a system around the way I actually work.

The project has therefore evolved alongside my own workflow, with features being added when they solve a real problem rather than simply because they are common in other productivity tools.

## Tech Stack

* **HTML**
* **CSS**
* **JavaScript**
* **Supabase**
* **Cloudflare Workers / Functions**
* **Progressive Web App APIs**
* **iCal / calendar integration**

The application is primarily built with vanilla web technologies rather than a large frontend framework. This keeps the project relatively lightweight and makes the underlying application logic explicit.

## Project Status

PM Journal is currently in **active development** and is **not yet publicly accessible**.

The application is currently deployed behind an access-control layer, allowing only authorized users to reach the application. Authentication is currently handled at the infrastructure level, with authorized users subsequently connecting to the project's Supabase backend without requiring a separate application login.

This is a temporary deployment model while the application is being prepared for public release.

### Public Release

The next major step is to remove the external access barrier and introduce **application-level authentication**, including a dedicated sign-in/sign-up flow.

This will allow PM Journal to operate as a publicly accessible application rather than a privately hosted personal tool.

The public release is also an important dependency for another productivity application being developed alongside PM Journal.

Both applications are intended to share the same Supabase database and work as connected parts of a broader planning and productivity system:

```text
                    ┌─────────────────┐
                    │   Supabase DB   │
                    │                 │
                    │ Shared backend  │
                    └────────┬────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
          ┌───────▼────────┐   ┌────────▼────────┐
          │   PM Journal   │   │  Productivity   │
          │                │   │   Application   │
          │ Project source │   │ Planning,       │
          │ of truth       │   │ scheduling, and │
          │                │   │ organization    │
          └────────────────┘   └─────────────────┘
```

PM Journal therefore serves as the foundation for a larger project-management and planning workflow rather than existing as an isolated application.

## Development

The application is developed and tested locally before being deployed to the private production environment.

Because the current deployment relies on protected infrastructure and project-specific Supabase configuration, **public users cannot currently run or access the complete application simply by cloning the repository**.

Once public authentication and deployment are implemented, the setup instructions will be expanded to document the complete development and deployment process.

For the project's development history, see [`changelog.md`](./changelog.md).

Planned and potential future work is tracked in [`roadmap.md`](./roadmap.md).

## Project Structure

```text
.
├── css/                 # Application styles
├── functions/           # Server-side / API functionality
│   └── api/
│       └── calendar/
├── icons/               # PWA and application icons
├── js/                  # Application JavaScript
├── index.html           # Main application entry point
├── manifest.json        # PWA manifest
├── sw.js                # Service worker
├── changelog.md         # Development history
├── roadmap.md           # Planned development
└── LICENSE              # MIT License
```

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE) for details.

---

Built as a practical project-management system for managing real software projects and the work that goes into them.
