# Projects Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class two-level **Area → Project** hierarchy so tasks can be classified by initiative, with many-to-many task↔project links, progress rollups, four UI surfaces, and full MCP CRUD.

**Architecture:** Three new SQLite tables (`areas`, `projects`, `task_projects`) mirroring the `tags`/`task_tags` pattern. DB query helpers compute progress in-query. Web server actions (un-audited, matching the existing `lib/api/tasks.ts` pattern) drive the UI. MCP tools (audited + idempotent, matching `tools/tags.ts`) expose CRUD to AI agents. UI reuses existing components (`TaskList`, the `TagsPanel`/sidebar patterns).

**Tech Stack:** Drizzle ORM + better-sqlite3, drizzle-kit migrations, Next.js 15 App Router (RSC + server actions), TanStack Query, nuqs, shadcn/ui, Vitest.

## Global Constraints

- **Node.js >= 20** (Tailwind 4 oxide bindings). Run `nvm use` first.
- **TypeScript strict everywhere.** No `@ts-ignore` / `eslint-disable` without justifying comment.
- **Lint + typecheck MUST pass before every commit** (Husky pre-commit hook runs `pnpm lint` then `pnpm typecheck`).
- **Canonical types** live in `apps/web/src/types/index.ts` — add `Area`/`Project` there, import via `@/types`.
- **EntityStatus values:** exactly `["Active", "Archived"]`.
- **Soft-delete only** — archive sets `status = "Archived"`; never hard-delete; archiving preserves `task_projects` links.
- **Progress = done ÷ non-archived linked tasks**, computed in-query (no stored column). `total === 0` → render "no tasks" (no div-by-zero).
- **Color** columns store hex strings, nullable.
- **orderIndex** is a `text` fractional index; new rows use `Date.now().toString(36)` (matches `createTask` in `lib/api/tasks.ts`). Drag-drop reordering is out of scope.
- **MCP tools** follow `tools/tags.ts` exactly: `aiMetaParams` spread, `checkIdempotency(db, request_id)` first, `logAudit` with before/after, JSON-stringified `content`, `isError` on failure.
- **Web server actions are NOT audited** (the existing `lib/api/tasks.ts` actions don't audit; the spec's "all audited" claim is inaccurate — see "Deviations from spec" at the bottom).

---

## Deviations from spec (read before starting)

1. **Server actions un-audited.** Spec Section 2 says server actions are "all audited, mirroring the existing tag/task server actions." The existing web server actions (`apps/web/src/lib/api/tasks.ts`) do **not** write to `audit_log` — audit is the MCP/AI surface only. This plan follows the real codebase pattern (un-audited web actions). MCP tools remain fully audited per Section 3. If audited web actions are actually wanted, that is a separate enhancement.
2. **"No Area" duplicate names.** SQLite treats NULLs as distinct in unique indexes, so the `(areaId, name)` unique index does **not** prevent two `areaId IS NULL` projects sharing a name. The MCP/server-action create path adds an explicit application-level pre-check for the null bucket to honor "unique within area." Acceptable either way for v1.

---

## File Structure

**Create:**
- `packages/db/src/schema/areas.ts` — `areas` table.
- `packages/db/src/schema/projects.ts` — `projects` + `task_projects` tables.
- `packages/db/src/queries/projects.ts` — `listAreasWithProjects`, `getProjectWithProgress`, `listProjectsForTask`.
- `packages/db/src/__tests__/queries/projects.test.ts` — query helper tests.
- `packages/db/drizzle/000X_*.sql` — generated migration (drizzle-kit).
- `packages/mcp-server/src/tools/areas.ts` — `registerAreaTools`.
- `packages/mcp-server/src/tools/projects.ts` — `registerProjectTools`.
- `packages/mcp-server/src/__tests__/tools/areas.test.ts`
- `packages/mcp-server/src/__tests__/tools/projects.test.ts`
- `apps/web/src/lib/api/projects.ts` — area/project CRUD + `setTaskProjects`.
- `apps/web/src/__tests__/api/projects.test.ts`
- `apps/web/src/lib/queries/projects.ts` — TanStack query keys/hooks.
- `apps/web/src/components/projects/ProjectsNav.tsx` — sidebar Areas→Projects tree.
- `apps/web/src/components/projects/ProjectPicker.tsx` — task-detail picker.
- `apps/web/src/app/(shell)/projects/[id]/page.tsx` — project detail page.

**Modify:**
- `packages/db/src/schema/enums.ts` — add `entityStatusValues`/`EntityStatus`; add `"area"`, `"project"` to `entityTypeValues`.
- `packages/db/src/schema/relations.ts` — area/project/task_project relations + extend `tasksRelations`.
- `packages/db/src/schema/index.ts` — export new schema files.
- `packages/db/src/queries/index.ts` — export `./projects`.
- `packages/mcp-server/src/services/audit-logger.ts` — widen `EntityType`.
- `packages/mcp-server/src/tools/index.ts` — register new tool groups.
- `apps/web/src/types/index.ts` — add `Area`, `Project` interfaces; extend `Task` with `projects?`.
- `apps/web/src/lib/api/tasks.ts` — add `projectId` filter to `GetTasksParams`/`getTasks`; include `projects` in `mapTask`.
- `apps/web/src/components/shell/app-sidebar.tsx` — render `<ProjectsNav>`.
- `apps/web/src/app/(shell)/layout.tsx` (or wherever sidebar props are fetched) — fetch the areas/projects tree.
- `apps/web/src/components/tasks/TaskDetail.tsx` — add `<ProjectPicker>` panel.
- `apps/web/src/components/kanban/KanbanBoard.tsx` (+ swimlane/card) — project swimlanes.

---

# PHASE 1 — Data Model & Migration

### Task 1: Enums, schema tables, relations, migration

**Files:**
- Modify: `packages/db/src/schema/enums.ts`
- Create: `packages/db/src/schema/areas.ts`
- Create: `packages/db/src/schema/projects.ts`
- Modify: `packages/db/src/schema/relations.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/000X_*.sql` (generated)
- Test: `packages/db/src/__tests__/schema-projects.test.ts`

**Interfaces:**
- Produces: tables `areas`, `projects`, `taskProjects` (exported from `@baker-street/db/schema`); type `EntityStatus = "Active" | "Archived"`; relations `areasRelations`, `projectsRelations`, `taskProjectsRelations`.

- [ ] **Step 1: Add enum values.** Edit `packages/db/src/schema/enums.ts`. Add `"area"` and `"project"` to `entityTypeValues`, and append:

```ts
export const entityStatusValues = ["Active", "Archived"] as const;
export type EntityStatus = (typeof entityStatusValues)[number];
```

- [ ] **Step 2: Create `areas.ts`.**

```ts
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { EntityStatus, Source } from "./enums";

export const areas = sqliteTable(
  "areas",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    color: text("color"),
    status: text("status").$type<EntityStatus>().notNull().default("Active"),
    orderIndex: text("order_index").notNull(),
    createdBy: text("created_by").$type<Source>().notNull().default("web_ui"),
    agentId: text("agent_id"),
    requestId: text("request_id"),
    reason: text("reason"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("areas_name_unique_idx").on(table.name)]
);
```

- [ ] **Step 3: Create `projects.ts`.**

```ts
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { EntityStatus, Source } from "./enums";
import { areas } from "./areas";
import { tasks } from "./tasks";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    status: text("status").$type<EntityStatus>().notNull().default("Active"),
    orderIndex: text("order_index").notNull(),
    createdBy: text("created_by").$type<Source>().notNull().default("web_ui"),
    agentId: text("agent_id"),
    requestId: text("request_id"),
    reason: text("reason"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("projects_area_name_unique_idx").on(table.areaId, table.name)]
);

export const taskProjects = sqliteTable(
  "task_projects",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("task_projects_unique_idx").on(table.taskId, table.projectId)]
);
```

