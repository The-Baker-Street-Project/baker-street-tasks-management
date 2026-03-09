import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { tasks, subtasks, taskTags, auditLog } from "@baker-street/db/schema";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTaskTools } from "../../tools/tasks";
import { registerUndoTools } from "../../tools/undo";
import type { Database } from "@baker-street/db/client";

// Helper to capture tool handlers from McpServer.
// Uses rest-args to handle all McpServer.tool() overloads (2-6 args).
function createToolCapture(db: Database) {
  const handlers = new Map<string, (params: Record<string, unknown>) => Promise<unknown>>();
  const server = new McpServer({ name: "test", version: "0.0.1" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).tool = (...args: any[]) => {
    const name = args[0] as string;
    const handler = args[args.length - 1]; // callback is always last arg
    handlers.set(name, handler);
  };

  registerTaskTools(server, db);
  registerUndoTools(server, db);

  return {
    call: async (toolName: string, params: Record<string, unknown>) => {
      const handler = handlers.get(toolName);
      if (!handler) throw new Error(`Tool ${toolName} not found`);
      return handler(params);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResult(result: any): any {
  return JSON.parse(result.content[0].text);
}

describe("Undo tools", () => {
  let db: Database;
  let cleanup: () => Promise<void>;
  let toolCapture: ReturnType<typeof createToolCapture>;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    toolCapture = createToolCapture(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await db.delete(auditLog);
    await db.delete(taskTags);
    await db.delete(subtasks);
    await db.delete(tasks);
  });

  describe("undo.last_ai_action", () => {
    it("should undo a task creation by deleting the task", async () => {
      // Create a task via AI agent so it has an AI audit entry
      const createResult = await toolCapture.call("tasks.create", {
        title: "AI created task",
        agent_id: "test-agent",
        reason: "testing undo",
      });
      const created = parseResult(createResult);

      // Verify the task exists
      const beforeUndo = await db.select().from(tasks).where(eq(tasks.id, created.id));
      expect(beforeUndo).toHaveLength(1);

      // Undo the creation
      const undoResult = await toolCapture.call("undo.last_ai_action", {
        entity_type: "task",
        entity_id: created.id,
      });
      const undone = parseResult(undoResult);

      expect(undone.undone_action).toBe("tasks.create");
      expect(undone.restored_state).toBeNull(); // create undo = delete, so null

      // Verify the task was deleted from the database
      const afterUndo = await db.select().from(tasks).where(eq(tasks.id, created.id));
      expect(afterUndo).toHaveLength(0);

      // Verify the original audit entry was marked undone
      const logs = await db.select().from(auditLog).where(eq(auditLog.id, undone.undone_audit_id));
      expect(logs).toHaveLength(1);
      expect(logs[0].undone).toBe(true);
      expect(logs[0].undoneByAuditId).toBeDefined();
    });

    it("should undo a task update by restoring previous values", async () => {
      // Create a task
      const createResult = await toolCapture.call("tasks.create", {
        title: "Original title",
        priority: "P3",
        agent_id: "test-agent",
      });
      const created = parseResult(createResult);

      // Update the task (also as AI agent)
      await toolCapture.call("tasks.update", {
        task_id: created.id,
        title: "Updated title",
        priority: "P0",
        agent_id: "test-agent",
      });

      // Verify the update took effect
      const afterUpdate = await db.select().from(tasks).where(eq(tasks.id, created.id));
      expect(afterUpdate[0].title).toBe("Updated title");
      expect(afterUpdate[0].priority).toBe("P0");

      // Undo the last AI action (the update)
      const undoResult = await toolCapture.call("undo.last_ai_action", {
        entity_type: "task",
        entity_id: created.id,
      });
      const undone = parseResult(undoResult);

      expect(undone.undone_action).toBe("tasks.update");

      // Verify the task was restored to the original values
      const afterUndo = await db.select().from(tasks).where(eq(tasks.id, created.id));
      expect(afterUndo).toHaveLength(1);
      expect(afterUndo[0].title).toBe("Original title");
      expect(afterUndo[0].priority).toBe("P3");
    });

    it("should return error when no undoable action exists", async () => {
      // Try to undo an entity that has no audit entries at all
      const result = await toolCapture.call("undo.last_ai_action", {
        entity_type: "task",
        entity_id: "00000000-0000-0000-0000-000000000000",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error).toContain("No undoable AI action found");
    });
  });

  describe("undo.by_id", () => {
    it("should undo a specific audit entry", async () => {
      // Create a task (generates audit entry 1)
      const createResult = await toolCapture.call("tasks.create", {
        title: "Task to undo by ID",
        agent_id: "test-agent",
      });
      const created = parseResult(createResult);

      // Update the task (generates audit entry 2)
      await toolCapture.call("tasks.update", {
        task_id: created.id,
        title: "Changed title",
        agent_id: "test-agent",
      });

      // Get the audit entry for the update (the most recent one for this entity with action tasks.update)
      const logs = await db.select().from(auditLog);
      const updateAuditEntry = logs.find((l) => l.action === "tasks.update");
      expect(updateAuditEntry).toBeDefined();

      // Undo by the specific audit ID
      const undoResult = await toolCapture.call("undo.by_id", {
        audit_id: updateAuditEntry!.id,
        agent_id: "test-agent",
      });
      const undone = parseResult(undoResult);

      expect(undone.undone_audit_id).toBe(updateAuditEntry!.id);
      expect(undone.undone_action).toBe("tasks.update");

      // Verify the task was restored to its pre-update state
      const afterUndo = await db.select().from(tasks).where(eq(tasks.id, created.id));
      expect(afterUndo).toHaveLength(1);
      expect(afterUndo[0].title).toBe("Task to undo by ID");
    });

    it("should return error for non-existent audit entry", async () => {
      const result = await toolCapture.call("undo.by_id", {
        audit_id: "00000000-0000-0000-0000-000000000000",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error).toContain("Audit entry not found");
    });

    it("should return error if already undone", async () => {
      // Create a task
      const createResult = await toolCapture.call("tasks.create", {
        title: "Double undo test",
        agent_id: "test-agent",
      });
      const created = parseResult(createResult);

      // Get the create audit entry
      const logs = await db.select().from(auditLog);
      const createAuditEntry = logs.find((l) => l.action === "tasks.create");
      expect(createAuditEntry).toBeDefined();

      // Undo the first time — should succeed
      const firstResult = await toolCapture.call("undo.by_id", {
        audit_id: createAuditEntry!.id,
        agent_id: "test-agent",
      });
      const firstUndo = parseResult(firstResult);
      expect(firstUndo.undone_action).toBe("tasks.create");

      // Undo the same entry again — should fail
      const secondResult = await toolCapture.call("undo.by_id", {
        audit_id: createAuditEntry!.id,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((secondResult as any).isError).toBe(true);
      const secondParsed = parseResult(secondResult);
      expect(secondParsed.error).toContain("already been undone");
    });
  });
});
