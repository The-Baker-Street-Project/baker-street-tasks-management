import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { areas, projects } from "@baker-street/db/schema";
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

async function getAreaById(db: Database, id: string) {
  const rows = await db.select().from(areas).where(eq(areas.id, id)).limit(1);
  return rows[0] ?? null;
}
async function areaNameExists(db: Database, name: string) {
  const rows = await db.select({ id: areas.id }).from(areas).where(eq(areas.name, name)).limit(1);
  return rows.length > 0;
}

export function registerAreaTools(server: McpServer, db: Database) {
  server.tool(
    "areas.list",
    "List areas ordered by orderIndex, optionally nesting their projects",
    { include_projects: z.boolean().optional().describe("Nest each area's projects") },
    async (params) => {
      const areaRows = await db.select().from(areas).orderBy(asc(areas.orderIndex));
      if (!params.include_projects) return ok(areaRows);
      const withProjects = [];
      for (const a of areaRows) {
        const projs = await db
          .select()
          .from(projects)
          .where(eq(projects.areaId, a.id))
          .orderBy(asc(projects.orderIndex));
        withProjects.push({ ...a, projects: projs });
      }
      return ok(withProjects);
    }
  );

  server.tool(
    "areas.create",
    "Create a new area (name unique globally)",
    { name: z.string().describe("Area name"), color: z.string().optional().describe("Hex color"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      if (await areaNameExists(db, params.name)) return err("Area name already exists");

      const [created] = await db
        .insert(areas)
        .values({
          name: params.name,
          color: params.color ?? null,
          orderIndex: Date.now().toString(36),
          createdBy: "mcp",
          agentId: params.agent_id ?? null,
          requestId: params.request_id ?? null,
          reason: params.reason ?? null,
        })
        .returning();

      await logAudit(db, {
        entityType: "area",
        entityId: created.id,
        action: "areas.create",
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
    "areas.rename",
    "Rename an area (re-checks global uniqueness)",
    { area_id: z.string().describe("Area UUID"), name: z.string().describe("New name"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const existing = await getAreaById(db, params.area_id);
      if (!existing) return err("Area not found");
      if (params.name !== existing.name && (await areaNameExists(db, params.name)))
        return err("Area name already exists");

      const [updated] = await db
        .update(areas)
        .set({ name: params.name, updatedAt: new Date().toISOString() })
        .where(eq(areas.id, params.area_id))
        .returning();

      await logAudit(db, {
        entityType: "area",
        entityId: params.area_id,
        action: "areas.rename",
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
    "areas.archive",
    "Archive an area (status only; hides area + projects, keeps links)",
    { area_id: z.string().describe("Area UUID"), ...aiMetaParams },
    async (params) => {
      const idem = await checkIdempotency(db, params.request_id);
      if (idem.alreadyProcessed) return ok(idem.result);
      const existing = await getAreaById(db, params.area_id);
      if (!existing) return err("Area not found");

      const [updated] = await db
        .update(areas)
        .set({ status: "Archived", updatedAt: new Date().toISOString() })
        .where(eq(areas.id, params.area_id))
        .returning();

      await logAudit(db, {
        entityType: "area",
        entityId: params.area_id,
        action: "areas.archive",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });
      return ok(updated);
    }
  );
}
