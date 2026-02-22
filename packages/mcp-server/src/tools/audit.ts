import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { auditLog } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const entityTypeValues = ["task", "subtask", "capture", "tag", "saved_view"] as const;

// ── register ────────────────────────────────────────────────────────

export function registerAuditTools(server: McpServer, db: Database) {
  // ─── audit.list ────────────────────────────────────────────────
  server.tool(
    "audit.list",
    "List audit log entries with optional filters",
    {
      entity_type: z.enum(entityTypeValues).optional().describe("Filter by entity type"),
      entity_id: z.string().uuid().optional().describe("Filter by entity UUID"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (default 50)"),
      offset: z.number().int().min(0).optional().describe("Offset for pagination"),
    },
    async (params) => {
      const limit = params.limit ?? 50;
      const offset = params.offset ?? 0;
      const conditions: ReturnType<typeof eq>[] = [];

      if (params.entity_type) {
        conditions.push(eq(auditLog.entityType, params.entity_type));
      }
      if (params.entity_id) {
        conditions.push(eq(auditLog.entityId, params.entity_id));
      }

      const rows = await db
        .select()
        .from(auditLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset);

      return { content: [{ type: "text" as const, text: JSON.stringify(rows) }] };
    },
  );

  // ─── audit.get ─────────────────────────────────────────────────
  server.tool(
    "audit.get",
    "Get a single audit log entry by ID",
    {
      audit_id: z.string().uuid().describe("Audit log entry UUID"),
    },
    async (params) => {
      const rows = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.id, params.audit_id))
        .limit(1);

      if (rows.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Audit entry not found" }) }], isError: true };
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(rows[0]) }] };
    },
  );
}
