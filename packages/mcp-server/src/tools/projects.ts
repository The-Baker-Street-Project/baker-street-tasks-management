import { z } from "zod";
import { eq, and, asc, sql, isNull } from "drizzle-orm";
import { projects, taskProjects, tasks } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkIdempotency } from "../services/idempotency";
import { logAudit } from "../services/audit-logger";

const aiMetaParams = {
  agent_id: z.string().optional().describe("Identifier of the AI agent"),
  request_id: z.string().optional().describe("Idempotency key"),
  reason: z.string().optional().describe("Reason for change"),
};
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}
function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
}

async function getProjectById(db: Database, id: string) {
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] ?? null;
}
// Name must be unique within an area (null area = "No Area" bucket).
async function projectNameExists(db: Database, areaId: string | null, name: string, excludeId?: string) {
  const where = areaId === null
    ? and(isNull(projects.areaId), eq(projects.name, name))
    : and(eq(projects.areaId, areaId), eq(projects.name, name));
  const rows = await db.select({ id: projects.id }).from(projects).where(where);
  return rows.some((r) => r.id !== excludeId);
}
async function progressFor(db: Database, projectId: string) {
  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${tasks.status} = 'Done' then 1 else 0 end)`,
    })
    .from(taskProjects)
    .innerJoin(tasks, eq(taskProjects.taskId, tasks.id))
    .where(and(eq(taskProjects.projectId, projectId), sql`${tasks.status} <> 'Archived'`));
  return { done: Number(stats[0]?.done ?? 0), total: Number(stats[0]?.total ?? 0) };
}

export function registerProjectTools(server: McpServer, db: Database) {
  server.tool(
    "projects.list",
    "List projects, optionally filtered by area and with progress rollups",
    {
      area_id: z.string().optional().describe("Filter by area; omit for all"),
      include_progress: z.boolean().optional().describe("Add { done, total } rollup"),
    },
    async (params) => {
      const rows = params.area_id
        ? await db.select().from(projects).where(eq(projects.areaId, params.area_id)).orderBy(asc(projects.orderIndex))
        : await db.select().from(projects).orderBy(asc(projects.orderIndex));
      if (!params.include_progress) return ok(rows);
      const withProgress = [];
      for (const p of rows) withProgress.push({ ...p, progress: await progressFor(db, p.id) });
      return ok(withProgress);
    }
  );

  server.tool(
    "projects.create",
    "Create a project (name unique within its area; area_id nullable)",
    {
      name: z.string().describe("Project name"),
      area_id: z.string().optional().describe("Parent area UUID; omit for No Area"),
      description: z.string().optional(),
      color: z.string().optional().describe("Hex color"),
      ...aiMetaParams,
    },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const areaId = params.area_id ?? null;
      if (await projectNameExists(db, areaId, params.name)) return err("Project name already exists in this area");

      const [created] = await db
        .insert(projects)
        .values({
          areaId,
          name: params.name,
          description: params.description ?? null,
          color: params.color ?? null,
          orderIndex: Date.now().toString(36),
          createdBy: "mcp",
          agentId: params.agent_id ?? null,
          requestId: params.request_id ?? null,
          reason: params.reason ?? null,
        })
        .returning();

      await logAudit(db, {
        entityType: "project",
        entityId: created.id,
        action: "projects.create",
        before: null,
        after: created,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(created);
    }
  );

  server.tool(
    "projects.update",
    "Partially update a project (name/area/description/color); cross-area move allowed",
    {
      project_id: z.string().describe("Project UUID"),
      name: z.string().optional(),
      area_id: z.string().nullable().optional().describe("New area, or null for No Area"),
      description: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      ...aiMetaParams,
    },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const existing = await getProjectById(db, params.project_id);
      if (!existing) return err("Project not found");

      const nextAreaId = params.area_id !== undefined ? params.area_id : existing.areaId;
      const nextName = params.name ?? existing.name;
      if (
        (params.name !== undefined || params.area_id !== undefined) &&
        (await projectNameExists(db, nextAreaId, nextName, existing.id))
      ) {
        return err("Project name already exists in the target area");
      }

      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (params.name !== undefined) patch.name = params.name;
      if (params.area_id !== undefined) patch.areaId = params.area_id;
      if (params.description !== undefined) patch.description = params.description;
      if (params.color !== undefined) patch.color = params.color;

      const [updated] = await db.update(projects).set(patch).where(eq(projects.id, params.project_id)).returning();
      await logAudit(db, {
        entityType: "project",
        entityId: params.project_id,
        action: "projects.update",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(updated);
    }
  );

  server.tool(
    "projects.archive",
    "Archive a project (status only; keeps task links)",
    { project_id: z.string().describe("Project UUID"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const existing = await getProjectById(db, params.project_id);
      if (!existing) return err("Project not found");
      const [updated] = await db
        .update(projects)
        .set({ status: "Archived", updatedAt: new Date().toISOString() })
        .where(eq(projects.id, params.project_id))
        .returning();
      await logAudit(db, {
        entityType: "project",
        entityId: params.project_id,
        action: "projects.archive",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(updated);
    }
  );

  server.tool(
    "tasks.assign_project",
    "Link a task to a project (idempotent no-op on duplicate)",
    { task_id: z.string().describe("Task UUID"), project_id: z.string().describe("Project UUID"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      await db
        .insert(taskProjects)
        .values({ taskId: params.task_id, projectId: params.project_id })
        .onConflictDoNothing();
      const result = { assigned: true, task_id: params.task_id, project_id: params.project_id };
      await logAudit(db, {
        entityType: "project",
        entityId: params.project_id,
        action: "tasks.assign_project",
        before: null,
        after: result,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(result);
    }
  );

  server.tool(
    "tasks.unassign_project",
    "Unlink a task from a project",
    { task_id: z.string().describe("Task UUID"), project_id: z.string().describe("Project UUID"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      await db
        .delete(taskProjects)
        .where(and(eq(taskProjects.taskId, params.task_id), eq(taskProjects.projectId, params.project_id)));
      const result = { unassigned: true, task_id: params.task_id, project_id: params.project_id };
      await logAudit(db, {
        entityType: "project",
        entityId: params.project_id,
        action: "tasks.unassign_project",
        before: null,
        after: result,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(result);
    }
  );
}
