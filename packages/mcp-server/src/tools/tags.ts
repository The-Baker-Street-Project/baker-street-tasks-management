import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { tags, taskTags, captureTags } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkIdempotency } from "../services/idempotency";
import { logAudit } from "../services/audit-logger";

const aiMetaParams = {
  agent_id: z.string().optional().describe("Identifier of the AI agent"),
  request_id: z.string().optional().describe("Idempotency key"),
  reason: z.string().optional().describe("Reason for change"),
};

// ── helpers ─────────────────────────────────────────────────────────

async function getTagById(db: Database, id: string) {
  const rows = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return rows[0] ?? null;
}

// ── register ────────────────────────────────────────────────────────

export function registerTagTools(server: McpServer, db: Database) {
  // ─── tags.list ─────────────────────────────────────────────────
  server.tool(
    "tags.list",
    "List all tags with optional usage counts",
    {
      include_counts: z.boolean().optional().describe("Include task/capture usage counts"),
    },
    async (params) => {
      if (params.include_counts) {
        // Query tags with count of associated tasks and captures
        const rows = await db
          .select({
            id: tags.id,
            name: tags.name,
            color: tags.color,
            createdAt: tags.createdAt,
            taskCount: sql<number>`(SELECT count(*) FROM task_tags WHERE task_tags.tag_id = ${tags.id})`.as("task_count"),
            captureCount: sql<number>`(SELECT count(*) FROM capture_tags WHERE capture_tags.tag_id = ${tags.id})`.as("capture_count"),
          })
          .from(tags)
          .orderBy(tags.name);

        return { content: [{ type: "text" as const, text: JSON.stringify(rows) }] };
      }

      const rows = await db.select().from(tags).orderBy(tags.name);
      return { content: [{ type: "text" as const, text: JSON.stringify(rows) }] };
    },
  );

  // ─── tags.create ───────────────────────────────────────────────
  server.tool(
    "tags.create",
    "Create a new tag",
    {
      name: z.string().describe("Tag name (must be unique)"),
      color: z.string().optional().describe("Hex color code"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const [created] = await db
        .insert(tags)
        .values({
          name: params.name,
          color: params.color ?? null,
        })
        .returning();

      await logAudit(db, {
        entityType: "tag",
        entityId: created.id,
        action: "tags.create",
        before: null,
        after: created,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(created) }] };
    },
  );

  // ─── tags.rename ───────────────────────────────────────────────
  server.tool(
    "tags.rename",
    "Rename an existing tag",
    {
      tag_id: z.string().uuid().describe("Tag UUID"),
      name: z.string().describe("New tag name"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getTagById(db, params.tag_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Tag not found" }) }], isError: true };
      }

      const [updated] = await db
        .update(tags)
        .set({ name: params.name })
        .where(eq(tags.id, params.tag_id))
        .returning();

      await logAudit(db, {
        entityType: "tag",
        entityId: params.tag_id,
        action: "tags.rename",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    },
  );

  // ─── tags.merge ────────────────────────────────────────────────
  server.tool(
    "tags.merge",
    "Merge source tag into target tag: reassign all associations, then delete source",
    {
      source_tag_id: z.string().uuid().describe("Tag to merge FROM (will be deleted)"),
      target_tag_id: z.string().uuid().describe("Tag to merge INTO (will remain)"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const source = await getTagById(db, params.source_tag_id);
      if (!source) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Source tag not found" }) }], isError: true };
      }
      const target = await getTagById(db, params.target_tag_id);
      if (!target) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Target tag not found" }) }], isError: true };
      }

      // Reassign task_tags: update source -> target, ignoring conflicts
      await db.execute(sql`
        UPDATE task_tags SET tag_id = ${params.target_tag_id}
        WHERE tag_id = ${params.source_tag_id}
        AND task_id NOT IN (
          SELECT task_id FROM task_tags WHERE tag_id = ${params.target_tag_id}
        )
      `);
      // Delete remaining duplicates
      await db.delete(taskTags).where(eq(taskTags.tagId, params.source_tag_id));

      // Reassign capture_tags similarly
      await db.execute(sql`
        UPDATE capture_tags SET tag_id = ${params.target_tag_id}
        WHERE tag_id = ${params.source_tag_id}
        AND capture_id NOT IN (
          SELECT capture_id FROM capture_tags WHERE tag_id = ${params.target_tag_id}
        )
      `);
      await db.delete(captureTags).where(eq(captureTags.tagId, params.source_tag_id));

      // Delete the source tag
      await db.delete(tags).where(eq(tags.id, params.source_tag_id));

      await logAudit(db, {
        entityType: "tag",
        entityId: params.source_tag_id,
        action: "tags.merge",
        before: { source, target },
        after: { merged_into: target, deleted: source },
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            merged: true,
            deleted_tag: source,
            surviving_tag: target,
          }),
        }],
      };
    },
  );
}
