import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { TaskStatus, Context, Priority, Source } from "./enums";

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status").$type<TaskStatus>().notNull().default("Inbox"),
    context: text("context").$type<Context>(),
    priority: text("priority").$type<Priority>().default("P3"),
    dueAt: text("due_at"),
    startAt: text("start_at"),
    completedAt: text("completed_at"),
    estimate: integer("estimate"),
    orderIndex: text("order_index").notNull(),
    isFocus: integer("is_focus", { mode: "boolean" }).notNull().default(false),
    // AI metadata
    createdBy: text("created_by").$type<Source>().notNull().default("web_ui"),
    agentId: text("agent_id"),
    sourceMessageId: text("source_message_id"),
    requestId: text("request_id"),
    reason: text("reason"),
    // Timestamps (ISO 8601 strings)
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("tasks_status_idx").on(table.status),
    index("tasks_priority_idx").on(table.priority),
    index("tasks_due_at_idx").on(table.dueAt),
    index("tasks_is_focus_idx").on(table.isFocus),
    index("tasks_context_idx").on(table.context),
    index("tasks_order_idx").on(table.orderIndex),
  ]
);