- [ ] **Step 4: Add relations.** Append to `packages/db/src/schema/relations.ts` (and add imports `import { areas } from "./areas";` and `import { projects, taskProjects } from "./projects";` at top):

```ts
export const areasRelations = relations(areas, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  area: one(areas, { fields: [projects.areaId], references: [areas.id] }),
  taskProjects: many(taskProjects),
}));

export const taskProjectsRelations = relations(taskProjects, ({ one }) => ({
  task: one(tasks, { fields: [taskProjects.taskId], references: [tasks.id] }),
  project: one(projects, { fields: [taskProjects.projectId], references: [projects.id] }),
}));
```

Also extend `tasksRelations` to include `taskProjects: many(taskProjects)`:

```ts
export const tasksRelations = relations(tasks, ({ many }) => ({
  subtasks: many(subtasks),
  taskTags: many(taskTags),
  taskProjects: many(taskProjects),
}));
```

- [ ] **Step 5: Export from barrel.** Edit `packages/db/src/schema/index.ts` — add `export * from "./areas";` and `export * from "./projects";` **before** `export * from "./relations";`.

- [ ] **Step 6: Generate the migration.**

Run: `cd packages/db && pnpm db:generate`
Expected: a new file `packages/db/drizzle/000X_<name>.sql` containing `CREATE TABLE areas`, `CREATE TABLE projects`, `CREATE TABLE task_projects`, plus the three unique indexes. Inspect it to confirm `area_id` is nullable with `ON DELETE SET NULL` and the join FKs are `ON DELETE CASCADE`.

- [ ] **Step 7: Write the failing schema test.** Create `packages/db/src/__tests__/schema-projects.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "../test-helpers";
import { areas, projects, taskProjects, tasks } from "../schema/index";
import { eq } from "drizzle-orm";
import type { Database } from "../client";

describe("projects schema", () => {
  let db: Database;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
  });
  afterAll(async () => {
    await cleanup();
  });
  beforeEach(async () => {
    await db.delete(taskProjects);
    await db.delete(projects);
    await db.delete(areas);
    await db.delete(tasks);
  });

  it("inserts an area with defaults", async () => {
    const [a] = await db
      .insert(areas)
      .values({ name: "3D Printing", orderIndex: "a0" })
      .returning();
    expect(a.id).toBeDefined();
    expect(a.status).toBe("Active");
    expect(a.createdBy).toBe("web_ui");
  });

  it("enforces global unique area name", async () => {
    await db.insert(areas).values({ name: "Home", orderIndex: "a0" });
    await expect(
      db.insert(areas).values({ name: "Home", orderIndex: "a1" })
    ).rejects.toThrow();
  });

  it("allows a project with null areaId and enforces unique (areaId, name)", async () => {
    const [a] = await db
      .insert(areas)
      .values({ name: "Area A", orderIndex: "a0" })
      .returning();
    await db.insert(projects).values({ areaId: a.id, name: "Bracket", orderIndex: "a0" });
    await expect(
      db.insert(projects).values({ areaId: a.id, name: "Bracket", orderIndex: "a1" })
    ).rejects.toThrow();
    // null areaId allowed
    const [p] = await db
      .insert(projects)
      .values({ areaId: null, name: "Loose", orderIndex: "a0" })
      .returning();
    expect(p.areaId).toBeNull();
  });

  it("sets project.areaId to null when its area is deleted", async () => {
    const [a] = await db
      .insert(areas)
      .values({ name: "Area B", orderIndex: "a0" })
      .returning();
    const [p] = await db
      .insert(projects)
      .values({ areaId: a.id, name: "P1", orderIndex: "a0" })
      .returning();
    await db.delete(areas).where(eq(areas.id, a.id));
    const rows = await db.select().from(projects).where(eq(projects.id, p.id));
    expect(rows[0].areaId).toBeNull();
  });

  it("cascades task_projects when a task is deleted", async () => {
    const [t] = await db
      .insert(tasks)
      .values({ title: "T", orderIndex: "a0" })
      .returning();
    const [p] = await db
      .insert(projects)
      .values({ name: "P2", orderIndex: "a0" })
      .returning();
    await db.insert(taskProjects).values({ taskId: t.id, projectId: p.id });
    await db.delete(tasks).where(eq(tasks.id, t.id));
    const links = await db.select().from(taskProjects).where(eq(taskProjects.projectId, p.id));
    expect(links).toHaveLength(0);
  });
});
```

- [ ] **Step 8: Run the test.**

Run: `cd packages/db && pnpm test schema-projects`
Expected: PASS (migration auto-applied by `createTestDb` → `runMigrationsOnDb`).

- [ ] **Step 9: Typecheck + commit.**

Run: `cd packages/db && pnpm typecheck`
```bash
git add packages/db/src/schema packages/db/drizzle packages/db/src/__tests__/schema-projects.test.ts
git commit -m "feat(db): add areas, projects, task_projects schema + migration"
```

---

### Task 2: Query helpers

**Files:**
- Create: `packages/db/src/queries/projects.ts`
- Modify: `packages/db/src/queries/index.ts`
- Test: `packages/db/src/__tests__/queries/projects.test.ts`

**Interfaces:**
- Produces:
  - `listAreasWithProjects(db): Promise<AreaWithProjects[]>` where `AreaWithProjects = { id: string | null; name: string; color: string | null; orderIndex: string | null; projects: Project[] }`. Active areas ordered by `orderIndex`, each with Active projects nested; a final `{ id: null, name: "No Area", ... }` bucket when ungrouped Active projects exist.
  - `getProjectWithProgress(db, projectId): Promise<{ project: Project; progress: { done: number; total: number } } | null>`.
  - `listProjectsForTask(db, taskId): Promise<Project[]>`.
  (`Project` = `typeof projects.$inferSelect`.)

- [ ] **Step 1: Write the failing test.** Create `packages/db/src/__tests__/queries/projects.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "../../test-helpers";
import { areas, projects, taskProjects, tasks } from "../../schema/index";
import {
  listAreasWithProjects,
  getProjectWithProgress,
  listProjectsForTask,
} from "../../queries/projects";
import type { Database } from "../../client";

describe("projects queries", () => {
  let db: Database;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
  });
  afterAll(async () => {
    await cleanup();
  });
  beforeEach(async () => {
    await db.delete(taskProjects);
    await db.delete(projects);
    await db.delete(areas);
    await db.delete(tasks);
  });

  it("nests active projects under active areas and adds a No Area bucket", async () => {
    const [a] = await db.insert(areas).values({ name: "Area A", orderIndex: "a0" }).returning();
    await db.insert(projects).values({ areaId: a.id, name: "P1", orderIndex: "a0" });
    await db.insert(projects).values({ areaId: a.id, name: "Archived P", orderIndex: "a1", status: "Archived" });
    await db.insert(projects).values({ areaId: null, name: "Loose", orderIndex: "a0" });

    const tree = await listAreasWithProjects(db);
    expect(tree).toHaveLength(2); // Area A + No Area
    const areaA = tree.find((n) => n.id === a.id)!;
    expect(areaA.projects.map((p) => p.name)).toEqual(["P1"]); // archived excluded
    const noArea = tree.find((n) => n.id === null)!;
    expect(noArea.name).toBe("No Area");
    expect(noArea.projects.map((p) => p.name)).toEqual(["Loose"]);
  });

  it("hides archived areas", async () => {
    await db.insert(areas).values({ name: "Hidden", orderIndex: "a0", status: "Archived" });
    const tree = await listAreasWithProjects(db);
    expect(tree).toHaveLength(0);
  });

  it("computes progress = done / non-archived linked tasks", async () => {
    const [p] = await db.insert(projects).values({ name: "P", orderIndex: "a0" }).returning();
    const [done] = await db.insert(tasks).values({ title: "d", orderIndex: "a0", status: "Done" }).returning();
    const [open] = await db.insert(tasks).values({ title: "o", orderIndex: "a1", status: "Active" }).returning();
    const [arch] = await db.insert(tasks).values({ title: "x", orderIndex: "a2", status: "Archived" }).returning();
    await db.insert(taskProjects).values([
      { taskId: done.id, projectId: p.id },
      { taskId: open.id, projectId: p.id },
      { taskId: arch.id, projectId: p.id },
    ]);
    const res = await getProjectWithProgress(db, p.id);
    expect(res!.progress).toEqual({ done: 1, total: 2 }); // archived excluded
  });

  it("returns zero progress for a project with no tasks", async () => {
    const [p] = await db.insert(projects).values({ name: "Empty", orderIndex: "a0" }).returning();
    const res = await getProjectWithProgress(db, p.id);
    expect(res!.progress).toEqual({ done: 0, total: 0 });
  });

  it("returns null for a missing project", async () => {
    expect(await getProjectWithProgress(db, "nope")).toBeNull();
  });

  it("lists projects linked to a task", async () => {
    const [t] = await db.insert(tasks).values({ title: "T", orderIndex: "a0" }).returning();
    const [p1] = await db.insert(projects).values({ name: "Alpha", orderIndex: "a0" }).returning();
    const [p2] = await db.insert(projects).values({ name: "Beta", orderIndex: "a1" }).returning();
    await db.insert(taskProjects).values([
      { taskId: t.id, projectId: p1.id },
      { taskId: t.id, projectId: p2.id },
    ]);
    const list = await listProjectsForTask(db, t.id);
    expect(list.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
  });
});
```

