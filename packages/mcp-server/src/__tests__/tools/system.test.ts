import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSystemTools } from "../../tools/system";
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

  registerSystemTools(server, db);

  return {
    call: async (toolName: string, params: Record<string, unknown>) => {
      const handler = handlers.get(toolName);
      if (!handler) throw new Error(`Tool ${toolName} not found`);
      return handler(params);
    },
  };
}

describe("System tools", () => {
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

  describe("system.health", () => {
    it("should return healthy status with DB connected", async () => {
      const result = await toolCapture.call("system.health", {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse((result as any).content[0].text);

      expect(parsed.status).toBe("healthy");
      expect(parsed.database).toBe("connected");
      expect(parsed.timestamp).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).isError).toBeUndefined();
    });
  });

  describe("system.capabilities", () => {
    it("should list all 25 tools", async () => {
      const result = await toolCapture.call("system.capabilities", {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse((result as any).content[0].text);

      expect(parsed.version).toBe("0.1.0");
      expect(parsed.tools).toHaveLength(25);

      // Verify some expected tool names are present
      const toolNames = parsed.tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain("tasks.create");
      expect(toolNames).toContain("audit.list");
      expect(toolNames).toContain("system.health");
      expect(toolNames).toContain("system.capabilities");
      expect(toolNames).toContain("undo.last_ai_action");

      // Every tool should have a name and description
      for (const tool of parsed.tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
      }
    });
  });
});
