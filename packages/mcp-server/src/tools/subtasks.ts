import { z } from "zod";
import { eq, and, desc, asc } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { subtasks, tasks } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkIdempotency } from "../services/idempotency";
import { logAudit } from "../services/audit-logger";

// ── helpers ─────────────────────────────────────────────────────────

async function getSubtaskById(db: Database, id: string) {
  const rows = await db.select().from(subtasks).where(eq(subtasks.id, id)).limit(1);
  return rows[0] ?? null;
}

async function getLastSubtaskOrderIndex(
  db: Database,
  taskId: string,
): Promise<string | null> {
  const rows = await db
    .select({ orderIndex: subtasks.orderIndex })
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(desc(subtasks.orderIndex))
    .limit(1);
  return rows.length > 0 ? rows[0].orderIndex : null;
}

// ── AI metadata params ──────────────────────────────────────────────

const aiMetaParams = {
  agent_id: z.string().optional().describe("Identifier of the AI agent"),
  request_id: z.string().optional().describe("Idempotency key"),
  reason: z.string().optional().describe("Reason for change"),
};

// ── register ────────────────────────────────────────────────────────

export function registerSubtaskTools(server: McpServer, db: Database) {
  // ─── subtasks.add ──────────────────────────────────────────────
  server.tool(
    "subtasks.add",
    "Add a subtask to an existing task",
    {
      task_id: z.string().uuid().describe("Parent task UUID"),
      title: z.string().describe("Subtask title"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      // Verify parent task exists
      const parentRows = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, params.task_id)).limit(1);
      if (parentRows.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Parent task not found" }) }], isError: true };
      }

      const lastIdx = await getLastSubtaskOrderIndex(db, params.task_id);
      const orderIndex = generateKeyBetween(lastIdx, null);

      const [created] = await db
        .insert(subtasks)
        .values({
          taskId: params.task_id,
          title: params.title,
          orderIndex,
          createdBy: "mcp",
          agentId: params.agent_id ?? null,
          requestId: params.request_id ?? null,
          reason: params.reason ?? null,
        })
        .returning();

      await logAudit(db, {
        entityType: "subtask",
        entityId: created.id,
        action: "subtasks.add",
        before: null,
        after: created,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(created) }] };
    },
  );

  // ─── subtasks.toggle ───────────────────────────────────────────
  server.tool(
    "subtasks.toggle",
    "Toggle a subtask's done status",
    {
      subtask_id: z.string().uuid().describe("Subtask UUID"),
      done: z.boolean().describe("New done state"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getSubtaskById(db, params.subtask_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Subtask not found" }) }], isError: true };
      }

      const [updated] = await db
        .update(subtasks)
        .set({ done: params.done, updatedAt: new Date().toISOString() })
        .where(eq(subtasks.id, params.subtask_id))
        .returning();

      await logAudit(db, {
        entityType: "subtask",
        entityId: params.subtask_id,
        action: "subtasks.toggle",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    },
  );

  // ─── subtasks.reorder ──────────────────────────────────────────
  server.tool(
    "subtasks.reorder",
    "Move a subtask to a new position among its siblings",
    {
      subtask_id: z.string().uuid().describe("Subtask UUID"),
      after_id: z.string().uuid().optional().describe("Place after this subtask"),
      before_id: z.string().uuid().optional().describe("Place before this subtask"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getSubtaskById(db, params.subtask_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Subtask not found" }) }], isError: true };
      }

      let afterIdx: string | null = null;
      let beforeIdx: string | null = null;

      if (params.after_id) {
        const afterSub = await getSubtaskById(db, params.after_id);
        if (afterSub) afterIdx = afterSub.orderIndex;
      }
      if (params.before_id) {
        const beforeSub = await getSubtaskById(db, params.before_id);
        if (beforeSub) beforeIdx = beforeSub.orderIndex;
      }

      const orderIndex = generateKeyBetween(afterIdx, beforeIdx);

      const [updated] = await db
        .update(subtasks)
        .set({ orderIndex, updatedAt: new Date().toISOString() })
        .where(eq(subtasks.id, params.subtask_id))
        .returning();

      await logAudit(db, {
        entityType: "subtask",
        entityId: params.subtask_id,
        action: "subtasks.reorder",
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
