# Baker Street Tasks — Handoff Document

## Project Summary

Baker Street Tasks is an AI-first to-do app built as a pnpm monorepo with three packages:

- **`packages/db`** — Drizzle ORM schema, migrations, and seed script (SQLite via better-sqlite3)
- **`packages/mcp-server`** — Express 5 MCP server (25 tools, Streamable HTTP transport)
- **`apps/web`** — Next.js 15 App Router frontend (React 19, Tailwind 4, shadcn/ui)

Local development runs via `pnpm dev` — no external database container required (SQLite is in-process).

## Active Work — RESUME HERE (2026-06-23)

### In progress: Projects feature brainstorm (superpowers:brainstorming)

Designing a first-class **Projects** feature so tasks can be classified like "3D Printing / Bracket". Mid-brainstorm — design approved through Section 1, Section 2 presented and awaiting two confirmations.

**Locked requirements:**
- **Structure:** two-level **Area → Project** (Areas contain Projects; tasks attach to Projects).
- **Task ↔ Project:** **many-to-many** via a join table (like tags). User accepted the overlap-with-tags; what makes a project distinct is the Area parent + project metadata + a dedicated page.
- **Project fields:** `status` (Active/Archived), `color`, `description`, derived **progress rollup**.
- **UI surfaces (all four):** sidebar nav (Areas→Projects, click filters task list), project detail page, task-detail project picker, kanban swimlanes by project.
- **MCP:** full CRUD + assign.

**Section 1 — Data model: APPROVED.** Three new tables mirroring `tags`/`task_tags`:
- `areas` — id, name, color?, status (Active/Archived), orderIndex, timestamps + AI metadata.
- `projects` — id, **areaId nullable** (ungrouped → "No Area" bucket), name, description?, color?, status, orderIndex, timestamps + AI metadata.
- `task_projects` — taskId, projectId, unique(taskId, projectId), cascade. Twin of `task_tags`.
- Add `"area"` and `"project"` to the `entityType` enum array (`packages/db/src/schema/enums.ts`).
- Approved decisions: areaId nullable; soft-delete via status only (archiving an Area hides it + its projects, keeps links); project name unique **within area**, area name unique globally; progress = done ÷ non-archived linked tasks, computed in-query (no stored column), 0 tasks → "no tasks"; **projects NOT in global FTS in v1** (follow-up).

**Section 2 — Queries / server actions / UI data flow: PRESENTED, awaiting answers to:**
1. OK that a multi-project task renders as a **duplicate card across kanban swimlanes** (one per project)?
2. OK for the **project detail page to reuse the existing `TaskList` component** (vs a bespoke layout)?

Section 2 content to carry forward: query helpers in `packages/db/src/queries/projects.ts` (`listAreasWithProjects`, `getProjectWithProgress`, `listProjectsForTask`); server actions in `apps/web/src/lib/api/projects.ts` (area + project CRUD, `setTaskProjects` diff-and-apply, all audited); TanStack Query keys `['projects','tree']` / `['projects', id]`; new nuqs `projectId` filter param joined on `task_projects`; new `ProjectPicker` (copy of `TagSelector`); new route `app/(shell)/projects/[id]/page.tsx`.

**Next steps (in order):**
1. User answers the two Section 2 confirmations above.
2. Present **Section 3 — MCP tools**: `areas.create/rename/archive/list`, `projects.create/update/archive/list`, `tasks.assign_project/unassign_project` — each with audit logging + idempotency (`request_id`). Tool count 25 → ~33. Register in `packages/mcp-server/src/tools/index.ts`.
3. Write spec to `docs/superpowers/specs/2026-06-23-projects-feature-design.md`, commit, user reviews.
4. Then invoke `superpowers:writing-plans`.

To resume: re-invoke `superpowers:brainstorming`, re-read this section, continue at Section 2 confirmations.

### Working-tree state (branch `bak-139-pglite-to-sqlite`)

- **Committed:** `fd7d323` docs: update CLAUDE.md and HANDOFF.md for SQLite migration.
- **Uncommitted, should be committed with the migration:**
  - `turbo.json` — fixed a **real migration bug**: `passThroughEnv` still listed `PGLITE_DATA_DIR` on every task, so turbo stripped `SQLITE_DB_PATH` and the MCP server crashed with *"Cannot open database because the directory does not exist."* Changed all four entries to `SQLITE_DB_PATH`.
- **Uncommitted, new (decide whether to keep/commit):**
  - `packages/db/src/seed-sample.ts` — sample-data seeder (13 tasks across all statuses, 6 tags, 5 subtasks, 3 focus, 1 overdue, 2 due-today; also calls `setupFts()` which `next dev` otherwise skips). Re-runnable; wipes tasks/tags first. Run: `cd packages/db && set -a; source ../../.env; set +a && pnpm exec tsx src/seed-sample.ts`.
- **Local `.env` (gitignored, already rewritten):** was stale from pre-migration (had `PGLITE_DATA_DIR` pointing at a non-existent `baker-street-project` path, no `SQLITE_DB_PATH`). Rewrote to an **absolute** `SQLITE_DB_PATH=/home/gary/repos/bakerst/baker-street-tasks-management/data/tasks.db` (absolute because the 3 packages run from different cwds under turbo; a relative path creates 3 separate DB files). `MCP_API_KEY` preserved.
- **DB:** `data/tasks.db` migrated + seeded (system views + 13 sample tasks). Old `data/pglite/` and a stray `packages/db/data/` were removed.
- **Dev server** was running on web **:3001** (port 3000 taken by another process) + MCP **:3100** — will stop on reboot; restart with `pnpm dev`.

**Open follow-ups (not yet done):** commit the `turbo.json` fix; optionally add a `db:seed:sample` script to `packages/db/package.json`; optionally note the absolute-path requirement in `.env.example`.

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
