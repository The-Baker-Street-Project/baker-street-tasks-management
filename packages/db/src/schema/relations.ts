import { relations } from "drizzle-orm";
import { tasks } from "./tasks";
import { subtasks } from "./subtasks";
import { captures } from "./captures";
import { tags, taskTags, captureTags } from "./tags";

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

export const capturesRelations = relations(captures, ({ many }) => ({
  captureTags: many(captureTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  taskTags: many(taskTags),
  captureTags: many(captureTags),
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

export const captureTagsRelations = relations(captureTags, ({ one }) => ({
  capture: one(captures, {
    fields: [captureTags.captureId],
    references: [captures.id],
  }),
  tag: one(tags, {
    fields: [captureTags.tagId],
    references: [tags.id],
  }),
}));
