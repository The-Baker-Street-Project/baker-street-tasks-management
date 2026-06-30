# Baker Street Tasks — Handoff Document

## Project Summary

Baker Street Tasks is an AI-first to-do app built as a pnpm monorepo with three packages:

- **`packages/db`** — Drizzle ORM schema, migrations, and seed script (SQLite via better-sqlite3)
- **`packages/mcp-server`** — Express 5 MCP server (25 tools, Streamable HTTP transport)
- **`apps/web`** — Next.js 15 App Router frontend (React 19, Tailwind 4, shadcn/ui)

Local development runs via `pnpm dev` — no external database container required (SQLite is in-process).

## Active Work — RESUME HERE (2026-06-30)

No work in progress. Branch `main` is clean and fully merged through **PR #4** (`d0990c4`). The two big efforts that were mid-flight in the previous handoff — the PGlite→SQLite migration and the Projects feature — have both shipped.

### Shipped: PGlite → SQLite migration (PRs #3, #4)

Persistence layer is now **better-sqlite3** (in-process, WAL, `foreign_keys = ON`), full-text search via the FTS5 `tasks_fts` virtual table + sync triggers, real-time events reduced to a heartbeat-only SSE stream (NATS carries change propagation at the extension layer). See "What Was Done → 2026-06-23" below for the file-level detail.

### Shipped: Projects feature — Area → Project hierarchy (PR #4)

Two-level **Area → Project** classification, tasks attach to projects many-to-many. All as designed in the prior brainstorm:

- **Schema** (`packages/db/src/schema/`): `areas.ts`, `projects.ts` (areaId nullable), and the `task_projects` join table; `"area"`/`"project"` added to the `entityType` enum.
- **Queries** (`packages/db/src/queries/projects.ts`): area/project tree + in-query progress rollup (done ÷ non-archived linked tasks).
- **Server actions** (`apps/web/src/lib/api/projects.ts`): area + project CRUD and task-project assignment, all audited.
- **UI**: sidebar nav, project detail route `app/(shell)/projects/[id]/` (`project-detail-client.tsx`), task-detail project picker, kanban swimlanes by project.
- **MCP**: 10 new tools — `areas.{list,create,rename,archive}` and `projects.{list,create,update,archive}` + `tasks.{assign_project,unassign_project}`, each with audit logging + `request_id` idempotency. **Tool count is now 35** (was 25).

### Done: cleanup bundle (2026-06-30)

- **`db:seed:sample` script** — wired into `packages/db/package.json` (`pnpm --filter @baker-street/db db:seed:sample`).
- **`.env.example` absolute-path note** — documented why `SQLITE_DB_PATH` should be absolute for `pnpm dev`.
- **`saved_views` unique constraint** — partial unique index `saved_views_system_name_type_unique_idx` on `(name, type) WHERE is_system = 1` (migration `0002_third_quentin_quire.sql`). Prevents duplicate system views structurally; user-created views unconstrained.
- **Tailwind `[--var]` audit** — verified resolved: zero bare CSS-var occurrences remain in `apps/web/src`.

### Open follow-ups (not yet done)

- **Projects not in global FTS** — deliberately deferred from v1; add to `tasks_fts` (or a parallel index) if project search is wanted.
- **Saved-view filter wiring** — clicking Inbox/Active saved views may not visibly re-filter the task list (observation from 2026-02-12; status unconfirmed).

## What Was Done

### Session: 2026-06-23 — PGlite → better-sqlite3 migration

Migrated the persistence layer off PGlite (in-process WASM Postgres) onto **better-sqlite3** (commit `6f84de2`, branch `bak-139-pglite-to-sqlite`).

- **Client (`packages/db/src/client.ts`)** — swapped `drizzle-orm/pglite` for `drizzle-orm/better-sqlite3`. `createDb()` now opens a SQLite file and sets `journal_mode = WAL` and `foreign_keys = ON`. `getPgliteClient()` → `getSqliteClient()`.
- **Drizzle config** — `dialect: "sqlite"`; the four Postgres migrations (`0000`–`0003`, incl. search vectors, entity-change NOTIFY, captures removal) were regenerated as a single SQLite migration `0000_ancient_terrax.sql`.
- **Env var** — `PGLITE_DATA_DIR=./data/pglite` → `SQLITE_DB_PATH=./data/tasks.db` (updated in `.env.example`, `scripts/dev.sh`, `docker-compose.yml`, `k8s/configmap.yaml`, `k8s/extension.yaml`, `apps/web/server.ts`).
- **Full-text search** — Postgres `tsvector` columns replaced by an FTS5 virtual table (`tasks_fts`) with INSERT/UPDATE/DELETE sync triggers, set up by `setupFts()` in the new `packages/db/src/fts.ts`.
- **Real-time events** — Postgres `LISTEN/NOTIFY` (`pg_notify("entity_change")`) is gone. `apps/web/src/app/api/events/route.ts` is now a heartbeat-only SSE stream; NATS is the primary change-propagation mechanism at the extension layer.

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

- Branch `main`, clean tree, merged through PR #4 (`d0990c4`).
- Persistence: SQLite (better-sqlite3, WAL, FTS5). MCP server exposes **35 tools**.
- Features live: Dashboard, Tasks, Kanban, Search, Settings, and **Projects** (Area→Project hierarchy with detail pages + kanban swimlanes).
- Last activity (2026-06-25): security review of the dev seed script + build config — no findings.
- No auth (single API key for MCP, as designed for v1).

## What's Next (Potential)

These are observations from browsing the codebase — not confirmed priorities:

- **Mobile responsiveness** — The sidebar uses a Sheet overlay on mobile and a bottom nav bar, but these haven't been thoroughly tested
- **Task detail panel** — The right-side detail panel exists but wasn't exercised during this session
- **View filtering** — Clicking saved views (Inbox, Active) doesn't visibly re-filter the task list; the `refreshTasks` callback may need wiring to the view query param
- **Context toggle** — The All/Home/Work toggle in the sidebar header is present but its filtering behavior wasn't verified
- **Tailwind 4 audit** — Other shadcn components may have the same bare CSS variable issue (`[--some-var]` instead of `[var(--some-var)]`); worth a project-wide grep for `\[--` in class strings
- **Unique constraint on saved_views** — The seed is now idempotent, but a DB-level unique constraint on `(name, type)` for system views would prevent duplicates structurally
