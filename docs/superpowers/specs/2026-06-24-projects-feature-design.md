# Projects Feature — Design Spec

**Date:** 2026-06-24
**Branch:** `bak-139-pglite-to-sqlite` (or a feature branch off it)
**Status:** Approved design, ready for implementation planning

## Goal

Add a first-class **Projects** feature so tasks can be classified by initiative
(e.g. "3D Printing / Bracket"). Projects are grouped under **Areas**, giving a
two-level hierarchy. Tasks attach to projects many-to-many, exactly like tags,
but projects are distinguished by their Area parent, project metadata
(status/color/description), a progress rollup, and a dedicated detail page.

## Locked Requirements

- **Structure:** two-level **Area → Project**. Areas contain Projects; tasks
  attach to Projects (not Areas).
- **Task ↔ Project:** many-to-many via a `task_projects` join table (twin of
  `task_tags`). Overlap with tags is accepted and intentional.
- **Project fields:** `status` (Active/Archived), `color`, `description`,
  derived **progress rollup** (computed in-query, not stored).
- **UI surfaces (all four):** sidebar nav (Areas→Projects, click filters task
  list), project detail page, task-detail project picker, kanban swimlanes by
  project.
- **MCP:** full CRUD + assign/unassign.

---

## Section 1 — Data Model (APPROVED)

Three new tables, mirroring `tags`/`task_tags`, plus enum additions. All new
tables follow existing schema conventions: `text` UUID PK via
`crypto.randomUUID()`, ISO-8601 string timestamps via `$defaultFn`.

### `areas` (`packages/db/src/schema/areas.ts`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | `crypto.randomUUID()` |
| `name` | text not null | **unique globally** (`uniqueIndex`) |
| `color` | text nullable | hex |
| `status` | text `$type<EntityStatus>` not null default `"Active"` | Active / Archived |
| `orderIndex` | text not null | fractional index, for sidebar ordering |
| AI metadata | `createdBy`, `agentId`, `requestId`, `reason` | mirror `tasks` |
| `createdAt` / `updatedAt` | text not null | ISO-8601 |

### `projects` (`packages/db/src/schema/projects.ts`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | `crypto.randomUUID()` |
| `areaId` | text **nullable** | FK → `areas.id`, `onDelete: "set null"`; null = "No Area" bucket |
| `name` | text not null | **unique within area** (composite unique index on `(areaId, name)`) |
| `description` | text nullable | |
| `color` | text nullable | hex |
| `status` | text `$type<EntityStatus>` not null default `"Active"` | Active / Archived |
| `orderIndex` | text not null | fractional index |
| AI metadata | `createdBy`, `agentId`, `requestId`, `reason` | mirror `tasks` |
| `createdAt` / `updatedAt` | text not null | ISO-8601 |

### `task_projects` (in `packages/db/src/schema/projects.ts`)

| Column | Type | Notes |
|--------|------|-------|
| `taskId` | text not null | FK → `tasks.id`, `onDelete: "cascade"` |
| `projectId` | text not null | FK → `projects.id`, `onDelete: "cascade"` |

`uniqueIndex` on `(taskId, projectId)`. Twin of `task_tags`.

### Enum additions (`packages/db/src/schema/enums.ts`)

- Add `"area"` and `"project"` to `entityTypeValues` (for audit logging).
- Add a new status enum for areas/projects:
  ```ts
  export const entityStatusValues = ["Active", "Archived"] as const;
  export type EntityStatus = (typeof entityStatusValues)[number];
  ```

### Relations (`packages/db/src/schema/relations.ts`)

- `areasRelations`: `many(projects)`.
- `projectsRelations`: `one(area)`, `many(taskProjects)`.
- `taskProjectsRelations`: `one(task)`, `one(project)`.
- Extend `tasksRelations` with `taskProjects: many(taskProjects)`.

### Schema barrel + migration

- Export new files from `packages/db/src/schema/index.ts`.
- Generate a new Drizzle SQLite migration (`drizzle-kit generate`).

### Approved decisions

- `areaId` nullable → ungrouped projects fall into a "No Area" bucket.
- **Soft delete via status only.** Archiving an Area hides it and its projects
  but keeps all `task_projects` links. No hard delete in v1.
- Project name unique **within area**; area name unique **globally**.
- **Progress = done ÷ non-archived linked tasks**, computed in-query (no stored
  column). 0 linked tasks → render "no tasks" (avoid div-by-zero).
- **Projects are NOT in global FTS in v1** (follow-up item).

---

## Section 2 — Queries / Server Actions / UI Data Flow (APPROVED)

### Query helpers (`packages/db/src/queries/projects.ts`)

- `listAreasWithProjects(db)` → areas (ordered by `orderIndex`) each with their
  non-archived projects nested; includes a synthetic "No Area" bucket for
  `areaId IS NULL` projects. Powers the sidebar tree.
- `getProjectWithProgress(db, projectId)` → project row + progress rollup
  (`{ done, total }` over non-archived linked tasks).
- `listProjectsForTask(db, taskId)` → projects linked to a task (for the task
  detail picker).

