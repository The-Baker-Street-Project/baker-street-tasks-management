import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { captures, captureTags, tasks, taskTags } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkIdempotency } from "../services/idempotency";
import { logAudit } from "../services/audit-logger";

// ── shared enum values ──────────────────────────────────────────────

const captureStatusValues = ["Captured", "Reviewed", "Archived"] as const;
const contextValues = ["Home", "Work"] as const;
const taskStatusValues = ["Inbox", "Active", "Someday", "Done", "Archived"] as const;
const priorityValues = ["P0", "P1", "P2", "P3"] as const;

const aiMetaParams = {
  agent_id: z.string().optional().describe("Identifier of the AI agent"),
  request_id: z.string().optional().describe("Idempotency key"),
  reason: z.string().optional().describe("Reason for change"),
};

// ── helpers ─────────────────────────────────────────────────────────

async function getCaptureById(db: Database, id: string) {
  const rows = await db.select().from(captures).where(eq(captures.id, id)).limit(1);
  return rows[0] ?? null;
}

async function getCaptureTagIds(db: Database, captureId: string): Promise<string[]> {
  const rows = await db
    .select({ tagId: captureTags.tagId })
    .from(captureTags)
    .where(eq(captureTags.captureId, captureId));
  return rows.map((r) => r.tagId);
}

function captureSnapshot(capture: Record<string, unknown>, tagIds: string[]) {
  return { ...capture, tag_ids: tagIds };
}

async function attachCaptureTags(
  db: Database,
  captureId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0) return;
  await db.insert(captureTags).values(
    tagIds.map((tagId) => ({ captureId, tagId })),
  );
}

async function getLastTaskOrderIndex(db: Database): Promise<string | null> {
  const rows = await db
    .select({ orderIndex: tasks.orderIndex })
    .from(tasks)
    .orderBy(desc(tasks.orderIndex))
    .limit(1);
  return rows.length > 0 ? rows[0].orderIndex : null;
}

// ── register ────────────────────────────────────────────────────────

