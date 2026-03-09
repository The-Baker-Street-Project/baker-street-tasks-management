import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { savedViews, tags } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";

// Module-level variable — the vi.mock closure captures by reference
let testDb: Database;

vi.mock("@baker-street/db/client", () => ({
  createDb: () => testDb,
}));

describe("Views and Tags server actions", () => {
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const result = await createTestDb();
    testDb = result.db;
    cleanup = result.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await testDb.delete(savedViews);
    await testDb.delete(tags);
  });

  describe("getSavedViews", () => {
    it("should return views sorted by sortOrder", async () => {
      // Insert views with different sort orders (higher first to verify sorting)
      await testDb.insert(savedViews).values([
        { name: "Later View", type: "Tasks" as const, sortOrder: 10 },
        { name: "First View", type: "KanbanLane" as const, sortOrder: 1 },
      ]);

      const { getSavedViews } = await import("../../lib/api/views");
      const result = await getSavedViews();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("First View");
      expect(result[0].sortOrder).toBe(1);
      expect(result[0].type).toBe("KanbanLane");
      expect(result[1].name).toBe("Later View");
      expect(result[1].sortOrder).toBe(10);
      expect(result[1].type).toBe("Tasks");
    });
  });

  describe("getTags", () => {
    it("should return tags sorted by name", async () => {
      await testDb.insert(tags).values([
        { name: "Zebra", color: "#000" },
        { name: "Alpha", color: "#fff" },
      ]);

      const { getTags } = await import("../../lib/api/views");
      const result = await getTags();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Alpha");
      expect(result[0].color).toBe("#fff");
      expect(result[1].name).toBe("Zebra");
      expect(result[1].color).toBe("#000");
    });
  });

  describe("createTag", () => {
    it("should create a tag with name and color", async () => {
      const { createTag } = await import("../../lib/api/views");
      const tag = await createTag({ name: "Urgent", color: "#ff0000" });

      expect(tag.name).toBe("Urgent");
      expect(tag.color).toBe("#ff0000");
      expect(tag.id).toBeDefined();
      expect(tag.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("updateTag", () => {
    it("should update a tag name", async () => {
      const { createTag, updateTag } = await import("../../lib/api/views");
      const original = await createTag({ name: "Old Name", color: "#aaa" });

      const updated = await updateTag(original.id, { name: "New Name" });

      expect(updated.id).toBe(original.id);
      expect(updated.name).toBe("New Name");
      expect(updated.color).toBe("#aaa"); // color unchanged
    });
  });

  describe("deleteTag", () => {
    it("should delete a tag so getTags returns empty", async () => {
      const { createTag, deleteTag, getTags } = await import(
        "../../lib/api/views"
      );
      const tag = await createTag({ name: "Temp" });

      await deleteTag(tag.id);

      const remaining = await getTags();
      expect(remaining).toHaveLength(0);
    });
  });
});
