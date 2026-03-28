import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { tasks } from "./tasks";

export const tags = sqliteTable(
  "tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("tags_name_unique_idx").on(table.name)]
);

export const taskTags = sqliteTable(
  "task_tags",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("task_tags_unique_idx").on(table.taskId, table.tagId),
  ]
);
