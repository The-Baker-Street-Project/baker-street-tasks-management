import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { EntityStatus, Source } from "./enums";
import { areas } from "./areas";
import { tasks } from "./tasks";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    status: text("status").$type<EntityStatus>().notNull().default("Active"),
    orderIndex: text("order_index").notNull(),
    createdBy: text("created_by").$type<Source>().notNull().default("web_ui"),
    agentId: text("agent_id"),
    requestId: text("request_id"),
    reason: text("reason"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("projects_area_name_unique_idx").on(table.areaId, table.name)]
);

export const taskProjects = sqliteTable(
  "task_projects",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("task_projects_unique_idx").on(table.taskId, table.projectId)]
);
