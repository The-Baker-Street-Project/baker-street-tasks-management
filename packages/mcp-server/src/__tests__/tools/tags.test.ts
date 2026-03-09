import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { tags, taskTags, tasks, auditLog } from "@baker-street/db/schema";
import { eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTagTools } from "../../tools/tags";
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

describe("Tag tool handlers", () => {
  let db: Database;
  let cleanup: () => Promise<void>;
  let call: (
    toolName: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    ({ call } = createToolCapture(db, registerTagTools));
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await db.delete(auditLog);
    await db.delete(taskTags);
    await db.delete(tags);
    await db.delete(tasks);
  });

  // ── tags.create ──────────────────────────────────────────────────

  it("creates tag with name and optional color", async () => {
    const result = await call("tags.create", {
      name: "urgent",
      color: "#ff0000",
    });

    const parsed = parseResult(result);
    expect(parsed.name).toBe("urgent");
    expect(parsed.color).toBe("#ff0000");
    expect(parsed.id).toBeDefined();

    // Verify DB state
    const rows = await db
      .select()
      .from(tags)
      .where(eq(tags.id, parsed.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("urgent");
    expect(rows[0].color).toBe("#ff0000");

    // Create without color
    const noColorResult = await call("tags.create", {
      name: "low-priority",
    });
    const noColor = parseResult(noColorResult);
    expect(noColor.name).toBe("low-priority");
    expect(noColor.color).toBeNull();
  });

  // ── tags.list ────────────────────────────────────────────────────

  it("lists tags sorted by name", async () => {
    await call("tags.create", { name: "zebra" });
    await call("tags.create", { name: "alpha" });
    await call("tags.create", { name: "middle" });

    const result = await call("tags.list", {});
    const parsed = parseResult(result);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].name).toBe("alpha");
    expect(parsed[1].name).toBe("middle");
    expect(parsed[2].name).toBe("zebra");
  });

  it("with include_counts returns usage counts", async () => {
    // Create tags
    const tag1Result = await call("tags.create", { name: "tag-a" });
    const tag1 = parseResult(tag1Result);
    const tag2Result = await call("tags.create", { name: "tag-b" });
    const tag2 = parseResult(tag2Result);

    // Create tasks and assign tags
    const [task1] = await db
      .insert(tasks)
      .values({ title: "Task 1", orderIndex: "a0" })
      .returning();
    const [task2] = await db
      .insert(tasks)
      .values({ title: "Task 2", orderIndex: "a1" })
      .returning();

    await db.insert(taskTags).values([
      { taskId: task1.id, tagId: tag1.id },
      { taskId: task2.id, tagId: tag1.id },
      { taskId: task1.id, tagId: tag2.id },
    ]);

    const result = await call("tags.list", { include_counts: true });
    const parsed = parseResult(result);

    expect(parsed).toHaveLength(2);

    const tagA = parsed.find(
      (t: { name: string }) => t.name === "tag-a",
    );
    const tagB = parsed.find(
      (t: { name: string }) => t.name === "tag-b",
    );
    expect(Number(tagA.taskCount)).toBe(2);
    expect(Number(tagB.taskCount)).toBe(1);
  });

  // ── tags.rename ──────────────────────────────────────────────────

  it("renames a tag", async () => {
    const createResult = await call("tags.create", { name: "old-name" });
    const created = parseResult(createResult);

    const renameResult = await call("tags.rename", {
      tag_id: created.id,
      name: "new-name",
    });
    const renamed = parseResult(renameResult);
    expect(renamed.name).toBe("new-name");
    expect(renamed.id).toBe(created.id);

    // Verify DB state
    const rows = await db
      .select()
      .from(tags)
      .where(eq(tags.id, created.id));
    expect(rows[0].name).toBe("new-name");
  });

  // ── tags.merge ───────────────────────────────────────────────────

  it("merges source into target, deletes source", async () => {
    // Create source and target tags
    const sourceResult = await call("tags.create", { name: "source-tag" });
    const source = parseResult(sourceResult);
    const targetResult = await call("tags.create", { name: "target-tag" });
    const target = parseResult(targetResult);

    // Create a task and assign source tag
    const [task] = await db
      .insert(tasks)
      .values({ title: "Tagged task", orderIndex: "a0" })
      .returning();
    await db.insert(taskTags).values({ taskId: task.id, tagId: source.id });

    // Merge
    const mergeResult = await call("tags.merge", {
      source_tag_id: source.id,
      target_tag_id: target.id,
    });
    const merged = parseResult(mergeResult);
    expect(merged.merged).toBe(true);
    expect(merged.deleted_tag.id).toBe(source.id);
    expect(merged.surviving_tag.id).toBe(target.id);

    // Source tag should be deleted
    const sourceRows = await db
      .select()
      .from(tags)
      .where(eq(tags.id, source.id));
    expect(sourceRows).toHaveLength(0);

    // Target tag should still exist
    const targetRows = await db
      .select()
      .from(tags)
      .where(eq(tags.id, target.id));
    expect(targetRows).toHaveLength(1);

    // Task should now be associated with target tag
    const tagAssocs = await db
      .select()
      .from(taskTags)
      .where(eq(taskTags.taskId, task.id));
    expect(tagAssocs).toHaveLength(1);
    expect(tagAssocs[0].tagId).toBe(target.id);
  });
});
