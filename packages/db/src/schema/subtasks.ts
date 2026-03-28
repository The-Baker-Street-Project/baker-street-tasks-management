import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { Source } from "./enums";
import { tasks } from "./tasks";

export const subtasks = sqliteTable("subtasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  orderIndex: text("order_index").notNull(),
  // AI metadata
  createdBy: text("created_by").$type<Source>().notNull().default("web_ui"),
  agentId: text("agent_id"),
  requestId: text("request_id"),
  reason: text("reason"),
  // Timestamps (ISO 8601 strings)
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
