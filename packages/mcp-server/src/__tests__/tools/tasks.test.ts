import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { tasks, subtasks, taskTags, auditLog } from "@baker-street/db/schema";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTaskTools } from "../../tools/tasks";
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

  return {
    call: async (toolName: string, params: Record<string, unknown>) => {
      const handler = handlers.get(toolName);
      if (!handler) throw new Error(`Tool ${toolName} not found`);
      return handler(params);
    },
  };
}

describe("Task tools", () => {
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

  describe("tasks.create", () => {
    it("should create a task and return it", async () => {
      const result = await toolCapture.call("tasks.create", {
        title: "New task",
        status: "Active",
        priority: "P2",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse((result as any).content[0].text);
      expect(parsed.title).toBe("New task");
      expect(parsed.status).toBe("Active");
      expect(parsed.id).toBeDefined();
    });

    it("should create an audit log entry", async () => {
      await toolCapture.call("tasks.create", {
        title: "Audited task",
        agent_id: "test-agent",
        reason: "testing",
      });

      const logs = await db.select().from(auditLog);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("tasks.create");
      expect(logs[0].before).toBeNull();
    });
  });

  describe("tasks.get", () => {
    it("should return a task by ID", async () => {
      const createResult = await toolCapture.call("tasks.create", { title: "Find me" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = JSON.parse((createResult as any).content[0].text);

      const getResult = await toolCapture.call("tasks.get", { task_id: created.id });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = JSON.parse((getResult as any).content[0].text);
      expect(found.title).toBe("Find me");
    });

    it("should return error for non-existent task", async () => {
      const result = await toolCapture.call("tasks.get", {
        task_id: "00000000-0000-0000-0000-000000000000",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).isError).toBe(true);
    });
  });

  describe("tasks.complete", () => {
    it("should mark task as Done with completedAt", async () => {
      const createResult = await toolCapture.call("tasks.create", { title: "Complete me" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = JSON.parse((createResult as any).content[0].text);

      const completeResult = await toolCapture.call("tasks.complete", { task_id: created.id });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completed = JSON.parse((completeResult as any).content[0].text);

      expect(completed.status).toBe("Done");
      expect(completed.completedAt).toBeDefined();
    });
  });

  describe("tasks.reopen", () => {
    it("should reopen a completed task to Active", async () => {
      const createResult = await toolCapture.call("tasks.create", { title: "Reopen me" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = JSON.parse((createResult as any).content[0].text);

      await toolCapture.call("tasks.complete", { task_id: created.id });
      const reopenResult = await toolCapture.call("tasks.reopen", { task_id: created.id });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reopened = JSON.parse((reopenResult as any).content[0].text);

      expect(reopened.status).toBe("Active");
      expect(reopened.completedAt).toBeNull();
    });
  });

  describe("tasks.update", () => {
    it("should update task fields", async () => {
      const createResult = await toolCapture.call("tasks.create", { title: "Update me" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = JSON.parse((createResult as any).content[0].text);

      const updateResult = await toolCapture.call("tasks.update", {
        task_id: created.id,
        title: "Updated title",
        priority: "P0",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = JSON.parse((updateResult as any).content[0].text);

      expect(updated.title).toBe("Updated title");
      expect(updated.priority).toBe("P0");
    });
  });

  describe("idempotency", () => {
    it("should return cached result for duplicate request_id", async () => {
      await toolCapture.call("tasks.create", {
        title: "Idempotent task",
        request_id: "idem-123",
      });

      await toolCapture.call("tasks.create", {
        title: "Should not create",
        request_id: "idem-123",
      });

      const allTasks = await db.select().from(tasks);
      expect(allTasks).toHaveLength(1);
    });
  });
});
