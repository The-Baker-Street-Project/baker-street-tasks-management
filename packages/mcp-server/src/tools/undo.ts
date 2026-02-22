import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { auditLog, tasks, subtasks, captures, tags, savedViews, taskTags, captureTags } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logAudit, type EntityType } from "../services/audit-logger";

const entityTypeValues = ["task", "subtask", "capture", "tag", "saved_view"] as const;

const aiMetaParams = {
  agent_id: z.string().optional().describe("Identifier of the AI agent"),
  request_id: z.string().optional().describe("Idempotency key"),
  reason: z.string().optional().describe("Reason for undo"),
};

// ── helpers ─────────────────────────────────────────────────────────

/**
 * Restore an entity to the state captured in the `before` snapshot of an
 * audit entry. Handles both "undo a create" (delete) and "undo an update"
 * (restore previous field values).
 */
async function restoreEntity(
  db: Database,
  entityType: EntityType,
  entityId: string,
  beforeSnapshot: Record<string, unknown> | null,
  afterSnapshot: Record<string, unknown> | null,
): Promise<{ restored: boolean; current: unknown }> {
  // If before is null this was a create — we need to delete the entity
  if (beforeSnapshot === null) {
    switch (entityType) {
      case "task":
        await db.delete(taskTags).where(eq(taskTags.taskId, entityId));
        await db.delete(tasks).where(eq(tasks.id, entityId));
        break;
      case "subtask":
        await db.delete(subtasks).where(eq(subtasks.id, entityId));
        break;
      case "capture":
        await db.delete(captureTags).where(eq(captureTags.captureId, entityId));
        await db.delete(captures).where(eq(captures.id, entityId));
        break;
      case "tag":
        await db.delete(tags).where(eq(tags.id, entityId));
        break;
      case "saved_view":
        await db.delete(savedViews).where(eq(savedViews.id, entityId));
        break;
    }
    return { restored: true, current: null };
  }

  // Otherwise restore the before snapshot
  switch (entityType) {
    case "task": {
      const snap = beforeSnapshot;
      const tagIds = (snap.tag_ids as string[] | undefined) ?? [];
      const [updated] = await db
        .update(tasks)
        .set({
          title: snap.title as string,
          notes: (snap.notes as string | null) ?? null,
          status: snap.status as "Inbox" | "Active" | "Someday" | "Done" | "Archived",
          context: (snap.context as "Home" | "Work" | null) ?? null,
          priority: (snap.priority as "P0" | "P1" | "P2" | "P3") ?? "P3",
          dueAt: snap.dueAt ? new Date(snap.dueAt as string) : null,
          startAt: snap.startAt ? new Date(snap.startAt as string) : null,
          completedAt: snap.completedAt ? new Date(snap.completedAt as string) : null,
          estimate: (snap.estimate as number | null) ?? null,
          orderIndex: snap.orderIndex as string,
          isFocus: (snap.isFocus as boolean) ?? false,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, entityId))
        .returning();

      // Restore tags
      await db.delete(taskTags).where(eq(taskTags.taskId, entityId));
      if (tagIds.length > 0) {
        await db.insert(taskTags).values(tagIds.map((tagId) => ({ taskId: entityId, tagId })));
      }

      return { restored: true, current: { ...updated, tag_ids: tagIds } };
    }
    case "subtask": {
      const snap = beforeSnapshot;
      const [updated] = await db
        .update(subtasks)
        .set({
          title: snap.title as string,
          done: (snap.done as boolean) ?? false,
          orderIndex: snap.orderIndex as string,
          updatedAt: new Date(),
        })
        .where(eq(subtasks.id, entityId))
        .returning();
      return { restored: true, current: updated };
    }
    case "capture": {
      const snap = beforeSnapshot;
      const tagIds = (snap.tag_ids as string[] | undefined) ?? [];
      const [updated] = await db
        .update(captures)
        .set({
          title: snap.title as string,
          body: (snap.body as string | null) ?? null,
          status: snap.status as "Captured" | "Reviewed" | "Archived",
          pinned: (snap.pinned as boolean) ?? false,
          context: (snap.context as "Home" | "Work" | null) ?? null,
          nudgeAt: snap.nudgeAt ? new Date(snap.nudgeAt as string) : null,
          updatedAt: new Date(),
        })
        .where(eq(captures.id, entityId))
        .returning();

      // Restore tags
      await db.delete(captureTags).where(eq(captureTags.captureId, entityId));
      if (tagIds.length > 0) {
        await db.insert(captureTags).values(tagIds.map((tagId) => ({ captureId: entityId, tagId })));
      }

      return { restored: true, current: { ...updated, tag_ids: tagIds } };
    }
    case "tag": {
      const snap = beforeSnapshot;
      const [updated] = await db
        .update(tags)
        .set({
          name: snap.name as string,
          color: (snap.color as string | null) ?? null,
        })
        .where(eq(tags.id, entityId))
        .returning();
      return { restored: true, current: updated };
    }
    case "saved_view": {
      const snap = beforeSnapshot;
      const [updated] = await db
        .update(savedViews)
        .set({
          name: snap.name as string,
          type: snap.type as "Tasks" | "Captures" | "KanbanLane",
          filterDefinition: (snap.filterDefinition as Record<string, unknown>) ?? null,
          sortOrder: (snap.sortOrder as number) ?? 0,
          isHidden: (snap.isHidden as boolean) ?? false,
          updatedAt: new Date(),
        })
        .where(eq(savedViews.id, entityId))
        .returning();
      return { restored: true, current: updated };
    }
    default:
      return { restored: false, current: null };
  }
}

