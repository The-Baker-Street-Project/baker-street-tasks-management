import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { areas, projects, auditLog } from "@baker-street/db/schema";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAreaTools } from "../../tools/areas";
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
