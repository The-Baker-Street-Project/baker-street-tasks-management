# Baker Street Tasks — Handoff Document

## Project Summary

Baker Street Tasks is an AI-first to-do app built as a pnpm monorepo with three packages:

- **`packages/db`** — Drizzle ORM schema, migrations, and seed script (Postgres 17)
- **`packages/mcp-server`** — Express 5 MCP server (34 tools, Streamable HTTP transport)
- **`apps/web`** — Next.js 15 App Router frontend (React 19, Tailwind 4, shadcn/ui)

Local development runs via Docker (Postgres) + `pnpm dev`.

## What Was Done

### Session: 2026-02-12

Two glaring bugs were identified by visually inspecting the running app at `localhost:3000` and fixed in commit `b29748a`:

#### 1. Sidebar overlapping main content

**Symptom:** The fixed sidebar rendered directly on top of the dashboard and all page content instead of sitting beside it. Text from the sidebar nav and dashboard cards were jumbled together.

**Root cause:** The shadcn sidebar component (`apps/web/src/components/ui/sidebar.tsx`) used bare CSS variable references in Tailwind arbitrary values — e.g., `w-[--sidebar-width]`. In Tailwind 4, this syntax produces no CSS output. The spacer div that reserves horizontal space for the fixed sidebar collapsed to `0px` width, so main content filled the full viewport behind the sidebar.

**Fix:** Replaced all bare CSS variable references with explicit `var()` wrapping:
- `w-[--sidebar-width]` → `w-[var(--sidebar-width)]`
- `w-[--sidebar-width-icon]` → `w-[var(--sidebar-width-icon)]`
- `max-w-[--skeleton-width]` → `max-w-[var(--skeleton-width)]`

7 occurrences across the file.

#### 2. Duplicate saved views on Tasks page

**Symptom:** The Tasks page sidebar showed "All Tasks" 4 times, "Inbox" 3 times, and "Active" 4 times instead of one each.

**Root cause:** The seed script (`packages/db/src/seed.ts`) used `.onConflictDoNothing()` which only checks the primary key — an auto-generated UUID. Every seed run inserted fresh duplicates since UUIDs never conflict.

**Fix:** Made the seed idempotent by deleting existing system views (`is_system = true`) before re-inserting. Re-ran the seed to clean up the database.

## Current State

- All pages render correctly: Dashboard, Tasks, Captures, Kanban, Search, Settings
- Sidebar layout works properly on desktop (fixed sidebar with spacer)
- Saved views show the correct 3 system views (All Tasks, Inbox, Active)
- 2 sample tasks exist: "Test task from MCP" (High) and "Ship v1 release" (Urgent)
- 1 sample capture exists: "Research vacation spots"
- No tags have been created yet
- No auth (single API key for MCP, as designed for v1)

## What's Next (Potential)

These are observations from browsing the codebase — not confirmed priorities:

- **Mobile responsiveness** — The sidebar uses a Sheet overlay on mobile and a bottom nav bar, but these haven't been thoroughly tested
- **Task detail panel** — The right-side detail panel exists but wasn't exercised during this session
- **View filtering** — Clicking saved views (Inbox, Active) doesn't visibly re-filter the task list; the `refreshTasks` callback may need wiring to the view query param
- **Context toggle** — The All/Home/Work toggle in the sidebar header is present but its filtering behavior wasn't verified
- **Tailwind 4 audit** — Other shadcn components may have the same bare CSS variable issue (`[--some-var]` instead of `[var(--some-var)]`); worth a project-wide grep for `\[--` in class strings
- **Unique constraint on saved_views** — The seed is now idempotent, but a DB-level unique constraint on `(name, type)` for system views would prevent duplicates structurally