export function registerCaptureTools(server: McpServer, db: Database) {
  // ─── captures.create ───────────────────────────────────────────
  server.tool(
    "captures.create",
    "Create a new capture (quick inbox item)",
    {
      title: z.string().describe("Capture title"),
      body: z.string().optional().describe("Capture body / notes"),
      context: z.enum(contextValues).optional(),
      tag_ids: z.array(z.string().uuid()).optional().describe("Tag UUIDs to attach"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const [created] = await db
        .insert(captures)
        .values({
          title: params.title,
          body: params.body ?? null,
          context: params.context ?? null,
          source: "mcp",
          createdBy: "mcp",
          agentId: params.agent_id ?? null,
          requestId: params.request_id ?? null,
          reason: params.reason ?? null,
        })
        .returning();

      if (params.tag_ids && params.tag_ids.length > 0) {
        await attachCaptureTags(db, created.id, params.tag_ids);
      }

      const after = captureSnapshot(created as unknown as Record<string, unknown>, params.tag_ids ?? []);

      await logAudit(db, {
        entityType: "capture",
        entityId: created.id,
        action: "captures.create",
        before: null,
        after,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(after) }] };
    },
  );

  // ─── captures.get ──────────────────────────────────────────────
  server.tool(
    "captures.get",
    "Get a single capture by ID",
    {
      capture_id: z.string().uuid().describe("Capture UUID"),
    },
    async (params) => {
      const capture = await getCaptureById(db, params.capture_id);
      if (!capture) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Capture not found" }) }], isError: true };
      }
      const tagIds = await getCaptureTagIds(db, params.capture_id);
      const snapshot = captureSnapshot(capture as unknown as Record<string, unknown>, tagIds);
      return { content: [{ type: "text" as const, text: JSON.stringify(snapshot) }] };
    },
  );

  // ─── captures.update ──────────────────────────────────────────
  server.tool(
    "captures.update",
    "Update fields on a capture",
    {
      capture_id: z.string().uuid().describe("Capture UUID"),
      title: z.string().optional(),
      body: z.string().nullable().optional(),
      context: z.enum(contextValues).optional(),
      status: z.enum(captureStatusValues).optional(),
      nudge_at: z.string().nullable().optional().describe("ISO-8601 or null to clear"),
      tag_ids: z.array(z.string().uuid()).optional().describe("Replace all tags with these"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getCaptureById(db, params.capture_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Capture not found" }) }], isError: true };
      }
      const oldTagIds = await getCaptureTagIds(db, params.capture_id);
      const before = captureSnapshot(existing as unknown as Record<string, unknown>, oldTagIds);

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (params.title !== undefined) updates.title = params.title;
      if (params.body !== undefined) updates.body = params.body;
      if (params.context !== undefined) updates.context = params.context;
      if (params.status !== undefined) updates.status = params.status;
      if (params.nudge_at !== undefined) updates.nudgeAt = params.nudge_at ? new Date(params.nudge_at) : null;

      const [updated] = await db
        .update(captures)
        .set(updates)
        .where(eq(captures.id, params.capture_id))
        .returning();

      if (params.tag_ids !== undefined) {
        await db.delete(captureTags).where(eq(captureTags.captureId, params.capture_id));
        await attachCaptureTags(db, params.capture_id, params.tag_ids);
      }

      const newTagIds = params.tag_ids ?? oldTagIds;
      const after = captureSnapshot(updated as unknown as Record<string, unknown>, newTagIds);

      await logAudit(db, {
        entityType: "capture",
        entityId: params.capture_id,
        action: "captures.update",
        before,
        after,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(after) }] };
    },
  );

  // ─── captures.pin ──────────────────────────────────────────────
  server.tool(
    "captures.pin",
    "Pin a capture to the top of the list",
    {
      capture_id: z.string().uuid().describe("Capture UUID"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getCaptureById(db, params.capture_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Capture not found" }) }], isError: true };
      }

      const [updated] = await db
        .update(captures)
        .set({ pinned: true, updatedAt: new Date() })
        .where(eq(captures.id, params.capture_id))
        .returning();

      await logAudit(db, {
        entityType: "capture",
        entityId: params.capture_id,
        action: "captures.pin",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    },
  );

  // ─── captures.unpin ────────────────────────────────────────────
  server.tool(
    "captures.unpin",
    "Unpin a capture",
    {
      capture_id: z.string().uuid().describe("Capture UUID"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getCaptureById(db, params.capture_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Capture not found" }) }], isError: true };
      }

      const [updated] = await db
        .update(captures)
        .set({ pinned: false, updatedAt: new Date() })
        .where(eq(captures.id, params.capture_id))
        .returning();

      await logAudit(db, {
        entityType: "capture",
        entityId: params.capture_id,
        action: "captures.unpin",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    },
  );

  // ─── captures.review ──────────────────────────────────────────
  server.tool(
    "captures.review",
    "Mark a capture as reviewed",
    {
      capture_id: z.string().uuid().describe("Capture UUID"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getCaptureById(db, params.capture_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Capture not found" }) }], isError: true };
      }

      const [updated] = await db
        .update(captures)
        .set({ status: "Reviewed", updatedAt: new Date() })
        .where(eq(captures.id, params.capture_id))
        .returning();

      await logAudit(db, {
        entityType: "capture",
        entityId: params.capture_id,
        action: "captures.review",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    },
  );

  // ─── captures.archive ─────────────────────────────────────────
  server.tool(
    "captures.archive",
    "Archive a capture",
    {
      capture_id: z.string().uuid().describe("Capture UUID"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getCaptureById(db, params.capture_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Capture not found" }) }], isError: true };
      }

      const [updated] = await db
        .update(captures)
        .set({ status: "Archived", updatedAt: new Date() })
        .where(eq(captures.id, params.capture_id))
        .returning();

      await logAudit(db, {
        entityType: "capture",
        entityId: params.capture_id,
        action: "captures.archive",
        before: existing,
        after: updated,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(updated) }] };
    },
  );

  // ─── captures.promote_to_task ─────────────────────────────────
  server.tool(
    "captures.promote_to_task",
    "Convert a capture into a full task, optionally overriding fields",
    {
      capture_id: z.string().uuid().describe("Capture UUID to promote"),
      title: z.string().optional().describe("Override capture title"),
      notes: z.string().optional(),
      status: z.enum(taskStatusValues).optional(),
      context: z.enum(contextValues).optional(),
      priority: z.enum(priorityValues).optional(),
      due_at: z.string().optional(),
      start_at: z.string().optional(),
      estimate: z.number().int().optional(),
      is_focus: z.boolean().optional(),
      tag_ids: z.array(z.string().uuid()).optional(),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const capture = await getCaptureById(db, params.capture_id);
      if (!capture) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Capture not found" }) }], isError: true };
      }

      const lastIdx = await getLastTaskOrderIndex(db);
      const orderIndex = generateKeyBetween(lastIdx, null);

      // Create the task from capture data, with optional overrides
      const [task] = await db
        .insert(tasks)
        .values({
          title: params.title ?? capture.title,
          notes: params.notes ?? capture.body ?? null,
          status: params.status ?? "Inbox",
          context: params.context ?? capture.context ?? null,
          priority: params.priority ?? "P3",
          dueAt: params.due_at ? new Date(params.due_at) : null,
          startAt: params.start_at ? new Date(params.start_at) : null,
          estimate: params.estimate ?? null,
          isFocus: params.is_focus ?? false,
          orderIndex,
          createdBy: "mcp",
          agentId: params.agent_id ?? null,
          sourceMessageId: capture.sourceMessageId,
          requestId: params.request_id ?? null,
          reason: params.reason ?? null,
        })
        .returning();

      // Transfer tags from capture to task, plus any additional
      const captureTagIds = await getCaptureTagIds(db, params.capture_id);
      const allTagIds = Array.from(new Set([...captureTagIds, ...(params.tag_ids ?? [])]));
      if (allTagIds.length > 0) {
        await db.insert(taskTags).values(
          allTagIds.map((tagId) => ({ taskId: task.id, tagId })),
        );
      }

      // Archive the capture
      const [archivedCapture] = await db
        .update(captures)
        .set({ status: "Archived", updatedAt: new Date() })
        .where(eq(captures.id, params.capture_id))
        .returning();

      // Log the capture archival
      await logAudit(db, {
        entityType: "capture",
        entityId: params.capture_id,
        action: "captures.promote_to_task",
        before: capture,
        after: archivedCapture,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      // Log the task creation
      await logAudit(db, {
        entityType: "task",
        entityId: task.id,
        action: "captures.promote_to_task",
        before: null,
        after: { ...task, tag_ids: allTagIds, promoted_from_capture: params.capture_id },
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            task: { ...(task as unknown as Record<string, unknown>), tag_ids: allTagIds },
            archived_capture_id: params.capture_id,
          }),
        }],
      };
    },
  );

  // ─── captures.extract_tasks ───────────────────────────────────
  server.tool(
    "captures.extract_tasks",
    "Extract multiple tasks from a single capture, archiving the capture afterwards",
    {
      capture_id: z.string().uuid().describe("Capture UUID to extract from"),
      tasks: z.array(z.object({
        title: z.string(),
        notes: z.string().optional(),
        status: z.enum(taskStatusValues).optional(),
        context: z.enum(contextValues).optional(),
        priority: z.enum(priorityValues).optional(),
        due_at: z.string().optional(),
        tag_ids: z.array(z.string().uuid()).optional(),
      })).min(1).describe("Array of tasks to create from this capture"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const capture = await getCaptureById(db, params.capture_id);
      if (!capture) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Capture not found" }) }], isError: true };
      }

      const createdTasks: Record<string, unknown>[] = [];

      // Get starting order index
      let prevIdx = await getLastTaskOrderIndex(db);

      for (const taskDef of params.tasks) {
        const orderIndex = generateKeyBetween(prevIdx, null);
        prevIdx = orderIndex;

        const [task] = await db
          .insert(tasks)
          .values({
            title: taskDef.title,
            notes: taskDef.notes ?? null,
            status: taskDef.status ?? "Inbox",
            context: taskDef.context ?? capture.context ?? null,
            priority: taskDef.priority ?? "P3",
            dueAt: taskDef.due_at ? new Date(taskDef.due_at) : null,
            startAt: null,
            estimate: null,
            isFocus: false,
            orderIndex,
            createdBy: "mcp",
            agentId: params.agent_id ?? null,
            sourceMessageId: capture.sourceMessageId,
            requestId: params.request_id ?? null,
            reason: params.reason ?? null,
          })
          .returning();

        if (taskDef.tag_ids && taskDef.tag_ids.length > 0) {
          await db.insert(taskTags).values(
            taskDef.tag_ids.map((tagId) => ({ taskId: task.id, tagId })),
          );
        }

        await logAudit(db, {
          entityType: "task",
          entityId: task.id,
          action: "captures.extract_tasks",
          before: null,
          after: { ...task, tag_ids: taskDef.tag_ids ?? [], extracted_from_capture: params.capture_id },
          agentId: params.agent_id,
          requestId: params.request_id,
          reason: params.reason,
        });

        createdTasks.push({ ...(task as unknown as Record<string, unknown>), tag_ids: taskDef.tag_ids ?? [] });
      }

      // Archive the capture
      const [archivedCapture] = await db
        .update(captures)
        .set({ status: "Archived", updatedAt: new Date() })
        .where(eq(captures.id, params.capture_id))
        .returning();

      await logAudit(db, {
        entityType: "capture",
        entityId: params.capture_id,
        action: "captures.extract_tasks",
        before: capture,
        after: archivedCapture,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            created_tasks: createdTasks,
            archived_capture_id: params.capture_id,
          }),
        }],
      };
    },
  );
}