- [ ] **Step 2: Run it — verify it fails** (`Cannot find module '../../queries/projects'`).

Run: `cd packages/db && pnpm test queries/projects`

- [ ] **Step 3: Implement `queries/projects.ts`.**

```ts
import { asc, eq, and, ne, isNull, sql } from "drizzle-orm";
import { areas } from "../schema/areas";
import { projects, taskProjects } from "../schema/projects";
import { tasks } from "../schema/tasks";
import type { Database } from "../client";

type Project = typeof projects.$inferSelect;

export interface AreaWithProjects {
  id: string | null;
  name: string;
  color: string | null;
  orderIndex: string | null;
  projects: Project[];
}

export async function listAreasWithProjects(db: Database): Promise<AreaWithProjects[]> {
  const areaRows = await db
    .select()
    .from(areas)
    .where(eq(areas.status, "Active"))
    .orderBy(asc(areas.orderIndex));

  const result: AreaWithProjects[] = [];
  for (const area of areaRows) {
    const projs = await db
      .select()
      .from(projects)
      .where(and(eq(projects.areaId, area.id), eq(projects.status, "Active")))
      .orderBy(asc(projects.orderIndex));
    result.push({
      id: area.id,
      name: area.name,
      color: area.color,
      orderIndex: area.orderIndex,
      projects: projs,
    });
  }

  const ungrouped = await db
    .select()
    .from(projects)
    .where(and(isNull(projects.areaId), eq(projects.status, "Active")))
    .orderBy(asc(projects.orderIndex));
  if (ungrouped.length > 0) {
    result.push({ id: null, name: "No Area", color: null, orderIndex: null, projects: ungrouped });
  }
  return result;
}

export async function getProjectWithProgress(
  db: Database,
  projectId: string
): Promise<{ project: Project; progress: { done: number; total: number } } | null> {
  const rows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (rows.length === 0) return null;

  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${tasks.status} = 'Done' then 1 else 0 end)`,
    })
    .from(taskProjects)
    .innerJoin(tasks, eq(taskProjects.taskId, tasks.id))
    .where(and(eq(taskProjects.projectId, projectId), ne(tasks.status, "Archived")));

  const total = Number(stats[0]?.total ?? 0);
  const done = Number(stats[0]?.done ?? 0);
  return { project: rows[0], progress: { done, total } };
}

