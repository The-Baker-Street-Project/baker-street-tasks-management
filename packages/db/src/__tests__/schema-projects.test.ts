import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "../test-helpers";
import { areas, projects, taskProjects, tasks } from "../schema/index";
import { eq } from "drizzle-orm";
import type { Database } from "../client";

describe("projects schema", () => {
  let db: Database;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
  });
  afterAll(async () => {
    await cleanup();
  });
  beforeEach(async () => {
    await db.delete(taskProjects);
    await db.delete(projects);
    await db.delete(areas);
    await db.delete(tasks);
  });

  it("inserts an area with defaults", async () => {
    const [a] = await db
      .insert(areas)
      .values({ name: "3D Printing", orderIndex: "a0" })
      .returning();
    expect(a.id).toBeDefined();
    expect(a.status).toBe("Active");
    expect(a.createdBy).toBe("web_ui");
  });

  it("enforces global unique area name", async () => {
    await db.insert(areas).values({ name: "Home", orderIndex: "a0" });
    await expect(
      db.insert(areas).values({ name: "Home", orderIndex: "a1" })
    ).rejects.toThrow();
  });

  it("allows a project with null areaId and enforces unique (areaId, name)", async () => {
    const [a] = await db
      .insert(areas)
      .values({ name: "Area A", orderIndex: "a0" })
      .returning();
    await db.insert(projects).values({ areaId: a.id, name: "Bracket", orderIndex: "a0" });
    await expect(
      db.insert(projects).values({ areaId: a.id, name: "Bracket", orderIndex: "a1" })
    ).rejects.toThrow();
    // null areaId allowed
    const [p] = await db
      .insert(projects)
      .values({ areaId: null, name: "Loose", orderIndex: "a0" })
      .returning();
    expect(p.areaId).toBeNull();
  });

  it("sets project.areaId to null when its area is deleted", async () => {
    const [a] = await db
      .insert(areas)
      .values({ name: "Area B", orderIndex: "a0" })
      .returning();
    const [p] = await db
      .insert(projects)
      .values({ areaId: a.id, name: "P1", orderIndex: "a0" })
      .returning();
    await db.delete(areas).where(eq(areas.id, a.id));
    const rows = await db.select().from(projects).where(eq(projects.id, p.id));
    expect(rows[0].areaId).toBeNull();
  });

  it("cascades task_projects when a task is deleted", async () => {
    const [t] = await db
      .insert(tasks)
      .values({ title: "T", orderIndex: "a0" })
      .returning();
    const [p] = await db
      .insert(projects)
      .values({ name: "P2", orderIndex: "a0" })
      .returning();
    await db.insert(taskProjects).values({ taskId: t.id, projectId: p.id });
    await db.delete(tasks).where(eq(tasks.id, t.id));
    const links = await db.select().from(taskProjects).where(eq(taskProjects.projectId, p.id));
    expect(links).toHaveLength(0);
  });
});
