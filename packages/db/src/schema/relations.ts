import { relations } from "drizzle-orm";
import { tasks } from "./tasks";
import { subtasks } from "./subtasks";
import { tags, taskTags } from "./tags";

export const tasksRelations = relations(tasks, ({ many }) => ({
  subtasks: many(subtasks),
  taskTags: many(taskTags),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.taskId],
    references: [tasks.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  taskTags: many(taskTags),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTags.taskId],
    references: [tasks.id],
  }),
  tag: one(tags, {
    fields: [taskTags.tagId],
    references: [tags.id],
  }),
}));