Progress rollup is a correlated subquery counting `task_projects` joined to
`tasks`, excluding archived tasks, with a separate count of `status = "Done"`.

### Server actions (`apps/web/src/lib/api/projects.ts`, all `"use server"`, all audited)

- Area CRUD: `createArea`, `renameArea`, `archiveArea`, `listAreas`.
- Project CRUD: `createProject`, `updateProject`, `archiveProject`,
  `listProjects`.
- `setTaskProjects(taskId, projectIds[])` — diff-and-apply against existing
  links (insert added, delete removed), single audited operation. Used by the
  task-detail `ProjectPicker`.
- All actions write to `audit_log` with before/after snapshots, mirroring the
  existing tag/task server actions.

### Client data flow

- TanStack Query keys: `['projects','tree']` (sidebar) and `['projects', id]`
  (detail page). 60s stale time, manual refresh, consistent with existing
  patterns.
- New nuqs URL filter param `projectId`. When set, the task list query joins on
  `task_projects` to filter tasks by project. Coexists with existing `context`
  / `tagId` / `view` params.

### UI components & routes

- **Sidebar:** Areas→Projects tree (collapsible areas, projects as clickable
  rows that set the `projectId` filter). New section in the shell sidebar.
- **Project detail page:** new route `app/(shell)/projects/[id]/page.tsx`. RSC
  fetches `getProjectWithProgress` + the project's tasks; renders a project
  metadata/progress header above the **existing `TaskList` component** (reused,
  not bespoke).
- **Task detail picker:** new `ProjectPicker` component, a copy of
  `TagSelector` adapted to projects (grouped by area). Calls `setTaskProjects`.
- **Kanban swimlanes by project:** a task linked to N projects renders as a
  **duplicate card in each project's swimlane** (one card per link), consistent
  with tag behavior. No "primary project" concept.

---

## Section 3 — MCP Tools (APPROVED)

Two new tool files following the `tags.ts` pattern exactly: `aiMetaParams`
spread, `checkIdempotency(db, request_id)` first, `logAudit` with before/after
snapshots, JSON-stringified `content` responses, `isError` for failures.

### `packages/mcp-server/src/tools/areas.ts` → `registerAreaTools`

| Tool | Params (+ aiMeta) | Behavior |
|------|-------------------|----------|
| `areas.list` | `include_projects?: boolean` | Areas ordered by `orderIndex`; nests projects when `include_projects`. |
| `areas.create` | `name`, `color?` | Name unique globally; conflict → `isError`. Audit `entityType: "area"`. |
| `areas.rename` | `area_id`, `name` | 404 if missing; uniqueness re-check. |
| `areas.archive` | `area_id` | `status = "Archived"`; hides area + projects, keeps links. No hard delete. |

### `packages/mcp-server/src/tools/projects.ts` → `registerProjectTools`

| Tool | Params (+ aiMeta) | Behavior |
|------|-------------------|----------|
| `projects.list` | `area_id?`, `include_progress?: boolean` | Filter by area (or null → "No Area"); `include_progress` adds rollup. |
| `projects.create` | `name`, `area_id?`, `description?`, `color?` | Name unique within area; conflict → `isError`. `area_id` nullable. |
| `projects.update` | `project_id`, `name?`, `area_id?`, `description?`, `color?` | Partial update; re-check uniqueness on name/area change; cross-area move allowed. |
| `projects.archive` | `project_id` | `status = "Archived"`; keeps links. |
| `tasks.assign_project` | `task_id`, `project_id` | Insert into `task_projects`; conflict on `unique(taskId, projectId)` → no-op success (idempotent). |
| `tasks.unassign_project` | `task_id`, `project_id` | Delete the join row. |

### Registration

- Add `registerAreaTools` and `registerProjectTools` to `registerAllTools` in
  `packages/mcp-server/src/tools/index.ts`.
- **Tool count: 25 → 35** (4 area + 6 project/assign).

### Approved decisions

- **Separate `tasks.assign_project` / `tasks.unassign_project`** (not a single
  diff-based `set_projects`) — explicit single-purpose tools, clean per-action
  audit entries.
- **Archive-only, no hard-delete tools** in v1 — consistent with the Section 1
  soft-delete model.

---

## Testing

Follow the existing per-package test patterns (the repo's 85-test suite).

- **db:** query helpers (`listAreasWithProjects` nesting incl. "No Area"
  bucket; `getProjectWithProgress` rollup incl. 0-task and archived-task edge
  cases); unique-constraint enforcement (area name global, project name within
  area); cascade behavior on task delete; archive preserves links.
- **mcp-server:** each tool — happy path, idempotency replay (`request_id`),
  conflict/404 errors, audit-log entry written, assign/unassign idempotent
  no-op on duplicate.
- **web:** `setTaskProjects` diff-and-apply (add/remove/no-change); `projectId`
  filter joins correctly; project detail page renders header + `TaskList`.

## Out of Scope (v1 follow-ups)

- Projects in global FTS search.
- Hard-delete / purge tools.
- "Primary project" concept for kanban de-duplication.
- Drag-and-drop reordering of areas/projects in the sidebar (orderIndex column
  exists to enable this later).
