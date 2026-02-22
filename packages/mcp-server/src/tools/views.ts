import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { savedViews } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkIdempotency } from "../services/idempotency";
import { logAudit } from "../services/audit-logger";

const savedViewTypeValues = ["Tasks", "Captures", "KanbanLane"] as const;

const aiMetaParams = {
  agent_id: z.string().optional().describe("Identifier of the AI agent"),
  request_id: z.string().optional().describe("Idempotency key"),
  reason: z.string().optional().describe("Reason for change"),
};

// ── helpers ─────────────────────────────────────────────────────────

async function getViewById(db: Database, id: string) {
  const rows = await db.select().from(savedViews).where(eq(savedViews.id, id)).limit(1);
  return rows[0] ?? null;
}

// ── register ────────────────────────────────────────────────────────

export function registerViewTools(server: McpServer, db: Database) {
  // ─── views.list ────────────────────────────────────────────────
  server.tool(
    "views.list",
    "List all saved views ordered by sort_order",
    {},
    async () => {
      const rows = await db
        .select()
        .from(savedViews)
        .orderBy(asc(savedViews.sortOrder));
      return { content: [{ type: "text" as const, text: JSON.stringify(rows) }] };
    },
  );

  // ─── views.create ──────────────────────────────────────────────
  server.tool(
    "views.create",
    "Create a new saved view",
    {
      name: z.string().describe("View name"),
      type: z.enum(savedViewTypeValues).describe("View type"),
      filter_definition: z.record(z.unknown()).optional().describe("JSON filter definition"),
      sort_order: z.number().int().optional().describe("Display order"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const [created] = await db
        .insert(savedViews)
        .values({
          name: params.name,
          type: params.type,
          filterDefinition: params.filter_definition ?? null,
          sortOrder: params.sort_order ?? 0,
        })
        .returning();

      await logAudit(db, {
        entityType: "saved_view",
        entityId: created.id,
        action: "views.create",
        before: null,
        after: created,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(created) }] };
    },
  );

  // ─── views.update ──────────────────────────────────────────────
  server.tool(
    "views.update",
    "Update a saved view's name, filters, or sort order",
    {
      view_id: z.string().uuid().describe("Saved view UUID"),
      name: z.string().optional(),
      filter_definition: z.record(z.unknown()).optional(),
      sort_order: z.number().int().optional(),
      is_hidden: z.boolean().optional(),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getViewById(db, params.view_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "View not found" }) }], isError: true };
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (params.name !== undefined) updates.name = params.name;
      if (params.filter_definition !== undefined) updates.filterDefinition = params.filter_definition;
      if (params.sort_order !== undefined) updates.sortOrder = params.sort_order;
      if (params.is_hidden !== undefined) updates.isHidden = params.is_hidden;

      const [updated] = await db
        .update(savedViews)
        .set(updates)
        .where(eq(savedViews.id, params.view_id))
        .returning();

      await logAudit(db, {
        entityType: "saved_view",
        entityId: params.view_id,
        action: "views.update",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    },
  );
}
