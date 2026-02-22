import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { sourceEnum } from "./enums";
import { tasks } from "./tasks";

export const subtasks = pgTable("subtasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  orderIndex: text("order_index").notNull(),
  // AI metadata
  createdBy: sourceEnum("created_by").notNull().default("web_ui"),
  agentId: text("agent_id"),
  requestId: text("request_id"),
  reason: text("reason"),
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
