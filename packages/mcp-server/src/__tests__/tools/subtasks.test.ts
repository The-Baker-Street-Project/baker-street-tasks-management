import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { tasks, subtasks, auditLog } from "@baker-street/db/schema";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSubtaskTools } from "../../tools/subtasks";
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

describe("Subtask tool handlers", () => {
  let db: Database;
  let cleanup: () => Promise<void>;
  let call: (
    toolName: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>;
  let parentTaskId: string;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    ({ call } = createToolCapture(db, registerSubtaskTools));
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await db.delete(auditLog);
    await db.delete(subtasks);
    await db.delete(tasks);

    // Insert a parent task for subtask tests
    const [task] = await db
      .insert(tasks)
      .values({
        title: "Parent task",
        orderIndex: "a0",
      })
      .returning();
    parentTaskId = task.id;
  });

  // ── subtasks.add ─────────────────────────────────────────────────

  it("adds subtask to existing task with correct taskId and done=false", async () => {
    const result = await call("subtasks.add", {
      task_id: parentTaskId,
      title: "My subtask",
    });

    const parsed = parseResult(result);
    expect(parsed.taskId).toBe(parentTaskId);
    expect(parsed.title).toBe("My subtask");
    expect(parsed.done).toBe(false);
    expect(parsed.id).toBeDefined();
    expect(parsed.orderIndex).toBeDefined();

    // Verify DB state
    const rows = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.id, parsed.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].taskId).toBe(parentTaskId);
    expect(rows[0].done).toBe(false);
  });

  it("returns error when parent task doesn't exist", async () => {
    const result = await call("subtasks.add", {
      task_id: "00000000-0000-0000-0000-000000000099",
      title: "Orphan subtask",
    });

    const r = result as ToolResult;
    expect(r.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toBe("Parent task not found");
  });

  // ── subtasks.toggle ──────────────────────────────────────────────

  it("toggles subtask done state", async () => {
    // Create a subtask
    const addResult = await call("subtasks.add", {
      task_id: parentTaskId,
      title: "Toggle me",
    });
    const created = parseResult(addResult);
    expect(created.done).toBe(false);

    // Toggle to done
    const toggleResult = await call("subtasks.toggle", {
      subtask_id: created.id,
      done: true,
    });
    const toggled = parseResult(toggleResult);
    expect(toggled.done).toBe(true);

    // Verify DB state
    const rows = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.id, created.id));
    expect(rows[0].done).toBe(true);

    // Toggle back to not done
    const toggleBack = await call("subtasks.toggle", {
      subtask_id: created.id,
      done: false,
    });
    const unToggled = parseResult(toggleBack);
    expect(unToggled.done).toBe(false);
  });

  // ── subtasks.reorder ─────────────────────────────────────────────

  it("reorders subtask position", async () => {
    // Create three subtasks
    const r1 = parseResult(
      await call("subtasks.add", {
        task_id: parentTaskId,
        title: "First",
      }),
    );
    const r2 = parseResult(
      await call("subtasks.add", {
        task_id: parentTaskId,
        title: "Second",
      }),
    );
    const r3 = parseResult(
      await call("subtasks.add", {
        task_id: parentTaskId,
        title: "Third",
      }),
    );

    // Verify initial order: r1 < r2 < r3
    expect(r1.orderIndex < r2.orderIndex).toBe(true);
    expect(r2.orderIndex < r3.orderIndex).toBe(true);

    // Move r3 between r1 and r2
    const reorderResult = await call("subtasks.reorder", {
      subtask_id: r3.id,
      after_id: r1.id,
      before_id: r2.id,
    });
    const reordered = parseResult(reorderResult);

    // New orderIndex should be between r1 and r2
    expect(reordered.orderIndex > r1.orderIndex).toBe(true);
    expect(reordered.orderIndex < r2.orderIndex).toBe(true);

    // Verify DB state
    const rows = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.id, r3.id));
    expect(rows[0].orderIndex).toBe(reordered.orderIndex);
  });
});
