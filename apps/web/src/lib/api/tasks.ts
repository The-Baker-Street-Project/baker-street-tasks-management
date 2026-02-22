"use server";

import { createDb } from "@baker-street/db/client";
import {
  tasks,
  subtasks,
  taskTags,
  tags,
  savedViews,
} from "@baker-street/db/schema";
import {
  eq,
  and,
  lt,
  gte,
  ne,
  or,
  ilike,
  asc,
  desc,
  inArray,
} from "drizzle-orm";
import { startOfDay, endOfDay } from "date-fns";
import type { Task, TaskStatus, Priority, Context, Source } from "@/types";

function getDb() {
  return createDb();
}

export interface GetTasksParams {
  status?: TaskStatus[];
  view?: string;
  tagId?: string;
  context?: Context | null;
  sort?: "due_date" | "priority" | "created" | "order";
}

function mapTask(
  row: typeof tasks.$inferSelect & {
    subtasks?: (typeof subtasks.$inferSelect)[];
    taskTags?: { tag: typeof tags.$inferSelect }[];
  }
): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status as TaskStatus,
    context: row.context as Context | null,
    priority: row.priority as Priority,
    dueAt: row.dueAt,
    startAt: row.startAt,
    completedAt: row.completedAt,
    estimate: row.estimate,
    orderIndex: row.orderIndex,
    isFocus: row.isFocus,
    createdBy: row.createdBy as Source,
    agentId: row.agentId,
    sourceMessageId: row.sourceMessageId,
    requestId: row.requestId,
    reason: row.reason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    subtasks: row.subtasks?.map((s) => ({
      id: s.id,
      taskId: s.taskId,
      title: s.title,
      done: s.done,
      orderIndex: s.orderIndex,
      createdBy: s.createdBy as Source,
      agentId: s.agentId,
      requestId: s.requestId,
      reason: s.reason,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    tags: row.taskTags?.map((tt) => ({
      id: tt.tag.id,
      name: tt.tag.name,
      color: tt.tag.color,
      createdAt: tt.tag.createdAt,
    })),
  };
}

export async function getTasks(params?: GetTasksParams): Promise<Task[]> {
  const db = getDb();

  const conditions = [];

  if (params?.status && params.status.length > 0) {
    if (params.status.length === 1) {
      conditions.push(eq(tasks.status, params.status[0]));
    } else {
      conditions.push(or(...params.status.map((s) => eq(tasks.status, s))));
    }
  }

  // Map system view IDs to status filters, or parse custom view filterDefinition
  if (params?.view && params.view !== "all") {
    const viewStatusMap: Record<string, TaskStatus> = {
      inbox: "Inbox",
      active: "Active",
      someday: "Someday",
      done: "Done",
      archived: "Archived",
    };
    const mappedStatus = viewStatusMap[params.view];
    if (mappedStatus) {
      conditions.push(eq(tasks.status, mappedStatus));
    } else {
      // Try loading a custom saved view by ID
      const view = await db.query.savedViews.findFirst({
        where: eq(savedViews.id, params.view),
      });
      if (view?.filterDefinition) {
        const filter = view.filterDefinition as Record<string, unknown>;
        const VALID_STATUSES: TaskStatus[] = ["Inbox", "Active", "Someday", "Done", "Archived"];
        const VALID_PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];
        const VALID_CONTEXTS: Context[] = ["Home", "Work"];

        if (filter.status && typeof filter.status === "string" && VALID_STATUSES.includes(filter.status as TaskStatus)) {
          conditions.push(eq(tasks.status, filter.status as TaskStatus));
        }
        if (filter.context && typeof filter.context === "string" && VALID_CONTEXTS.includes(filter.context as Context)) {
          conditions.push(eq(tasks.context, filter.context as Context));
        }
        if (filter.priority && typeof filter.priority === "string" && VALID_PRIORITIES.includes(filter.priority as Priority)) {
          conditions.push(eq(tasks.priority, filter.priority as Priority));
        }
      }
    }
  }

  if (params?.context) {
    conditions.push(eq(tasks.context, params.context));
  }

  if (params?.tagId) {
    // Subquery: find task IDs that have this tag
    const taggedTaskIds = await db
      .select({ taskId: taskTags.taskId })
      .from(taskTags)
      .where(eq(taskTags.tagId, params.tagId));
    const ids = taggedTaskIds.map((r) => r.taskId);
    if (ids.length === 0) return [];
    conditions.push(inArray(tasks.id, ids));
  }

  const orderByClause =
    params?.sort === "due_date"
      ? asc(tasks.dueAt)
      : params?.sort === "priority"
        ? asc(tasks.priority)
        : params?.sort === "created"
          ? desc(tasks.createdAt)
          : asc(tasks.orderIndex);

  const rows = await db.query.tasks.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      subtasks: { orderBy: asc(subtasks.orderIndex) },
      taskTags: { with: { tag: true } },
    },
    orderBy: orderByClause,
  });

  return rows.map(mapTask);
}

