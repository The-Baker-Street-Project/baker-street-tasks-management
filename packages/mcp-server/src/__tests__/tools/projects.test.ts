import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { areas, projects, taskProjects, tasks, auditLog } from "@baker-street/db/schema";
import { eq, and } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAreaTools } from "../../tools/areas";
import { registerProjectTools } from "../../tools/projects";
import type { Database } from "@baker-street/db/client";

// ── tool capture helper ──────────────────────────────────────────────

function createToolCapture(
  db: Database,
  ...registerFns: ((server: McpServer, db: Database) => void)[]
) {
  const handlers = new Map<
    string,
    (params: Record<string, unknown>) => Promise<unknown>
  >();
  const server = new McpServer({ name: "test", version: "0.0.1" });
  const origTool = server.tool.bind(server);
  (server as unknown as Record<string, unknown>).tool = (
    ...args: unknown[]
  ) => {
    handlers.set(
      args[0] as string,
      args[args.length - 1] as (
        params: Record<string, unknown>,
      ) => Promise<unknown>,
    );
    return (origTool as (...a: unknown[]) => unknown)(...args);
  };
  for (const fn of registerFns) fn(server, db);
  return {
    call: async (toolName: string, params: Record<string, unknown>) => {
      const handler = handlers.get(toolName);
      if (!handler) throw new Error(`Tool ${toolName} not found`);
      return handler(params);
    },
  };
}

// ── helpers ──────────────────────────────────────────────────────────

interface ToolResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

function parseResult(result: unknown) {
  const r = result as ToolResult;
  return JSON.parse(r.content[0].text);
}

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
