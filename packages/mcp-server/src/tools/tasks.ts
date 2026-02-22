import { z } from "zod";
import { eq, and, inArray, desc, asc, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { tasks, taskTags } from "@baker-street/db/schema";
import type { Database } from "@baker-street/db/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkIdempotency } from "../services/idempotency";
import { logAudit } from "../services/audit-logger";

// ── shared enum values ──────────────────────────────────────────────

const statusValues = ["Inbox", "Active", "Someday", "Done", "Archived"] as const;
const contextValues = ["Home", "Work"] as const;
const priorityValues = ["P0", "P1", "P2", "P3"] as const;

// ── AI-metadata params reused by every write tool ───────────────────

const aiMetaParams = {
  agent_id: z.string().optional().describe("Identifier of the AI agent making the call"),
  request_id: z.string().optional().describe("Idempotency key — duplicate request_ids return the earlier result"),
  reason: z.string().optional().describe("Human-readable reason for the change"),
};

// ── helpers ─────────────────────────────────────────────────────────

async function getLastOrderIndex(db: Database): Promise<string | null> {
  const rows = await db
    .select({ orderIndex: tasks.orderIndex })
    .from(tasks)
    .orderBy(desc(tasks.orderIndex))
    .limit(1);
  return rows.length > 0 ? rows[0].orderIndex : null;
}

async function attachTags(
  db: Database,
  taskId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0) return;
  await db.insert(taskTags).values(
    tagIds.map((tagId) => ({ taskId, tagId })),
  );
}

async function getTaskTagIds(db: Database, taskId: string): Promise<string[]> {
  const rows = await db
    .select({ tagId: taskTags.tagId })
    .from(taskTags)
    .where(eq(taskTags.taskId, taskId));
  return rows.map((r) => r.tagId);
}

async function getTaskById(db: Database, id: string) {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return rows[0] ?? null;
}

function taskSnapshot(task: Record<string, unknown>, tagIds: string[]) {
  return { ...task, tag_ids: tagIds };
}

// ── register ────────────────────────────────────────────────────────