export async function getTask(id: string): Promise<Task | null> {
  const db = getDb();
  const row = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      subtasks: { orderBy: asc(subtasks.orderIndex) },
      taskTags: { with: { tag: true } },
    },
  });
  if (!row) return null;
  return mapTask(row);
}

export interface CreateTaskInput {
  title: string;
  notes?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  context?: Context | null;
  dueAt?: Date | null;
  startAt?: Date | null;
  estimate?: number | null;
  isFocus?: boolean;
  tagIds?: string[];
}

export async function createTask(data: CreateTaskInput): Promise<Task> {
  const db = getDb();

  // Generate an order index: use a timestamp-based fractional index
  const orderIndex = Date.now().toString(36);

  const [row] = await db
    .insert(tasks)
    .values({
      title: data.title,
      notes: data.notes ?? null,
      status: data.status ?? "Inbox",
      context: data.context ?? null,
      priority: data.priority ?? "P3",
      dueAt: data.dueAt ?? null,
      startAt: data.startAt ?? null,
      estimate: data.estimate ?? null,
      isFocus: data.isFocus ?? false,
      orderIndex,
      createdBy: "web_ui",
    })
    .returning();

  if (data.tagIds && data.tagIds.length > 0) {
    await db.insert(taskTags).values(
      data.tagIds.map((tagId) => ({
        taskId: row.id,
        tagId,
      }))
    );
  }

  const result = await getTask(row.id);
  return result!;
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  context?: Context | null;
  dueAt?: Date | null;
  startAt?: Date | null;
  estimate?: number | null;
  isFocus?: boolean;
  orderIndex?: string;
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput
): Promise<Task> {
  const db = getDb();
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "Done") {
      updateData.completedAt = new Date();
    }
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.context !== undefined) updateData.context = data.context;
  if (data.dueAt !== undefined) updateData.dueAt = data.dueAt;
  if (data.startAt !== undefined) updateData.startAt = data.startAt;
  if (data.estimate !== undefined) updateData.estimate = data.estimate;
  if (data.isFocus !== undefined) updateData.isFocus = data.isFocus;
  if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;

  await db.update(tasks).set(updateData).where(eq(tasks.id, id));

  const result = await getTask(id);
  return result!;
}

