"use server";

import { createDb } from "@baker-street/db/client";
import { areas, projects, taskProjects } from "@baker-street/db/schema";
import {
  listAreasWithProjects,
  getProjectWithProgress,
  listProjectsForTask as listProjectsForTaskQuery,
} from "@baker-street/db/queries";
import { eq, and, asc, isNull, inArray } from "drizzle-orm";
import type { Area, Project } from "@/types";

function getDb() {
  return createDb();
}
function nextOrderIndex() {
  return Date.now().toString(36);
}
function mapArea(row: typeof areas.$inferSelect): Area {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    status: row.status,
    orderIndex: row.orderIndex,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
function mapProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    areaId: row.areaId,
    name: row.name,
    description: row.description,
    color: row.color,
    status: row.status,
    orderIndex: row.orderIndex,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

// ── Areas ──────────────────────────────────────────────────────
export async function listAreas(): Promise<Area[]> {
  const db = getDb();
  const rows = await db.select().from(areas).where(eq(areas.status, "Active")).orderBy(asc(areas.orderIndex));
  return rows.map(mapArea);
}
export async function createArea(input: { name: string; color?: string | null }): Promise<Area> {
  const db = getDb();
  const [row] = await db
    .insert(areas)
    .values({ name: input.name, color: input.color ?? null, orderIndex: nextOrderIndex(), createdBy: "web_ui" })
    .returning();
  return mapArea(row);
}
export async function renameArea(id: string, name: string): Promise<Area> {
  const db = getDb();
  const [row] = await db.update(areas).set({ name, updatedAt: new Date().toISOString() }).where(eq(areas.id, id)).returning();
  return mapArea(row);
}
export async function archiveArea(id: string): Promise<void> {
  const db = getDb();
  await db.update(areas).set({ status: "Archived", updatedAt: new Date().toISOString() }).where(eq(areas.id, id));
}

// ── Projects ───────────────────────────────────────────────────
export async function listProjects(areaId?: string | null): Promise<Project[]> {
  const db = getDb();
  const where =
    areaId === undefined
      ? eq(projects.status, "Active")
      : areaId === null
        ? and(isNull(projects.areaId), eq(projects.status, "Active"))
        : and(eq(projects.areaId, areaId), eq(projects.status, "Active"));
  const rows = await db.select().from(projects).where(where).orderBy(asc(projects.orderIndex));
  return rows.map(mapProject);
}
export async function createProject(input: {
  name: string;
  areaId?: string | null;
  description?: string | null;
  color?: string | null;
}): Promise<Project> {
  const db = getDb();
  const [row] = await db
    .insert(projects)
    .values({
      name: input.name,
      areaId: input.areaId ?? null,
      description: input.description ?? null,
      color: input.color ?? null,
      orderIndex: nextOrderIndex(),
      createdBy: "web_ui",
    })
    .returning();
  return mapProject(row);
}
export async function updateProject(
  id: string,
  patch: { name?: string; areaId?: string | null; description?: string | null; color?: string | null }
): Promise<Project> {
  const db = getDb();
  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.areaId !== undefined) data.areaId = patch.areaId;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.color !== undefined) data.color = patch.color;
  const [row] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
  return mapProject(row);
}
export async function archiveProject(id: string): Promise<void> {
  const db = getDb();
  await db.update(projects).set({ status: "Archived", updatedAt: new Date().toISOString() }).where(eq(projects.id, id));
}

// ── Tree + detail ──────────────────────────────────────────────
export async function getProjectsTree() {
  const db = getDb();
  const tree = await listAreasWithProjects(db);
  return tree.map((node) => ({
    id: node.id,
    name: node.name,
    color: node.color,
    projects: node.projects.map(mapProject),
  }));
}
export async function getProjectDetail(id: string) {
  const db = getDb();
  const res = await getProjectWithProgress(db, id);
  if (!res) return null;
  return { project: mapProject(res.project), progress: res.progress };
}

// ── Task ↔ Project links ───────────────────────────────────────
export async function listProjectsForTask(taskId: string): Promise<Project[]> {
  const db = getDb();
  const rows = await listProjectsForTaskQuery(db, taskId);
  return rows.map(mapProject);
}
export async function setTaskProjects(taskId: string, projectIds: string[]): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(taskProjects).where(eq(taskProjects.taskId, taskId));
  const have = new Set(existing.map((r) => r.projectId));
  const want = new Set(projectIds);
  const toAdd = projectIds.filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));
  if (toAdd.length > 0) {
    await db.insert(taskProjects).values(toAdd.map((projectId) => ({ taskId, projectId }))).onConflictDoNothing();
  }
  if (toRemove.length > 0) {
    await db.delete(taskProjects).where(and(eq(taskProjects.taskId, taskId), inArray(taskProjects.projectId, toRemove)));
  }
}
