import { relations } from "drizzle-orm";
import { tasks } from "./tasks";
import { subtasks } from "./subtasks";
import { tags, taskTags } from "./tags";
import { areas } from "./areas";
import { projects, taskProjects } from "./projects";

export const tasksRelations = relations(tasks, ({ many }) => ({
  subtasks: many(subtasks),
  taskTags: many(taskTags),
  taskProjects: many(taskProjects),
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

export const areasRelations = relations(areas, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  area: one(areas, { fields: [projects.areaId], references: [areas.id] }),
  taskProjects: many(taskProjects),
}));

export const taskProjectsRelations = relations(taskProjects, ({ one }) => ({
  task: one(tasks, { fields: [taskProjects.taskId], references: [tasks.id] }),
  project: one(projects, { fields: [taskProjects.projectId], references: [projects.id] }),
}));