export async function deleteTask(id: string): Promise<void> {
  const db = getDb();
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function completeTask(id: string): Promise<Task> {
  return updateTask(id, { status: "Done" });
}

export async function reopenTask(id: string): Promise<Task> {
  const db = getDb();
  await db
    .update(tasks)
    .set({ status: "Active", completedAt: null, updatedAt: new Date() })
    .where(eq(tasks.id, id));
  const result = await getTask(id);
  return result!;
}

// ── Dashboard queries ─────────────────────────────────────────

export async function getOverdueTasks(): Promise<Task[]> {
  const db = getDb();
  const now = startOfDay(new Date());
  const rows = await db.query.tasks.findMany({
    where: and(
      lt(tasks.dueAt, now),
      ne(tasks.status, "Done"),
      ne(tasks.status, "Archived")
    ),
    with: {
      subtasks: { orderBy: asc(subtasks.orderIndex) },
      taskTags: { with: { tag: true } },
    },
    orderBy: asc(tasks.dueAt),
  });
  return rows.map(mapTask);
}

export async function getDueTodayTasks(): Promise<Task[]> {
  const db = getDb();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const rows = await db.query.tasks.findMany({
    where: and(
      gte(tasks.dueAt, todayStart),
      lt(tasks.dueAt, todayEnd),
      ne(tasks.status, "Done"),
      ne(tasks.status, "Archived")
    ),
    with: {
      subtasks: { orderBy: asc(subtasks.orderIndex) },
      taskTags: { with: { tag: true } },
    },
    orderBy: asc(tasks.orderIndex),
  });
  return rows.map(mapTask);
}

export async function getHighPriorityTasks(): Promise<Task[]> {
  const db = getDb();
  const rows = await db.query.tasks.findMany({
    where: and(
      or(eq(tasks.priority, "P0"), eq(tasks.priority, "P1")),
      ne(tasks.status, "Done"),
      ne(tasks.status, "Archived")
    ),
    with: {
      subtasks: { orderBy: asc(subtasks.orderIndex) },
      taskTags: { with: { tag: true } },
    },
    orderBy: asc(tasks.priority),
  });
  return rows.map(mapTask);
}

export async function getFocusTasks(): Promise<Task[]> {
  const db = getDb();
  const rows = await db.query.tasks.findMany({
    where: and(
      eq(tasks.isFocus, true),
      ne(tasks.status, "Done"),
      ne(tasks.status, "Archived")
    ),
    with: {
      subtasks: { orderBy: asc(subtasks.orderIndex) },
      taskTags: { with: { tag: true } },
    },
    orderBy: asc(tasks.orderIndex),
    limit: 3,
  });
  return rows.map(mapTask);
}

export async function searchTasks(query: string): Promise<Task[]> {
  const db = getDb();
  const rows = await db.query.tasks.findMany({
    where: or(
      ilike(tasks.title, `%${query}%`),
      ilike(tasks.notes, `%${query}%`)
    ),
    with: {
      subtasks: { orderBy: asc(subtasks.orderIndex) },
      taskTags: { with: { tag: true } },
    },
    orderBy: desc(tasks.updatedAt),
    limit: 50,
  });
  return rows.map(mapTask);
}

// ── Subtask actions ───────────────────────────────────────────

export interface CreateSubtaskInput {
  taskId: string;
  title: string;
}

export async function createSubtask(data: CreateSubtaskInput): Promise<Task> {
  const db = getDb();
  const orderIndex = Date.now().toString(36);
  await db.insert(subtasks).values({
    taskId: data.taskId,
    title: data.title,
    orderIndex,
    createdBy: "web_ui",
  });
  const result = await getTask(data.taskId);
  return result!;
}

export async function toggleSubtask(
  subtaskId: string,
  done: boolean
): Promise<void> {
  const db = getDb();
  await db
    .update(subtasks)
    .set({ done, updatedAt: new Date() })
    .where(eq(subtasks.id, subtaskId));
}

export async function deleteSubtask(subtaskId: string): Promise<void> {
  const db = getDb();
  await db.delete(subtasks).where(eq(subtasks.id, subtaskId));
}

// ── Tag actions ───────────────────────────────────────────────

export async function addTagToTask(
  taskId: string,
  tagId: string
): Promise<void> {
  const db = getDb();
  await db
    .insert(taskTags)
    .values({ taskId, tagId })
    .onConflictDoNothing();
}

export async function removeTagFromTask(
  taskId: string,
  tagId: string
): Promise<void> {
  const db = getDb();
  await db
    .delete(taskTags)
    .where(and(eq(taskTags.taskId, taskId), eq(taskTags.tagId, tagId)));
}