// ── register ────────────────────────────────────────────────────────

export function registerUndoTools(server: McpServer, db: Database) {
  // ─── undo.last_ai_action ──────────────────────────────────────
  server.tool(
    "undo.last_ai_action",
    "Undo the most recent non-undone AI action for a given entity",
    {
      entity_type: z.enum(entityTypeValues).describe("Entity type"),
      entity_id: z.string().uuid().describe("Entity UUID"),
      ...aiMetaParams,
    },
    async (params) => {
      // Find the most recent non-undone AI audit entry for this entity
      const entries = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.entityType, params.entity_type),
            eq(auditLog.entityId, params.entity_id),
            eq(auditLog.actorType, "ai"),
            eq(auditLog.undone, false),
          ),
        )
        .orderBy(desc(auditLog.createdAt))
        .limit(1);

      if (entries.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "No undoable AI action found for this entity" }),
          }],
          isError: true,
        };
      }

      const entry = entries[0];

      // Restore the entity to the before state
      const result = await restoreEntity(
        db,
        params.entity_type as EntityType,
        params.entity_id,
        entry.before as Record<string, unknown> | null,
        entry.after as Record<string, unknown> | null,
      );

      // Mark the original entry as undone
      await db
        .update(auditLog)
        .set({ undone: true })
        .where(eq(auditLog.id, entry.id));

      // Log the undo itself
      const undoAuditId = await logAudit(db, {
        entityType: params.entity_type as EntityType,
        entityId: params.entity_id,
        action: "undo.last_ai_action",
        before: entry.after,
        after: entry.before,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason ?? `Undo of ${entry.action} (audit ${entry.id})`,
      });

      // Link the undone entry to the undo entry
      await db
        .update(auditLog)
        .set({ undoneByAuditId: undoAuditId })
        .where(eq(auditLog.id, entry.id));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            undone_audit_id: entry.id,
            undone_action: entry.action,
            restored_state: result.current,
          }),
        }],
      };
    },
  );

  // ─── undo.by_id ───────────────────────────────────────────────
  server.tool(
    "undo.by_id",
    "Undo a specific audit log entry by its ID",
    {
      audit_id: z.string().uuid().describe("Audit log entry UUID to undo"),
      ...aiMetaParams,
    },
    async (params) => {
      const entries = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.id, params.audit_id))
        .limit(1);

      if (entries.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "Audit entry not found" }),
          }],
          isError: true,
        };
      }

      const entry = entries[0];

      if (entry.undone) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "This action has already been undone" }),
          }],
          isError: true,
        };
      }

      // Restore the entity
      const result = await restoreEntity(
        db,
        entry.entityType as EntityType,
        entry.entityId,
        entry.before as Record<string, unknown> | null,
        entry.after as Record<string, unknown> | null,
      );

      // Mark the entry as undone
      await db
        .update(auditLog)
        .set({ undone: true })
        .where(eq(auditLog.id, entry.id));

      // Log the undo
      const undoAuditId = await logAudit(db, {
        entityType: entry.entityType as EntityType,
        entityId: entry.entityId,
        action: "undo.by_id",
        before: entry.after,
        after: entry.before,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason ?? `Undo of ${entry.action} (audit ${entry.id})`,
      });

      // Link the undone entry
      await db
        .update(auditLog)
        .set({ undoneByAuditId: undoAuditId })
        .where(eq(auditLog.id, entry.id));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            undone_audit_id: entry.id,
            undone_action: entry.action,
            restored_state: result.current,
          }),
        }],
      };
    },
  );
}
