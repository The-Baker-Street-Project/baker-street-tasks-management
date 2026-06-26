import { asc, eq, and, ne, isNull, sql } from "drizzle-orm";
import { areas } from "../schema/areas";
import { projects, taskProjects } from "../schema/projects";
import { tasks } from "../schema/tasks";
import type { Database } from "../client";

type Project = typeof projects.$inferSelect;

export interface AreaWithProjects {
  id: string | null;
  name: string;
  color: string | null;
  orderIndex: string | null;
  projects: Project[];
}

export async function listAreasWithProjects(db: Database): Promise<AreaWithProjects[]> {
  const areaRows = await db
    .select()
    .from(areas)
    .where(eq(areas.status, "Active"))
    .orderBy(asc(areas.orderIndex));

  const result: AreaWithProjects[] = [];
  for (const area of areaRows) {
    const projs = await db
      .select()
      .from(projects)
      .where(and(eq(projects.areaId, area.id), eq(projects.status, "Active")))
      .orderBy(asc(projects.orderIndex));
    result.push({
      id: area.id,
      name: area.name,
      color: area.color,
      orderIndex: area.orderIndex,
      projects: projs,
    });
  }

  const ungrouped = await db
    .select()
    .from(projects)
    .where(and(isNull(projects.areaId), eq(projects.status, "Active")))
    .orderBy(asc(projects.orderIndex));
  if (ungrouped.length > 0) {
    result.push({ id: null, name: "No Area", color: null, orderIndex: null, projects: ungrouped });
  }
  return result;
}

export async function getProjectWithProgress(
  db: Database,
  projectId: string
): Promise<{ project: Project; progress: { done: number; total: number } } | null> {
  const rows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (rows.length === 0) return null;

  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${tasks.status} = 'Done' then 1 else 0 end)`,
    })
    .from(taskProjects)
    .innerJoin(tasks, eq(taskProjects.taskId, tasks.id))
    .where(and(eq(taskProjects.projectId, projectId), ne(tasks.status, "Archived")));

  const total = Number(stats[0]?.total ?? 0);
  const done = Number(stats[0]?.done ?? 0);
  return { project: rows[0], progress: { done, total } };
}

export async function listProjectsForTask(db: Database, taskId: string): Promise<Project[]> {
  return db
    .select({
      id: projects.id,
      areaId: projects.areaId,
      name: projects.name,
      description: projects.description,
      color: projects.color,
      status: projects.status,
      orderIndex: projects.orderIndex,
      createdBy: projects.createdBy,
      agentId: projects.agentId,
      requestId: projects.requestId,
      reason: projects.reason,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(taskProjects)
    .innerJoin(projects, eq(taskProjects.projectId, projects.id))
    .where(eq(taskProjects.taskId, taskId))
    .orderBy(asc(projects.name));
}
