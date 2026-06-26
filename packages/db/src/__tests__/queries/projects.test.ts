import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "../../test-helpers";
import { areas, projects, taskProjects, tasks } from "../../schema/index";
import {
  listAreasWithProjects,
  getProjectWithProgress,
  listProjectsForTask,
} from "../../queries/projects";
import type { Database } from "../../client";

describe("projects queries", () => {
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

  it("nests active projects under active areas and adds a No Area bucket", async () => {
    const [a] = await db.insert(areas).values({ name: "Area A", orderIndex: "a0" }).returning();
    await db.insert(projects).values({ areaId: a.id, name: "P1", orderIndex: "a0" });
    await db.insert(projects).values({ areaId: a.id, name: "Archived P", orderIndex: "a1", status: "Archived" });
    await db.insert(projects).values({ areaId: null, name: "Loose", orderIndex: "a0" });

    const tree = await listAreasWithProjects(db);
    expect(tree).toHaveLength(2); // Area A + No Area
    const areaA = tree.find((n) => n.id === a.id)!;
    expect(areaA.projects.map((p) => p.name)).toEqual(["P1"]); // archived excluded
    const noArea = tree.find((n) => n.id === null)!;
    expect(noArea.name).toBe("No Area");
    expect(noArea.projects.map((p) => p.name)).toEqual(["Loose"]);
  });

  it("hides archived areas", async () => {
    await db.insert(areas).values({ name: "Hidden", orderIndex: "a0", status: "Archived" });
    const tree = await listAreasWithProjects(db);
    expect(tree).toHaveLength(0);
  });

  it("computes progress = done / non-archived linked tasks", async () => {
    const [p] = await db.insert(projects).values({ name: "P", orderIndex: "a0" }).returning();
    const [done] = await db.insert(tasks).values({ title: "d", orderIndex: "a0", status: "Done" }).returning();
    const [open] = await db.insert(tasks).values({ title: "o", orderIndex: "a1", status: "Active" }).returning();
    const [arch] = await db.insert(tasks).values({ title: "x", orderIndex: "a2", status: "Archived" }).returning();
    await db.insert(taskProjects).values([
      { taskId: done.id, projectId: p.id },
      { taskId: open.id, projectId: p.id },
      { taskId: arch.id, projectId: p.id },
    ]);
    const res = await getProjectWithProgress(db, p.id);
    expect(res!.progress).toEqual({ done: 1, total: 2 }); // archived excluded
  });

  it("returns zero progress for a project with no tasks", async () => {
    const [p] = await db.insert(projects).values({ name: "Empty", orderIndex: "a0" }).returning();
    const res = await getProjectWithProgress(db, p.id);
    expect(res!.progress).toEqual({ done: 0, total: 0 });
  });

  it("returns null for a missing project", async () => {
    expect(await getProjectWithProgress(db, "nope")).toBeNull();
  });

  it("lists projects linked to a task", async () => {
    const [t] = await db.insert(tasks).values({ title: "T", orderIndex: "a0" }).returning();
    const [p1] = await db.insert(projects).values({ name: "Alpha", orderIndex: "a0" }).returning();
    const [p2] = await db.insert(projects).values({ name: "Beta", orderIndex: "a1" }).returning();
    await db.insert(taskProjects).values([
      { taskId: t.id, projectId: p1.id },
      { taskId: t.id, projectId: p2.id },
    ]);
    const list = await listProjectsForTask(db, t.id);
    expect(list.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
  });
});
