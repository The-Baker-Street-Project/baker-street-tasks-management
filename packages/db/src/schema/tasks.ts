import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import {
  taskStatusEnum,
  contextEnum,
  priorityEnum,
  sourceEnum,
} from "./enums";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    notes: text("notes"),
    status: taskStatusEnum("status").notNull().default("Inbox"),
    context: contextEnum("context"),
    priority: priorityEnum("priority").default("P3"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startAt: timestamp("start_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    estimate: integer("estimate"),
    orderIndex: text("order_index").notNull(),
    isFocus: boolean("is_focus").notNull().default(false),
    // AI metadata
    createdBy: sourceEnum("created_by").notNull().default("web_ui"),
    agentId: text("agent_id"),
    sourceMessageId: text("source_message_id"),
    requestId: text("request_id"),
    reason: text("reason"),
    // Note: search_vector tsvector column + GIN index added via custom migration
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