export async function listProjectsForTask(db: Database, taskId: string): Promise<Project[]> {
  return db
    .select({
      id: projects.id,
      areaId: projects.areaId,
      name: projects.name,
      description: projects.description,
      color: projects.color,
      status: projects.status,
      orderIndex: projects.orderIndex,
      createdBy: projects.createdBy,
      agentId: projects.agentId,
      requestId: projects.requestId,
      reason: projects.reason,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(taskProjects)
    .innerJoin(projects, eq(taskProjects.projectId, projects.id))
    .where(eq(taskProjects.taskId, taskId))
    .orderBy(asc(projects.name));
}
```

- [ ] **Step 4: Export from queries barrel.** Edit `packages/db/src/queries/index.ts` — add `export * from "./projects";`.

- [ ] **Step 5: Run tests — verify PASS.**

Run: `cd packages/db && pnpm test queries/projects`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit.**

Run: `cd packages/db && pnpm typecheck`
```bash
git add packages/db/src/queries
git commit -m "feat(db): add area/project query helpers with progress rollup"
```

---

# PHASE 2 — MCP Tools

### Task 3: Audit-logger entity types + Area MCP tools

**Files:**
- Modify: `packages/mcp-server/src/services/audit-logger.ts`
- Create: `packages/mcp-server/src/tools/areas.ts`
- Test: `packages/mcp-server/src/__tests__/tools/areas.test.ts`

**Interfaces:**
- Produces: `registerAreaTools(server: McpServer, db: Database): void` registering `areas.list`, `areas.create`, `areas.rename`, `areas.archive`. Widened `EntityType` includes `"area" | "project"`.

- [ ] **Step 1: Widen audit `EntityType`.** Edit `packages/mcp-server/src/services/audit-logger.ts`:

```ts
export type EntityType = "task" | "subtask" | "tag" | "saved_view" | "area" | "project";
```

- [ ] **Step 2: Write the failing test.** Create `packages/mcp-server/src/__tests__/tools/areas.test.ts`. Reuse the `createToolCapture`/`parseResult` helpers (copy verbatim from `tools/tags.test.ts` lines 9-52):

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { areas, projects, auditLog } from "@baker-street/db/schema";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAreaTools } from "../../tools/areas";
import type { Database } from "@baker-street/db/client";

// --- paste createToolCapture + ToolResult + parseResult from tags.test.ts ---

describe("Area tool handlers", () => {
  let db: Database;
  let cleanup: () => Promise<void>;
  let call: (t: string, p: Record<string, unknown>) => Promise<unknown>;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    ({ call } = createToolCapture(db, registerAreaTools));
  });
  afterAll(async () => {
    await cleanup();
  });
  beforeEach(async () => {
    await db.delete(auditLog);
    await db.delete(projects);
    await db.delete(areas);
  });

  it("creates an area and writes an audit entry", async () => {
    const created = parseResult(await call("areas.create", { name: "Home", color: "#abc" }));
    expect(created.name).toBe("Home");
    expect(created.status).toBe("Active");
    const log = await db.select().from(auditLog).where(eq(auditLog.entityId, created.id));
    expect(log).toHaveLength(1);
    expect(log[0].entityType).toBe("area");
  });

  it("rejects a duplicate area name with isError", async () => {
    await call("areas.create", { name: "Dup" });
    const res = (await call("areas.create", { name: "Dup" })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it("replays an idempotent create by request_id", async () => {
    const a = parseResult(await call("areas.create", { name: "Idem", request_id: "r1" }));
    const b = parseResult(await call("areas.create", { name: "Idem", request_id: "r1" }));
    expect(b.id).toBe(a.id);
    const all = await db.select().from(areas);
    expect(all).toHaveLength(1);
  });

  it("lists areas ordered by orderIndex, optionally nesting projects", async () => {
    const a = parseResult(await call("areas.create", { name: "A" }));
    await db.insert(projects).values({ areaId: a.id, name: "P", orderIndex: "a0" });
    const flat = parseResult(await call("areas.list", {}));
    expect(flat).toHaveLength(1);
    expect(flat[0].projects).toBeUndefined();
    const nested = parseResult(await call("areas.list", { include_projects: true }));
    expect(nested[0].projects).toHaveLength(1);
  });

  it("renames an area; 404 on missing", async () => {
    const a = parseResult(await call("areas.create", { name: "Old" }));
    const renamed = parseResult(await call("areas.rename", { area_id: a.id, name: "New" }));
    expect(renamed.name).toBe("New");
    const missing = (await call("areas.rename", { area_id: "nope", name: "X" })) as { isError?: boolean };
    expect(missing.isError).toBe(true);
  });

  it("archives an area (status only, keeps row)", async () => {
    const a = parseResult(await call("areas.create", { name: "Arch" }));
    await call("areas.archive", { area_id: a.id });
    const rows = await db.select().from(areas).where(eq(areas.id, a.id));
    expect(rows[0].status).toBe("Archived");
  });
});
```

- [ ] **Step 3: Run it — verify it fails.**

Run: `cd packages/mcp-server && pnpm test areas`

- [ ] **Step 4: Implement `tools/areas.ts`.**

```ts
import { z } from "zod";
import { eq, and, asc, sql } from "drizzle-orm";
import { areas, projects } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkIdempotency } from "../services/idempotency";
import { logAudit } from "../services/audit-logger";

const aiMetaParams = {
  agent_id: z.string().optional().describe("Identifier of the AI agent"),
  request_id: z.string().optional().describe("Idempotency key"),
  reason: z.string().optional().describe("Reason for change"),
};

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}
function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
}

async function getAreaById(db: Database, id: string) {
  const rows = await db.select().from(areas).where(eq(areas.id, id)).limit(1);
  return rows[0] ?? null;
}
async function areaNameExists(db: Database, name: string) {
  const rows = await db.select({ id: areas.id }).from(areas).where(eq(areas.name, name)).limit(1);
  return rows.length > 0;
}

export function registerAreaTools(server: McpServer, db: Database) {
  server.tool(
    "areas.list",
    "List areas ordered by orderIndex, optionally nesting their projects",
    { include_projects: z.boolean().optional().describe("Nest each area's projects") },
    async (params) => {
      const areaRows = await db.select().from(areas).orderBy(asc(areas.orderIndex));
      if (!params.include_projects) return ok(areaRows);
      const withProjects = [];
      for (const a of areaRows) {
        const projs = await db
          .select()
          .from(projects)
          .where(eq(projects.areaId, a.id))
          .orderBy(asc(projects.orderIndex));
        withProjects.push({ ...a, projects: projs });
      }
      return ok(withProjects);
    }
  );

  server.tool(
    "areas.create",
    "Create a new area (name unique globally)",
    { name: z.string().describe("Area name"), color: z.string().optional().describe("Hex color"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      if (await areaNameExists(db, params.name)) return err("Area name already exists");

      const [created] = await db
        .insert(areas)
        .values({
          name: params.name,
          color: params.color ?? null,
          orderIndex: Date.now().toString(36),
          createdBy: "mcp",
          agentId: params.agent_id ?? null,
          requestId: params.request_id ?? null,
          reason: params.reason ?? null,
        })
        .returning();

      await logAudit(db, {
        entityType: "area",
        entityId: created.id,
        action: "areas.create",
        before: null,
        after: created,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(created);
    }
  );

  server.tool(
    "areas.rename",
    "Rename an area (re-checks global uniqueness)",
    { area_id: z.string().describe("Area UUID"), name: z.string().describe("New name"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const existing = await getAreaById(db, params.area_id);
      if (!existing) return err("Area not found");
      if (params.name !== existing.name && (await areaNameExists(db, params.name)))
        return err("Area name already exists");

      const [updated] = await db
        .update(areas)
        .set({ name: params.name, updatedAt: new Date().toISOString() })
        .where(eq(areas.id, params.area_id))
        .returning();

      await logAudit(db, {
        entityType: "area",
        entityId: params.area_id,
        action: "areas.rename",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(updated);
    }
  );

  server.tool(
    "areas.archive",
    "Archive an area (status only; hides area + projects, keeps links)",
    { area_id: z.string().describe("Area UUID"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const existing = await getAreaById(db, params.area_id);
      if (!existing) return err("Area not found");

      const [updated] = await db
        .update(areas)
        .set({ status: "Archived", updatedAt: new Date().toISOString() })
        .where(eq(areas.id, params.area_id))
        .returning();

      await logAudit(db, {
        entityType: "area",
        entityId: params.area_id,
        action: "areas.archive",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(updated);
    }
  );
}
```

> NOTE: `sql`/`and` imports are kept for symmetry but unused here — remove any the linter flags as unused.

- [ ] **Step 5: Run tests — verify PASS.**

Run: `cd packages/mcp-server && pnpm test areas`

- [ ] **Step 6: Typecheck + commit.**

Run: `cd packages/mcp-server && pnpm typecheck`
```bash
git add packages/mcp-server/src/services/audit-logger.ts packages/mcp-server/src/tools/areas.ts packages/mcp-server/src/__tests__/tools/areas.test.ts
git commit -m "feat(mcp): add area tools (list/create/rename/archive)"
```

---

### Task 4: Project MCP tools + registration

**Files:**
- Create: `packages/mcp-server/src/tools/projects.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`
- Test: `packages/mcp-server/src/__tests__/tools/projects.test.ts`

**Interfaces:**
- Consumes: `registerAreaTools` (already registered).
- Produces: `registerProjectTools(server, db)` registering `projects.list`, `projects.create`, `projects.update`, `projects.archive`, `tasks.assign_project`, `tasks.unassign_project`. Both groups added to `registerAllTools`. **Tool count 25 → 35.**

- [ ] **Step 1: Write the failing test.** Create `packages/mcp-server/src/__tests__/tools/projects.test.ts` (reuse `createToolCapture`/`parseResult`; register BOTH `registerAreaTools, registerProjectTools` so `area_id` setup is available):

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { areas, projects, taskProjects, tasks, auditLog } from "@baker-street/db/schema";
import { eq, and } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAreaTools } from "../../tools/areas";
import { registerProjectTools } from "../../tools/projects";
import type { Database } from "@baker-street/db/client";

// --- paste createToolCapture + ToolResult + parseResult from tags.test.ts ---

describe("Project tool handlers", () => {
  let db: Database;
  let cleanup: () => Promise<void>;
  let call: (t: string, p: Record<string, unknown>) => Promise<unknown>;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    ({ call } = createToolCapture(db, registerAreaTools, registerProjectTools));
  });
  afterAll(async () => {
    await cleanup();
  });
  beforeEach(async () => {
    await db.delete(auditLog);
    await db.delete(taskProjects);
    await db.delete(projects);
    await db.delete(areas);
    await db.delete(tasks);
  });

  it("creates a project (nullable area) and audits it", async () => {
    const p = parseResult(await call("projects.create", { name: "Bracket" }));
    expect(p.name).toBe("Bracket");
    expect(p.areaId).toBeNull();
    const log = await db.select().from(auditLog).where(eq(auditLog.entityId, p.id));
    expect(log[0].entityType).toBe("project");
  });

  it("rejects duplicate name within the same area", async () => {
    const a = parseResult(await call("areas.create", { name: "A" }));
    await call("projects.create", { name: "Dup", area_id: a.id });
    const res = (await call("projects.create", { name: "Dup", area_id: a.id })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it("lists projects by area, optionally with progress", async () => {
    const a = parseResult(await call("areas.create", { name: "A" }));
    const p = parseResult(await call("projects.create", { name: "P", area_id: a.id }));
    const [t] = await db.insert(tasks).values({ title: "t", orderIndex: "a0", status: "Done" }).returning();
    await db.insert(taskProjects).values({ taskId: t.id, projectId: p.id });
    const list = parseResult(await call("projects.list", { area_id: a.id, include_progress: true }));
    expect(list).toHaveLength(1);
    expect(list[0].progress).toEqual({ done: 1, total: 1 });
  });

  it("updates a project (partial) and allows cross-area move", async () => {
    const a1 = parseResult(await call("areas.create", { name: "A1" }));
    const a2 = parseResult(await call("areas.create", { name: "A2" }));
    const p = parseResult(await call("projects.create", { name: "P", area_id: a1.id }));
    const upd = parseResult(await call("projects.update", { project_id: p.id, area_id: a2.id, description: "d" }));
    expect(upd.areaId).toBe(a2.id);
    expect(upd.description).toBe("d");
  });

  it("archives a project but keeps links", async () => {
    const p = parseResult(await call("projects.create", { name: "P" }));
    const [t] = await db.insert(tasks).values({ title: "t", orderIndex: "a0" }).returning();
    await db.insert(taskProjects).values({ taskId: t.id, projectId: p.id });
    await call("projects.archive", { project_id: p.id });
    const rows = await db.select().from(projects).where(eq(projects.id, p.id));
    expect(rows[0].status).toBe("Archived");
    const links = await db.select().from(taskProjects).where(eq(taskProjects.projectId, p.id));
    expect(links).toHaveLength(1);
  });

  it("assigns and unassigns a project idempotently", async () => {
    const p = parseResult(await call("projects.create", { name: "P" }));
    const [t] = await db.insert(tasks).values({ title: "t", orderIndex: "a0" }).returning();
    await call("tasks.assign_project", { task_id: t.id, project_id: p.id });
    await call("tasks.assign_project", { task_id: t.id, project_id: p.id }); // duplicate → no-op success
    let links = await db.select().from(taskProjects).where(and(eq(taskProjects.taskId, t.id), eq(taskProjects.projectId, p.id)));
    expect(links).toHaveLength(1);
    await call("tasks.unassign_project", { task_id: t.id, project_id: p.id });
    links = await db.select().from(taskProjects).where(and(eq(taskProjects.taskId, t.id), eq(taskProjects.projectId, p.id)));
    expect(links).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it — verify it fails.**

Run: `cd packages/mcp-server && pnpm test projects`

- [ ] **Step 3: Implement `tools/projects.ts`.** (Same `ok`/`err`/`aiMetaParams` helpers as `areas.ts`.)

```ts
import { z } from "zod";
import { eq, and, asc, sql, isNull } from "drizzle-orm";
import { projects, taskProjects, tasks } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkIdempotency } from "../services/idempotency";
import { logAudit } from "../services/audit-logger";

const aiMetaParams = {
  agent_id: z.string().optional().describe("Identifier of the AI agent"),
  request_id: z.string().optional().describe("Idempotency key"),
  reason: z.string().optional().describe("Reason for change"),
};
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}
function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
}

async function getProjectById(db: Database, id: string) {
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] ?? null;
}
// Name must be unique within an area (null area = "No Area" bucket).
async function projectNameExists(db: Database, areaId: string | null, name: string, excludeId?: string) {
  const where = areaId === null
    ? and(isNull(projects.areaId), eq(projects.name, name))
    : and(eq(projects.areaId, areaId), eq(projects.name, name));
  const rows = await db.select({ id: projects.id }).from(projects).where(where);
  return rows.some((r) => r.id !== excludeId);
}
async function progressFor(db: Database, projectId: string) {
  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${tasks.status} = 'Done' then 1 else 0 end)`,
    })
    .from(taskProjects)
    .innerJoin(tasks, eq(taskProjects.taskId, tasks.id))
    .where(and(eq(taskProjects.projectId, projectId), sql`${tasks.status} <> 'Archived'`));
  return { done: Number(stats[0]?.done ?? 0), total: Number(stats[0]?.total ?? 0) };
}

export function registerProjectTools(server: McpServer, db: Database) {
  server.tool(
    "projects.list",
    "List projects, optionally filtered by area and with progress rollups",
    {
      area_id: z.string().optional().describe("Filter by area; omit for all"),
      include_progress: z.boolean().optional().describe("Add { done, total } rollup"),
    },
    async (params) => {
      const rows = params.area_id
        ? await db.select().from(projects).where(eq(projects.areaId, params.area_id)).orderBy(asc(projects.orderIndex))
        : await db.select().from(projects).orderBy(asc(projects.orderIndex));
      if (!params.include_progress) return ok(rows);
      const withProgress = [];
      for (const p of rows) withProgress.push({ ...p, progress: await progressFor(db, p.id) });
      return ok(withProgress);
    }
  );

  server.tool(
    "projects.create",
    "Create a project (name unique within its area; area_id nullable)",
    {
      name: z.string().describe("Project name"),
      area_id: z.string().optional().describe("Parent area UUID; omit for No Area"),
      description: z.string().optional(),
      color: z.string().optional().describe("Hex color"),
      ...aiMetaParams,
    },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const areaId = params.area_id ?? null;
      if (await projectNameExists(db, areaId, params.name)) return err("Project name already exists in this area");

      const [created] = await db
        .insert(projects)
        .values({
          areaId,
          name: params.name,
          description: params.description ?? null,
          color: params.color ?? null,
          orderIndex: Date.now().toString(36),
          createdBy: "mcp",
          agentId: params.agent_id ?? null,
          requestId: params.request_id ?? null,
          reason: params.reason ?? null,
        })
        .returning();

      await logAudit(db, {
        entityType: "project",
        entityId: created.id,
        action: "projects.create",
        before: null,
        after: created,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(created);
    }
  );

  server.tool(
    "projects.update",
    "Partially update a project (name/area/description/color); cross-area move allowed",
    {
      project_id: z.string().describe("Project UUID"),
      name: z.string().optional(),
      area_id: z.string().nullable().optional().describe("New area, or null for No Area"),
      description: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      ...aiMetaParams,
    },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const existing = await getProjectById(db, params.project_id);
      if (!existing) return err("Project not found");

      const nextAreaId = params.area_id !== undefined ? params.area_id : existing.areaId;
      const nextName = params.name ?? existing.name;
      if (
        (params.name !== undefined || params.area_id !== undefined) &&
        (await projectNameExists(db, nextAreaId, nextName, existing.id))
      ) {
        return err("Project name already exists in the target area");
      }

      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (params.name !== undefined) patch.name = params.name;
      if (params.area_id !== undefined) patch.areaId = params.area_id;
      if (params.description !== undefined) patch.description = params.description;
      if (params.color !== undefined) patch.color = params.color;

      const [updated] = await db.update(projects).set(patch).where(eq(projects.id, params.project_id)).returning();
      await logAudit(db, {
        entityType: "project",
        entityId: params.project_id,
        action: "projects.update",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(updated);
    }
  );

  server.tool(
    "projects.archive",
    "Archive a project (status only; keeps task links)",
    { project_id: z.string().describe("Project UUID"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const existing = await getProjectById(db, params.project_id);
      if (!existing) return err("Project not found");
      const [updated] = await db
        .update(projects)
        .set({ status: "Archived", updatedAt: new Date().toISOString() })
        .where(eq(projects.id, params.project_id))
        .returning();
      await logAudit(db, {
        entityType: "project",
        entityId: params.project_id,
        action: "projects.archive",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(updated);
    }
  );

  server.tool(
    "tasks.assign_project",
    "Link a task to a project (idempotent no-op on duplicate)",
    { task_id: z.string().describe("Task UUID"), project_id: z.string().describe("Project UUID"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      await db
        .insert(taskProjects)
        .values({ taskId: params.task_id, projectId: params.project_id })
        .onConflictDoNothing();
      const result = { assigned: true, task_id: params.task_id, project_id: params.project_id };
      await logAudit(db, {
        entityType: "project",
        entityId: params.project_id,
        action: "tasks.assign_project",
        before: null,
        after: result,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(result);
    }
  );

  server.tool(
    "tasks.unassign_project",
    "Unlink a task from a project",
    { task_id: z.string().describe("Task UUID"), project_id: z.string().describe("Project UUID"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      await db
        .delete(taskProjects)
        .where(and(eq(taskProjects.taskId, params.task_id), eq(taskProjects.projectId, params.project_id)));
      const result = { unassigned: true, task_id: params.task_id, project_id: params.project_id };
      await logAudit(db, {
        entityType: "project",
        entityId: params.project_id,
        action: "tasks.unassign_project",
        before: null,
        after: result,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(result);
    }
  );
}
```

- [ ] **Step 4: Register both tool groups.** Edit `packages/mcp-server/src/tools/index.ts` — import `registerAreaTools` from `./areas` and `registerProjectTools` from `./projects`, and call both inside `registerAllTools`.

- [ ] **Step 5: Run tests — verify PASS.**

Run: `cd packages/mcp-server && pnpm test projects`

- [ ] **Step 6: Full mcp-server test + typecheck + commit.**

Run: `cd packages/mcp-server && pnpm test && pnpm typecheck`
Expected: all suites pass.
```bash
git add packages/mcp-server/src/tools/projects.ts packages/mcp-server/src/tools/index.ts packages/mcp-server/src/__tests__/tools/projects.test.ts
git commit -m "feat(mcp): add project tools + assign/unassign, register all (25->35)"
```

---

# PHASE 3 — Web Server Actions & Types

### Task 5: Canonical types + server actions

**Files:**
- Modify: `apps/web/src/types/index.ts`
- Create: `apps/web/src/lib/api/projects.ts`
- Test: `apps/web/src/__tests__/api/projects.test.ts`

**Interfaces:**
- Produces:
  - Types `Area`, `Project` (in `@/types`); `Task` gains optional `projects?: Project[]`.
  - Server actions: `listAreas()`, `createArea(input)`, `renameArea(id, name)`, `archiveArea(id)`, `listProjects(areaId?)`, `createProject(input)`, `updateProject(id, patch)`, `archiveProject(id)`, `getProjectsTree()`, `getProjectDetail(id)`, `setTaskProjects(taskId, projectIds)`, `listProjectsForTask(taskId)`.

- [ ] **Step 1: Add canonical types.** Edit `apps/web/src/types/index.ts`:

```ts
export type EntityStatus = "Active" | "Archived";

export interface Area {
  id: string;
  name: string;
  color: string | null;
  status: EntityStatus;
  orderIndex: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  areaId: string | null;
  name: string;
  description: string | null;
  color: string | null;
  status: EntityStatus;
  orderIndex: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Add `projects?: Project[];` to the `Task` interface (next to `tags?`).

- [ ] **Step 2: Write the failing test.** Create `apps/web/src/__tests__/api/projects.test.ts` (mirror `api/tasks.test.ts`'s `vi.mock` of `@baker-street/db/client`):

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { areas, projects, taskProjects, tasks } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";

let testDb: Database;
vi.mock("@baker-street/db/client", () => ({ createDb: () => testDb }));

describe("Web server actions — projects", () => {
  let cleanup: () => Promise<void>;
  beforeAll(async () => {
    const h = await createTestDb();
    testDb = h.db;
    cleanup = h.cleanup;
  });
  afterAll(async () => { await cleanup(); });
  beforeEach(async () => {
    await testDb.delete(taskProjects);
    await testDb.delete(projects);
    await testDb.delete(areas);
    await testDb.delete(tasks);
  });

  it("creates an area and a project under it", async () => {
    const { createArea, createProject, getProjectsTree } = await import("../../lib/api/projects");
    const area = await createArea({ name: "3D Printing" });
    await createProject({ name: "Bracket", areaId: area.id });
    const tree = await getProjectsTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].projects[0].name).toBe("Bracket");
  });

  it("setTaskProjects diff-applies links (add, remove, no-change)", async () => {
    const { createProject, setTaskProjects, listProjectsForTask } = await import("../../lib/api/projects");
    const [t] = await testDb.insert(tasks).values({ title: "T", orderIndex: "a0" }).returning();
    const p1 = await createProject({ name: "P1" });
    const p2 = await createProject({ name: "P2" });
    await setTaskProjects(t.id, [p1.id]);
    expect((await listProjectsForTask(t.id)).map((p) => p.id)).toEqual([p1.id].sort());
    await setTaskProjects(t.id, [p2.id]); // remove p1, add p2
    const after = (await listProjectsForTask(t.id)).map((p) => p.id);
    expect(after).toEqual([p2.id]);
  });

  it("getProjectDetail returns progress", async () => {
    const { createProject, getProjectDetail } = await import("../../lib/api/projects");
    const p = await createProject({ name: "P" });
    const [t] = await testDb.insert(tasks).values({ title: "t", orderIndex: "a0", status: "Done" }).returning();
    await testDb.insert(taskProjects).values({ taskId: t.id, projectId: p.id });
    const detail = await getProjectDetail(p.id);
    expect(detail!.progress).toEqual({ done: 1, total: 1 });
  });
});
```

- [ ] **Step 3: Run it — verify it fails.**

Run: `cd apps/web && pnpm test projects`

- [ ] **Step 4: Implement `lib/api/projects.ts`.** Mirror the structure of `lib/api/tasks.ts` (`"use server"`, `getDb()` via `createDb()`, map rows to canonical types). Reuse the DB query helpers from `@baker-street/db/queries`:

```ts
"use server";

import { createDb } from "@baker-street/db/client";
import { areas, projects, taskProjects } from "@baker-street/db/schema";
import {
  listAreasWithProjects,
  getProjectWithProgress,
  listProjectsForTask as listProjectsForTaskQuery,
} from "@baker-street/db/queries";
import { eq, and, asc, isNull, inArray } from "drizzle-orm";
import type { Area, Project } from "@/types";

function getDb() {
  return createDb();
}
function nextOrderIndex() {
  return Date.now().toString(36);
}
function mapArea(row: typeof areas.$inferSelect): Area {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    status: row.status,
    orderIndex: row.orderIndex,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
function mapProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    areaId: row.areaId,
    name: row.name,
    description: row.description,
    color: row.color,
    status: row.status,
    orderIndex: row.orderIndex,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

// ── Areas ──────────────────────────────────────────────────────
export async function listAreas(): Promise<Area[]> {
  const db = getDb();
  const rows = await db.select().from(areas).where(eq(areas.status, "Active")).orderBy(asc(areas.orderIndex));
  return rows.map(mapArea);
}
export async function createArea(input: { name: string; color?: string | null }): Promise<Area> {
  const db = getDb();
  const [row] = await db
    .insert(areas)
    .values({ name: input.name, color: input.color ?? null, orderIndex: nextOrderIndex(), createdBy: "web_ui" })
    .returning();
  return mapArea(row);
}
export async function renameArea(id: string, name: string): Promise<Area> {
  const db = getDb();
  const [row] = await db.update(areas).set({ name, updatedAt: new Date().toISOString() }).where(eq(areas.id, id)).returning();
  return mapArea(row);
}
export async function archiveArea(id: string): Promise<void> {
  const db = getDb();
  await db.update(areas).set({ status: "Archived", updatedAt: new Date().toISOString() }).where(eq(areas.id, id));
}

// ── Projects ───────────────────────────────────────────────────
export async function listProjects(areaId?: string | null): Promise<Project[]> {
  const db = getDb();
  const where =
    areaId === undefined
      ? eq(projects.status, "Active")
      : areaId === null
        ? and(isNull(projects.areaId), eq(projects.status, "Active"))
        : and(eq(projects.areaId, areaId), eq(projects.status, "Active"));
  const rows = await db.select().from(projects).where(where).orderBy(asc(projects.orderIndex));
  return rows.map(mapProject);
}
export async function createProject(input: {
  name: string;
  areaId?: string | null;
  description?: string | null;
  color?: string | null;
}): Promise<Project> {
  const db = getDb();
  const [row] = await db
    .insert(projects)
    .values({
      name: input.name,
      areaId: input.areaId ?? null,
      description: input.description ?? null,
      color: input.color ?? null,
      orderIndex: nextOrderIndex(),
      createdBy: "web_ui",
    })
    .returning();
  return mapProject(row);
}
export async function updateProject(
  id: string,
  patch: { name?: string; areaId?: string | null; description?: string | null; color?: string | null }
): Promise<Project> {
  const db = getDb();
  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.areaId !== undefined) data.areaId = patch.areaId;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.color !== undefined) data.color = patch.color;
  const [row] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
  return mapProject(row);
}
export async function archiveProject(id: string): Promise<void> {
  const db = getDb();
  await db.update(projects).set({ status: "Archived", updatedAt: new Date().toISOString() }).where(eq(projects.id, id));
}

// ── Tree + detail ──────────────────────────────────────────────
export async function getProjectsTree() {
  const db = getDb();
  const tree = await listAreasWithProjects(db);
  return tree.map((node) => ({
    id: node.id,
    name: node.name,
    color: node.color,
    projects: node.projects.map(mapProject),
  }));
}
export async function getProjectDetail(id: string) {
  const db = getDb();
  const res = await getProjectWithProgress(db, id);
  if (!res) return null;
  return { project: mapProject(res.project), progress: res.progress };
}

// ── Task ↔ Project links ───────────────────────────────────────
export async function listProjectsForTask(taskId: string): Promise<Project[]> {
  const db = getDb();
  const rows = await listProjectsForTaskQuery(db, taskId);
  return rows.map(mapProject);
}
export async function setTaskProjects(taskId: string, projectIds: string[]): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(taskProjects).where(eq(taskProjects.taskId, taskId));
  const have = new Set(existing.map((r) => r.projectId));
  const want = new Set(projectIds);
  const toAdd = projectIds.filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));
  if (toAdd.length > 0) {
    await db.insert(taskProjects).values(toAdd.map((projectId) => ({ taskId, projectId }))).onConflictDoNothing();
  }
  if (toRemove.length > 0) {
    await db.delete(taskProjects).where(and(eq(taskProjects.taskId, taskId), inArray(taskProjects.projectId, toRemove)));
  }
}
```

- [ ] **Step 5: Run tests — verify PASS.**

Run: `cd apps/web && pnpm test projects`

- [ ] **Step 6: Typecheck + commit.**

Run: `cd apps/web && pnpm typecheck`
```bash
git add apps/web/src/types/index.ts apps/web/src/lib/api/projects.ts apps/web/src/__tests__/api/projects.test.ts
git commit -m "feat(web): add project/area server actions + canonical types"
```

---

### Task 6: `projectId` filter in `getTasks` + `projects` in `mapTask`

**Files:**
- Modify: `apps/web/src/lib/api/tasks.ts`
- Test: extend `apps/web/src/__tests__/api/tasks.test.ts`

**Interfaces:**
- Consumes: `taskProjects` schema, `projects` relation.
- Produces: `GetTasksParams.projectId?: string`; `getTasks({ projectId })` returns only tasks linked to that project; `Task.projects` populated from `taskProjects`.

- [ ] **Step 1: Write the failing test.** Append to `apps/web/src/__tests__/api/tasks.test.ts`:

```ts
describe("getTasks projectId filter", () => {
  it("returns only tasks linked to the given project, with projects populated", async () => {
    const { createTask, getTasks } = await import("../../lib/api/tasks");
    const { createProject, setTaskProjects } = await import("../../lib/api/projects");
    const a = await createTask({ title: "linked" });
    await createTask({ title: "unlinked" });
    const p = await createProject({ name: "Proj" });
    await setTaskProjects(a.id, [p.id]);

    const rows = await getTasks({ projectId: p.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("linked");
    expect(rows[0].projects?.[0].name).toBe("Proj");
  });
});
```

> NOTE: `api/projects.ts` server actions call `createDb()`, which the test mocks to `testDb`. Ensure the `beforeEach` cleanup in this file also clears `projects`/`taskProjects` — add `await testDb.delete(taskProjects); await testDb.delete(projects);` (import both from schema) so the new test is isolated.

- [ ] **Step 2: Run it — verify it fails.**

Run: `cd apps/web && pnpm test api/tasks`

- [ ] **Step 3: Implement.** In `apps/web/src/lib/api/tasks.ts`:
  1. Import `taskProjects, projects` from `@baker-street/db/schema`.
  2. Add `projectId?: string;` to `GetTasksParams`.
  3. In `getTasks`, after the `tagId` block, add the project filter (same subquery shape as `tagId`):

```ts
if (params?.projectId) {
  const linked = await db
    .select({ taskId: taskProjects.taskId })
    .from(taskProjects)
    .where(eq(taskProjects.projectId, params.projectId));
  const ids = linked.map((r) => r.taskId);
  if (ids.length === 0) return [];
  conditions.push(inArray(tasks.id, ids));
}
```

  4. Add `taskProjects: { with: { project: true } }` to the `with` clause of BOTH `db.query.tasks.findMany` (in `getTasks`) and `db.query.tasks.findFirst` (in `getTask`).
  5. In `mapTask`, extend the param type with `taskProjects?: { project: typeof projects.$inferSelect }[]` and map them:

```ts
projects: row.taskProjects?.map((tp) => ({
  id: tp.project.id,
  areaId: tp.project.areaId,
  name: tp.project.name,
  description: tp.project.description,
  color: tp.project.color,
  status: tp.project.status,
  orderIndex: tp.project.orderIndex,
  createdAt: new Date(tp.project.createdAt),
  updatedAt: new Date(tp.project.updatedAt),
})),
```

- [ ] **Step 4: Run tests — verify PASS.**

Run: `cd apps/web && pnpm test api/tasks`

- [ ] **Step 5: Typecheck + commit.**

Run: `cd apps/web && pnpm typecheck`
```bash
git add apps/web/src/lib/api/tasks.ts apps/web/src/__tests__/api/tasks.test.ts
git commit -m "feat(web): filter tasks by projectId + populate Task.projects"
```

---

# PHASE 4 — UI Surfaces

> UI tasks have lighter automated tests (the repo has no component-render test infra for these). Each ends with a **manual verification** step run against `pnpm dev`. Each subagent MUST read the named existing components first to match conventions (semantic CSS vars, `cn()`, lucide icons, shadcn primitives) per `CLAUDE.md`.

### Task 7: TanStack query keys/hooks + sidebar data fetch

**Files:**
- Create: `apps/web/src/lib/queries/projects.ts`
- Read first: `apps/web/src/lib/queries/` (existing key/hook patterns), `apps/web/src/app/(shell)/layout.tsx` (how `savedViews`/`tags` are fetched and passed to `AppSidebar`).
- Modify: the layout/server component that fetches sidebar props — also fetch `getProjectsTree()`.

**Interfaces:**
- Produces: query keys `['projects','tree']`, `['projects', id]`; hooks `useProjectsTree()`, `useProjectDetail(id)` (60s stale, manual refresh — match existing hooks). Tree data available to `AppSidebar` via props (server-fetched) for first paint.

- [ ] **Step 1:** Read the existing `lib/queries/*` files and copy the key-factory + `useQuery` hook pattern exactly.
- [ ] **Step 2:** Implement `lib/queries/projects.ts` with the two keys and hooks calling `getProjectsTree` / `getProjectDetail`.
- [ ] **Step 3:** In the shell layout server component, call `getProjectsTree()` alongside the existing saved-views/tags fetch and pass the result into `AppSidebar` as a new `projectsTree` prop.
- [ ] **Step 4: Typecheck.** Run: `cd apps/web && pnpm typecheck`
- [ ] **Step 5: Commit.** `git commit -m "feat(web): projects query hooks + sidebar tree data fetch"`

### Task 8: Sidebar Areas→Projects tree component

**Files:**
- Create: `apps/web/src/components/projects/ProjectsNav.tsx`
- Modify: `apps/web/src/components/shell/app-sidebar.tsx`
- Read first: `apps/web/src/components/shell/app-sidebar.tsx` (the existing `Tags` `SidebarGroup` at lines 115-136 is the closest template), `apps/web/src/components/ui/sidebar.tsx`, `apps/web/src/components/ui/collapsible.tsx` (if present).

**Interfaces:**
- Consumes: `projectsTree` prop (`{ id: string | null; name: string; color: string | null; projects: Project[] }[]`).
- Produces: a `Projects` `SidebarGroup` rendered above the `Tags` group; each area is a collapsible header, each project a row linking to `/tasks?project=<id>` (consistent with the tag links `/tasks?tag=<id>`). A "No Area" node renders ungrouped projects.

- [ ] **Step 1:** Build `ProjectsNav` using `SidebarGroup`/`SidebarMenu`/`SidebarMenuButton` + a collapsible per area. Project rows: `<Link href={`/tasks?project=${p.id}`}>`. Use a `FolderKanban` (or similar) lucide icon for areas, `Folder` for projects. Color dot from `project.color` via inline style (mirror `TagBadge`).
- [ ] **Step 2:** Render `<ProjectsNav tree={projectsTree} />` in `app-sidebar.tsx` between Saved Views and Tags. Add `projectsTree` to `AppSidebarProps` (default `[]`).
- [ ] **Step 3: Manual verify.** `pnpm dev`, create an area+project via MCP or a seed, confirm the sidebar shows the tree and clicking a project navigates to `/tasks?project=<id>`.
- [ ] **Step 4: Typecheck + lint + commit.** `git commit -m "feat(web): sidebar Areas->Projects nav tree"`

### Task 9: `nuqs` projectId filter wiring on the Tasks page

**Files:**
- Read first: how `tagId`/`context`/`view` nuqs params are parsed and passed into `getTasks` on `apps/web/src/app/(shell)/tasks/` (page + client). Search: `rg -n "useQueryState|tag\b|nuqs" apps/web/src/app/(shell)/tasks apps/web/src/components/tasks`.
- Modify: the tasks page/client that reads filter params.

**Interfaces:**
- Consumes: `GetTasksParams.projectId` (Task 6).
- Produces: a `project` URL param parsed via nuqs and threaded into the `getTasks` call, coexisting with `tag`/`context`/`view`.

- [ ] **Step 1:** Mirror the exact `tagId` wiring: add a `project` query-state param and pass `projectId` into the tasks query (server fetch + TanStack key).
- [ ] **Step 2: Manual verify:** navigating to `/tasks?project=<id>` filters the list to that project's tasks.
- [ ] **Step 3: Typecheck + commit.** `git commit -m "feat(web): projectId task filter via nuqs"`

### Task 10: ProjectPicker in task detail

**Files:**
- Create: `apps/web/src/components/projects/ProjectPicker.tsx`
- Read first: `apps/web/src/components/tasks/TaskDetail.tsx` (the `TagsPanel` usage at lines 514-520 and `handleAddTag`/`handleRemoveTag` at 220-240), and `TaskDetailPanels.tsx` (where `TagsPanel` is defined) for the selector UI pattern.
- Modify: `apps/web/src/components/tasks/TaskDetail.tsx` (add a Projects panel) and pass project data through.

**Interfaces:**
- Consumes: `setTaskProjects(taskId, projectIds)`, `getProjectsTree()` (for the grouped option list), `task.projects`.
- Produces: a panel listing the task's current projects (removable) + an "add" control grouped by area; on change calls `setTaskProjects` then `onRefresh()`.

- [ ] **Step 1:** Build `ProjectPicker` modeled on `TagsPanel`: show current `projects` as removable chips (reuse the `TagBadge` visual style with the project color), plus a dropdown/popover of available projects grouped by area. Selecting/deselecting computes the new id list and calls `setTaskProjects`.
- [ ] **Step 2:** Add a `ProjectsPanel`/`<ProjectPicker>` block in `TaskDetail.tsx` next to the Tags panel; wire `onRefresh`. Pass the available tree (fetch via `useProjectsTree()` or thread from parent — match how `allTags` reaches `TagsPanel`).
- [ ] **Step 3: Manual verify:** open a task, assign/unassign a project, confirm persistence after refresh and that the project's progress updates.
- [ ] **Step 4: Typecheck + lint + commit.** `git commit -m "feat(web): ProjectPicker in task detail"`

### Task 11: Project detail page + kanban swimlanes

**Files:**
- Create: `apps/web/src/app/(shell)/projects/[id]/page.tsx`
- Read first: `apps/web/src/app/(shell)/tasks/page.tsx` (RSC data-fetch + `TaskList` usage), `apps/web/src/components/tasks/TaskList.tsx`, `apps/web/src/components/kanban/KanbanBoard.tsx` + `KanbanSwimLane.tsx` + `KanbanCard.tsx`.
- Modify: `KanbanBoard.tsx` (+ swimlane) for project swimlanes.

**Interfaces:**
- Consumes: `getProjectDetail(id)`, `getTasks({ projectId })`, `getProjectsTree()`.
- Produces: route `/projects/[id]` rendering a metadata/progress header above the reused `TaskList`; kanban gains a "by project" swimlane mode where a task linked to N projects renders one card per project swimlane.

- [ ] **Step 1 (detail page):** RSC fetches `getProjectDetail(id)` (404 via `notFound()` if null) and `getTasks({ projectId: id })`. Render a header (name, color, description, `done/total` progress bar using `--progress-complete`; show "no tasks" when `total === 0`) above `<TaskList tasks={tasks} ... />`. Match the `tasks/page.tsx` RSC→client handoff.
- [ ] **Step 2 (kanban swimlanes):** In `KanbanBoard`, add a project swimlane grouping: for each Active project, a swimlane containing that project's tasks (a task in N projects appears in N swimlanes — duplicate cards, mirroring tag behavior; no "primary project"). Read the existing swimlane implementation and follow it; gate behind the existing swimlane/grouping control if one exists, else add a "Group by: Project" toggle consistent with current kanban controls.
- [ ] **Step 3: Manual verify:** visit `/projects/<id>` (header + task list + progress correct incl. empty state); kanban project swimlanes show duplicate cards for multi-project tasks.
- [ ] **Step 4: Typecheck + lint + commit.** `git commit -m "feat(web): project detail page + kanban project swimlanes"`

---

## Final Verification

- [ ] **Full test suite:** `pnpm test` (root) — all packages green.
- [ ] **Lint + typecheck:** `pnpm lint && pnpm typecheck`.
- [ ] **Manual smoke (`pnpm dev`):** create Area → Project (sidebar), assign tasks (task detail), filter via sidebar click, open project detail page (progress correct), kanban project swimlanes, archive a project (hidden, links preserved), MCP `areas.create`/`projects.create`/`tasks.assign_project` round-trip.
- [ ] **Tool count check:** MCP now registers 35 tools.

## Self-Review Notes (author)

- **Spec coverage:** Section 1 → Tasks 1-2; Section 2 queries → Task 2; server actions → Tasks 5-6; client data flow → Tasks 7,9; UI surfaces → Tasks 8,10,11; Section 3 MCP → Tasks 3-4; Testing → tests folded into each task. All covered.
- **Known deviations:** un-audited web server actions; null-bucket project-name uniqueness (SQLite NULL-distinct) — both documented above.
- **Out of scope (v1):** projects in FTS, hard-delete tools, "primary project" kanban de-dupe, drag-drop reorder.
