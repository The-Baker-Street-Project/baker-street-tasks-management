import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { tasks, subtasks, taskTags, tags } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";

// Module-level variable — captured by reference in the mock closure.
// Assigned in beforeAll before any test (or import of the SUT) runs.
let testDb: Database;

vi.mock("@baker-street/db/client", () => ({
  createDb: () => testDb,
}));

describe("Web server actions — tasks", () => {
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const helpers = await createTestDb();
    testDb = helpers.db;
    cleanup = helpers.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    // Delete in FK-safe order
    await testDb.delete(taskTags);
    await testDb.delete(subtasks);
    await testDb.delete(tasks);
    await testDb.delete(tags);
  });

  // ── createTask ──────────────────────────────────────────────────

  describe("createTask", () => {
    it("should create a task with title, status=Inbox, and a generated id", async () => {
      const { createTask } = await import("../../lib/api/tasks");

      const task = await createTask({ title: "Buy groceries" });

      expect(task.id).toBeDefined();
      expect(task.title).toBe("Buy groceries");
      expect(task.status).toBe("Inbox");
      expect(task.priority).toBe("P3");
      expect(task.createdBy).toBe("web_ui");
    });
  });

  // ── getTask ─────────────────────────────────────────────────────

  describe("getTask", () => {
    it("should return a task by ID with correct title", async () => {
      const { createTask, getTask } = await import("../../lib/api/tasks");

      const created = await createTask({ title: "Read a book" });
      const fetched = await getTask(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.title).toBe("Read a book");
    });

    it("should return null for a non-existent ID", async () => {
      const { getTask } = await import("../../lib/api/tasks");

      const result = await getTask("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  // ── updateTask ──────────────────────────────────────────────────

  describe("updateTask", () => {
    it("should update title and priority", async () => {
      const { createTask, updateTask } = await import("../../lib/api/tasks");

      const task = await createTask({ title: "Original title" });
      const updated = await updateTask(task.id, {
        title: "Updated title",
        priority: "P1",
      });

      expect(updated.title).toBe("Updated title");
      expect(updated.priority).toBe("P1");
      expect(updated.id).toBe(task.id);
    });
  });

  // ── completeTask ────────────────────────────────────────────────

  describe("completeTask", () => {
    it("should set status to Done and populate completedAt", async () => {
      const { createTask, completeTask } = await import("../../lib/api/tasks");

      const task = await createTask({ title: "Finish report" });
      const completed = await completeTask(task.id);

      expect(completed.status).toBe("Done");
      expect(completed.completedAt).toBeInstanceOf(Date);
    });
  });

  // ── reopenTask ──────────────────────────────────────────────────

  describe("reopenTask", () => {
    it("should set status to Active and clear completedAt", async () => {
      const { createTask, completeTask, reopenTask } = await import(
        "../../lib/api/tasks"
      );

      const task = await createTask({ title: "Recurring task" });
      await completeTask(task.id);
      const reopened = await reopenTask(task.id);

      expect(reopened.status).toBe("Active");
      expect(reopened.completedAt).toBeNull();
    });
  });

  // ── getOverdueTasks ─────────────────────────────────────────────

  describe("getOverdueTasks", () => {
    it("should return only overdue tasks (dueAt before today, not Done/Archived)", async () => {
      const { createTask, getOverdueTasks } = await import(
        "../../lib/api/tasks"
      );

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await createTask({
        title: "Overdue task",
        status: "Active",
        dueAt: yesterday,
      });

      await createTask({
        title: "Future task",
        status: "Active",
        dueAt: tomorrow,
      });

      const overdue = await getOverdueTasks();

      expect(overdue).toHaveLength(1);
      expect(overdue[0].title).toBe("Overdue task");
    });
  });

  // ── searchTasks ─────────────────────────────────────────────────

  describe("searchTasks", () => {
    it("should find tasks matching a partial title search", async () => {
      const { createTask, searchTasks } = await import("../../lib/api/tasks");

      await createTask({ title: "Deploy the application" });
      await createTask({ title: "Write documentation" });

      const results = await searchTasks("Deploy");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Deploy the application");
    });
  });

  // ── createSubtask ───────────────────────────────────────────────

  describe("createSubtask", () => {
    it("should add a subtask to a task and return the parent with subtask present", async () => {
      const { createTask, createSubtask, getTask } = await import(
        "../../lib/api/tasks"
      );

      const parent = await createTask({ title: "Parent task" });
      await createSubtask({ taskId: parent.id, title: "Child subtask" });

      const fetched = await getTask(parent.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.subtasks).toBeDefined();
      expect(fetched!.subtasks).toHaveLength(1);
      expect(fetched!.subtasks![0].title).toBe("Child subtask");
    });
  });

  // ── addTagToTask / removeTagFromTask ────────────────────────────

  describe("addTagToTask / removeTagFromTask", () => {
    it("should add a tag to a task and then remove it", async () => {
      const { createTask, addTagToTask, removeTagFromTask, getTask } =
        await import("../../lib/api/tasks");
      const { createTag } = await import("../../lib/api/views");

      const task = await createTask({ title: "Tagged task" });
      const tag = await createTag({ name: "urgent", color: "#ff0000" });

      // Add the tag
      await addTagToTask(task.id, tag.id);
      const withTag = await getTask(task.id);
      expect(withTag).not.toBeNull();
      expect(withTag!.tags).toBeDefined();
      expect(withTag!.tags).toHaveLength(1);
      expect(withTag!.tags![0].name).toBe("urgent");

      // Remove the tag
      await removeTagFromTask(task.id, tag.id);
      const withoutTag = await getTask(task.id);
      expect(withoutTag).not.toBeNull();
      expect(withoutTag!.tags).toHaveLength(0);
    });
  });
});
