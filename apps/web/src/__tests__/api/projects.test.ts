import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createTestDb } from "@baker-street/db/test-helpers";
import { areas, projects, taskProjects, tasks } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";

let testDb: Database;
vi.mock("@baker-street/db/client", () => ({ createDb: () => testDb }));

describe("Web server actions — projects", () => {
  let cleanup: () => Promise<void>;
  beforeAll(async () => {
    const h = await createTestDb();
    testDb = h.db;
    cleanup = h.cleanup;
  });
  afterAll(async () => { await cleanup(); });
  beforeEach(async () => {
    await testDb.delete(taskProjects);
    await testDb.delete(projects);
    await testDb.delete(areas);
    await testDb.delete(tasks);
  });

  it("creates an area and a project under it", async () => {
    const { createArea, createProject, getProjectsTree } = await import("../../lib/api/projects");
    const area = await createArea({ name: "3D Printing" });
    await createProject({ name: "Bracket", areaId: area.id });
    const tree = await getProjectsTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].projects[0].name).toBe("Bracket");
  });

  it("setTaskProjects diff-applies links (add, remove, no-change)", async () => {
    const { createProject, setTaskProjects, listProjectsForTask } = await import("../../lib/api/projects");
    const [t] = await testDb.insert(tasks).values({ title: "T", orderIndex: "a0" }).returning();
    const p1 = await createProject({ name: "P1" });
    const p2 = await createProject({ name: "P2" });
    await setTaskProjects(t.id, [p1.id]);
    expect((await listProjectsForTask(t.id)).map((p) => p.id)).toEqual([p1.id].sort());
    await setTaskProjects(t.id, [p2.id]); // remove p1, add p2
    const after = (await listProjectsForTask(t.id)).map((p) => p.id);
    expect(after).toEqual([p2.id]);
  });

  it("getProjectDetail returns progress", async () => {
    const { createProject, getProjectDetail } = await import("../../lib/api/projects");
    const p = await createProject({ name: "P" });
    const [t] = await testDb.insert(tasks).values({ title: "t", orderIndex: "a0", status: "Done" }).returning();
    await testDb.insert(taskProjects).values({ taskId: t.id, projectId: p.id });
    const detail = await getProjectDetail(p.id);
    expect(detail!.progress).toEqual({ done: 1, total: 1 });
  });
});