export function registerTaskTools(server: McpServer, db: Database) {
  // ─── tasks.create ──────────────────────────────────────────────
  server.tool(
    "tasks.create",
    "Create a new task",
    {
      title: z.string().describe("Task title"),
      notes: z.string().optional().describe("Markdown notes body"),
      status: z.enum(statusValues).optional().describe("Task status (defaults to Inbox)"),
      context: z.enum(contextValues).optional().describe("Home or Work"),
      priority: z.enum(priorityValues).optional().describe("Priority level (defaults to P3)"),
      due_at: z.string().optional().describe("Due date ISO-8601"),
      start_at: z.string().optional().describe("Start date ISO-8601"),
      estimate: z.number().int().optional().describe("Estimate in minutes"),
      is_focus: z.boolean().optional().describe("Pin to focus list"),
      tag_ids: z.array(z.string().uuid()).optional().describe("Tag UUIDs to attach"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const lastIdx = await getLastOrderIndex(db);
      const orderIndex = generateKeyBetween(lastIdx, null);

      const [created] = await db
        .insert(tasks)
        .values({
          title: params.title,
          notes: params.notes ?? null,
          status: params.status ?? "Inbox",
          context: params.context ?? null,
          priority: params.priority ?? "P3",
          dueAt: params.due_at ? new Date(params.due_at) : null,
          startAt: params.start_at ? new Date(params.start_at) : null,
          estimate: params.estimate ?? null,
          isFocus: params.is_focus ?? false,
          orderIndex,
          createdBy: "mcp",
          agentId: params.agent_id ?? null,
          requestId: params.request_id ?? null,
          reason: params.reason ?? null,
        })
        .returning();

      if (params.tag_ids && params.tag_ids.length > 0) {
        await attachTags(db, created.id, params.tag_ids);
      }

      const after = taskSnapshot(created as unknown as Record<string, unknown>, params.tag_ids ?? []);
      await logAudit(db, {
        entityType: "task",
        entityId: created.id,
        action: "tasks.create",
        before: null,
        after,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(after) }] };
    },
  );

  // ─── tasks.get ─────────────────────────────────────────────────
  server.tool(
    "tasks.get",
    "Get a single task by ID including subtasks and tags",
    {
      task_id: z.string().uuid().describe("Task UUID"),
    },
    async (params) => {
      const task = await getTaskById(db, params.task_id);
      if (!task) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Task not found" }) }], isError: true };
      }
      const tagIds = await getTaskTagIds(db, params.task_id);
      const snapshot = taskSnapshot(task as unknown as Record<string, unknown>, tagIds);
      return { content: [{ type: "text" as const, text: JSON.stringify(snapshot) }] };
    },
  );

  // ─── tasks.list ────────────────────────────────────────────────
  server.tool(
    "tasks.list",
    "List tasks with optional filters, sorting, and pagination",
    {
      status: z.array(z.enum(statusValues)).optional().describe("Filter by status(es)"),
      context: z.enum(contextValues).optional().describe("Filter by context"),
      priority: z.array(z.enum(priorityValues)).optional().describe("Filter by priority levels"),
      is_focus: z.boolean().optional().describe("Filter by focus flag"),
      tag_id: z.string().uuid().optional().describe("Filter by tag UUID"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results (default 50)"),
      offset: z.number().int().min(0).optional().describe("Offset for pagination"),
      sort_by: z.enum(["created_at", "updated_at", "due_at", "priority", "order_index"]).optional().describe("Sort field"),
      sort_dir: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
    },
    async (params) => {
      const limit = params.limit ?? 50;
      const offset = params.offset ?? 0;
      const conditions: ReturnType<typeof eq>[] = [];

      if (params.status && params.status.length > 0) {
        conditions.push(inArray(tasks.status, params.status));
      }
      if (params.context) {
        conditions.push(eq(tasks.context, params.context));
      }
      if (params.priority && params.priority.length > 0) {
        conditions.push(inArray(tasks.priority, params.priority));
      }
      if (params.is_focus !== undefined) {
        conditions.push(eq(tasks.isFocus, params.is_focus));
      }

      const sortDirFn = params.sort_dir === "desc" ? desc : asc;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sortMap: Record<string, any> = {
        created_at: tasks.createdAt,
        updated_at: tasks.updatedAt,
        due_at: tasks.dueAt,
        priority: tasks.priority,
        order_index: tasks.orderIndex,
      };
      const sortCol = sortMap[params.sort_by ?? "order_index"] ?? tasks.orderIndex;
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      let rows;
      if (params.tag_id) {
        // Join through task_tags when filtering by tag
        rows = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            notes: tasks.notes,
            status: tasks.status,
            context: tasks.context,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            startAt: tasks.startAt,
            completedAt: tasks.completedAt,
            estimate: tasks.estimate,
            orderIndex: tasks.orderIndex,
            isFocus: tasks.isFocus,
            createdBy: tasks.createdBy,
            agentId: tasks.agentId,
            sourceMessageId: tasks.sourceMessageId,
            requestId: tasks.requestId,
            reason: tasks.reason,
            createdAt: tasks.createdAt,
            updatedAt: tasks.updatedAt,
          })
          .from(tasks)
          .innerJoin(taskTags, eq(tasks.id, taskTags.taskId))
          .where(and(eq(taskTags.tagId, params.tag_id), whereClause))
          .orderBy(sortDirFn(sortCol))
          .limit(limit)
          .offset(offset);
      } else {
        rows = await db
          .select()
          .from(tasks)
          .where(whereClause)
          .orderBy(sortDirFn(sortCol))
          .limit(limit)
          .offset(offset);
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(rows) }] };
    },
  );

  // ─── tasks.update ──────────────────────────────────────────────
  server.tool(
    "tasks.update",
    "Update one or more fields on a task",
    {
      task_id: z.string().uuid().describe("Task UUID"),
      title: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(statusValues).optional(),
      context: z.enum(contextValues).optional(),
      priority: z.enum(priorityValues).optional(),
      due_at: z.string().nullable().optional().describe("ISO-8601 or null to clear"),
      start_at: z.string().nullable().optional(),
      estimate: z.number().int().nullable().optional(),
      is_focus: z.boolean().optional(),
      tag_ids: z.array(z.string().uuid()).optional().describe("Replace all tags with these"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getTaskById(db, params.task_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Task not found" }) }], isError: true };
      }
      const oldTagIds = await getTaskTagIds(db, params.task_id);
      const before = taskSnapshot(existing as unknown as Record<string, unknown>, oldTagIds);

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (params.title !== undefined) updates.title = params.title;
      if (params.notes !== undefined) updates.notes = params.notes;
      if (params.status !== undefined) updates.status = params.status;
      if (params.context !== undefined) updates.context = params.context;
      if (params.priority !== undefined) updates.priority = params.priority;
      if (params.due_at !== undefined) updates.dueAt = params.due_at ? new Date(params.due_at) : null;
      if (params.start_at !== undefined) updates.startAt = params.start_at ? new Date(params.start_at) : null;
      if (params.estimate !== undefined) updates.estimate = params.estimate;
      if (params.is_focus !== undefined) updates.isFocus = params.is_focus;

      const [updated] = await db
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, params.task_id))
        .returning();

      if (params.tag_ids !== undefined) {
        await db.delete(taskTags).where(eq(taskTags.taskId, params.task_id));
        await attachTags(db, params.task_id, params.tag_ids);
      }

      const newTagIds = params.tag_ids ?? oldTagIds;
      const after = taskSnapshot(updated as unknown as Record<string, unknown>, newTagIds);

      await logAudit(db, {
        entityType: "task",
        entityId: params.task_id,
        action: "tasks.update",
        before,
        after,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(after) }] };
    },
  );

  // ─── tasks.complete ────────────────────────────────────────────
  server.tool(
    "tasks.complete",
    "Mark a task as Done and record completed_at",
    {
      task_id: z.string().uuid().describe("Task UUID"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getTaskById(db, params.task_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Task not found" }) }], isError: true };
      }
      const tagIds = await getTaskTagIds(db, params.task_id);
      const before = taskSnapshot(existing as unknown as Record<string, unknown>, tagIds);

      const [updated] = await db
        .update(tasks)
        .set({ status: "Done", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(tasks.id, params.task_id))
        .returning();

      const after = taskSnapshot(updated as unknown as Record<string, unknown>, tagIds);

      await logAudit(db, {
        entityType: "task",
        entityId: params.task_id,
        action: "tasks.complete",
        before,
        after,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(after) }] };
    },
  );

  // ─── tasks.reopen ──────────────────────────────────────────────
  server.tool(
    "tasks.reopen",
    "Reopen a completed or archived task back to Active",
    {
      task_id: z.string().uuid().describe("Task UUID"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getTaskById(db, params.task_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Task not found" }) }], isError: true };
      }
      const tagIds = await getTaskTagIds(db, params.task_id);
      const before = taskSnapshot(existing as unknown as Record<string, unknown>, tagIds);

      const [updated] = await db
        .update(tasks)
        .set({ status: "Active", completedAt: null, updatedAt: new Date() })
        .where(eq(tasks.id, params.task_id))
        .returning();

      const after = taskSnapshot(updated as unknown as Record<string, unknown>, tagIds);

      await logAudit(db, {
        entityType: "task",
        entityId: params.task_id,
        action: "tasks.reopen",
        before,
        after,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(after) }] };
    },
  );

  // ─── tasks.search ──────────────────────────────────────────────
  server.tool(
    "tasks.search",
    "Full-text search across task title and notes using tsvector",
    {
      query: z.string().describe("Search query"),
      limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
    },
    async (params) => {
      const limit = params.limit ?? 20;
      // Convert the user query to a tsquery using plainto_tsquery for safety
      const rows = await db
        .select()
        .from(tasks)
        .where(
          sql`search_vector @@ plainto_tsquery('english', ${params.query})`,
        )
        .orderBy(
          sql`ts_rank(search_vector, plainto_tsquery('english', ${params.query})) DESC`,
        )
        .limit(limit);

      return { content: [{ type: "text" as const, text: JSON.stringify(rows) }] };
    },
  );

  // ─── tasks.move_status ─────────────────────────────────────────
  server.tool(
    "tasks.move_status",
    "Move a task to a different status column (Kanban-style)",
    {
      task_id: z.string().uuid().describe("Task UUID"),
      status: z.enum(statusValues).describe("Target status"),
      after_id: z.string().uuid().optional().describe("Place after this task's order_index"),
      before_id: z.string().uuid().optional().describe("Place before this task's order_index"),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const existing = await getTaskById(db, params.task_id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Task not found" }) }], isError: true };
      }
      const tagIds = await getTaskTagIds(db, params.task_id);
      const before = taskSnapshot(existing as unknown as Record<string, unknown>, tagIds);

      // Compute new orderIndex
      let afterIdx: string | null = null;
      let beforeIdx: string | null = null;

      if (params.after_id) {
        const afterTask = await getTaskById(db, params.after_id);
        if (afterTask) afterIdx = afterTask.orderIndex;
      }
      if (params.before_id) {
        const beforeTask = await getTaskById(db, params.before_id);
        if (beforeTask) beforeIdx = beforeTask.orderIndex;
      }

      const orderIndex = generateKeyBetween(afterIdx, beforeIdx);

      const updateValues: Record<string, unknown> = {
        status: params.status,
        orderIndex,
        updatedAt: new Date(),
      };

      if (params.status === "Done") {
        updateValues.completedAt = new Date();
      } else if (existing.status === "Done") {
        // Moving away from Done — clear completed_at
        updateValues.completedAt = null;
      }

      const [updated] = await db
        .update(tasks)
        .set(updateValues)
        .where(eq(tasks.id, params.task_id))
        .returning();

      const after = taskSnapshot(updated as unknown as Record<string, unknown>, tagIds);

      await logAudit(db, {
        entityType: "task",
        entityId: params.task_id,
        action: "tasks.move_status",
        before,
        after,
        agentId: params.agent_id,
        requestId: params.request_id,
        reason: params.reason,
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(after) }] };
    },
  );

  // ─── tasks.bulk_update ─────────────────────────────────────────
  server.tool(
    "tasks.bulk_update",
    "Update the same fields across multiple tasks at once",
    {
      task_ids: z.array(z.string().uuid()).min(1).max(50).describe("Task UUIDs to update"),
      status: z.enum(statusValues).optional(),
      context: z.enum(contextValues).optional(),
      priority: z.enum(priorityValues).optional(),
      is_focus: z.boolean().optional(),
      ...aiMetaParams,
    },
    async (params) => {
      const idempotencyCheck = await checkIdempotency(db, params.request_id);
      if (idempotencyCheck.alreadyProcessed) {
        return { content: [{ type: "text" as const, text: JSON.stringify(idempotencyCheck.result) }] };
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (params.status !== undefined) updates.status = params.status;
      if (params.context !== undefined) updates.context = params.context;
      if (params.priority !== undefined) updates.priority = params.priority;
      if (params.is_focus !== undefined) updates.isFocus = params.is_focus;

      if (params.status === "Done") {
        updates.completedAt = new Date();
      }

      // Fetch befores
      const befores = await db
        .select()
        .from(tasks)
        .where(inArray(tasks.id, params.task_ids));

      const updatedRows = await db
        .update(tasks)
        .set(updates)
        .where(inArray(tasks.id, params.task_ids))
        .returning();

      // Log each individually
      for (const row of updatedRows) {
        const beforeRow = befores.find((b) => b.id === row.id);
        await logAudit(db, {
          entityType: "task",
          entityId: row.id,
          action: "tasks.bulk_update",
          before: beforeRow ?? null,
          after: row,
          agentId: params.agent_id,
          requestId: params.request_id,
          reason: params.reason,
        });
      }

      return { content: [{ type: "text" as const, text: JSON.stringify({ updated: updatedRows.length, tasks: updatedRows }) }] };
    },
  );
}
