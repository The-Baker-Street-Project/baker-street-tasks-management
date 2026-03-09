import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { savedViews, auditLog } from "@baker-street/db/schema";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerViewTools } from "../../tools/views";
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

describe("View tool handlers", () => {
  let db: Database;
  let cleanup: () => Promise<void>;
  let call: (
    toolName: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    ({ call } = createToolCapture(db, registerViewTools));
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await db.delete(auditLog);
    await db.delete(savedViews);
  });

  // ── views.create ─────────────────────────────────────────────────

  it("creates a saved view", async () => {
    const result = await call("views.create", {
      name: "My Active Tasks",
      type: "Tasks",
      filter_definition: { status: "Active" },
      sort_order: 1,
    });

    const parsed = parseResult(result);
    expect(parsed.name).toBe("My Active Tasks");
    expect(parsed.type).toBe("Tasks");
    expect(parsed.filterDefinition).toEqual({ status: "Active" });
    expect(parsed.sortOrder).toBe(1);
    expect(parsed.id).toBeDefined();

    // Verify DB state
    const rows = await db
      .select()
      .from(savedViews)
      .where(eq(savedViews.id, parsed.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("My Active Tasks");
    expect(rows[0].type).toBe("Tasks");
  });

  // ── views.list ───────────────────────────────────────────────────

  it("lists views sorted by sortOrder", async () => {
    await call("views.create", {
      name: "Third",
      type: "Tasks",
      sort_order: 30,
    });
    await call("views.create", {
      name: "First",
      type: "Tasks",
      sort_order: 10,
    });
    await call("views.create", {
      name: "Second",
      type: "KanbanLane",
      sort_order: 20,
    });

    const result = await call("views.list", {});
    const parsed = parseResult(result);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].name).toBe("First");
    expect(parsed[1].name).toBe("Second");
    expect(parsed[2].name).toBe("Third");
  });

  // ── views.update ─────────────────────────────────────────────────

  it("updates a view's name", async () => {
    const createResult = await call("views.create", {
      name: "Original Name",
      type: "Tasks",
    });
    const created = parseResult(createResult);

    const updateResult = await call("views.update", {
      view_id: created.id,
      name: "Updated Name",
    });
    const updated = parseResult(updateResult);
    expect(updated.name).toBe("Updated Name");
    expect(updated.id).toBe(created.id);

    // Verify DB state
    const rows = await db
      .select()
      .from(savedViews)
      .where(eq(savedViews.id, created.id));
    expect(rows[0].name).toBe("Updated Name");
  });

  it("returns error for non-existent view", async () => {
    const result = await call("views.update", {
      view_id: "00000000-0000-0000-0000-000000000099",
      name: "Doesn't matter",
    });

    const r = result as ToolResult;
    expect(r.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toBe("View not found");
  });
});
