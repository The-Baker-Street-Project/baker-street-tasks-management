import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { tasks, subtasks, taskTags, auditLog } from "@baker-street/db/schema";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTaskTools } from "../../tools/tasks";
import { registerAuditTools } from "../../tools/audit";
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
  registerAuditTools(server, db);

  return {
    call: async (toolName: string, params: Record<string, unknown>) => {
      const handler = handlers.get(toolName);
      if (!handler) throw new Error(`Tool ${toolName} not found`);
      return handler(params);
    },
  };
}

describe("Audit tools", () => {
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

  describe("audit.list", () => {
    it("should list entries ordered by createdAt desc", async () => {
      // Create multiple tasks to generate audit entries
      await toolCapture.call("tasks.create", {
        title: "First task",
        agent_id: "test-agent",
        reason: "first",
      });

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      await toolCapture.call("tasks.create", {
        title: "Second task",
        agent_id: "test-agent",
        reason: "second",
      });

      const result = await toolCapture.call("audit.list", {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries = JSON.parse((result as any).content[0].text);

      expect(entries).toHaveLength(2);
      // Most recent first (desc order)
      expect(entries[0].reason).toBe("second");
      expect(entries[1].reason).toBe("first");
    });

    it("should filter by entity_type", async () => {
      // Create a task (entity_type = "task")
      await toolCapture.call("tasks.create", {
        title: "A task",
        agent_id: "test-agent",
      });

      // List only task audit entries
      const result = await toolCapture.call("audit.list", {
        entity_type: "task",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries = JSON.parse((result as any).content[0].text);
      expect(entries).toHaveLength(1);
      expect(entries[0].entityType).toBe("task");

      // List subtask audit entries — should be empty
      const subtaskResult = await toolCapture.call("audit.list", {
        entity_type: "subtask",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subtaskEntries = JSON.parse((subtaskResult as any).content[0].text);
      expect(subtaskEntries).toHaveLength(0);
    });

    it("should support pagination (limit/offset)", async () => {
      // Create 3 tasks to generate 3 audit entries
      for (let i = 0; i < 3; i++) {
        await toolCapture.call("tasks.create", {
          title: `Task ${i}`,
          agent_id: "test-agent",
          reason: `reason-${i}`,
        });
        await new Promise((r) => setTimeout(r, 10));
      }

      // Get first page (limit 2)
      const page1 = await toolCapture.call("audit.list", { limit: 2, offset: 0 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page1Entries = JSON.parse((page1 as any).content[0].text);
      expect(page1Entries).toHaveLength(2);

      // Get second page (offset 2)
      const page2 = await toolCapture.call("audit.list", { limit: 2, offset: 2 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page2Entries = JSON.parse((page2 as any).content[0].text);
      expect(page2Entries).toHaveLength(1);

      // Entries should not overlap
      const page1Ids = page1Entries.map((e: Record<string, unknown>) => e.id);
      const page2Ids = page2Entries.map((e: Record<string, unknown>) => e.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });
  });

  describe("audit.get", () => {
    it("should return a single entry by ID", async () => {
      await toolCapture.call("tasks.create", {
        title: "Audited task",
        agent_id: "test-agent",
        reason: "test-reason",
      });

      // Get the audit entry ID from audit.list
      const listResult = await toolCapture.call("audit.list", {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries = JSON.parse((listResult as any).content[0].text);
      expect(entries).toHaveLength(1);
      const auditId = entries[0].id;

      // Fetch by ID
      const getResult = await toolCapture.call("audit.get", { audit_id: auditId });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry = JSON.parse((getResult as any).content[0].text);
      expect(entry.id).toBe(auditId);
      expect(entry.action).toBe("tasks.create");
      expect(entry.reason).toBe("test-reason");
    });

    it("should return error for non-existent ID", async () => {
      const result = await toolCapture.call("audit.get", {
        audit_id: "00000000-0000-0000-0000-000000000000",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse((result as any).content[0].text);
      expect(parsed.error).toBe("Audit entry not found");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).isError).toBe(true);
    });
  });
});
