import { pgEnum } from "drizzle-orm/pg-core";

export const taskStatusEnum = pgEnum("task_status", [
  "Inbox",
  "Active",
  "Someday",
  "Done",
  "Archived",
]);

export const captureStatusEnum = pgEnum("capture_status", [
  "Captured",
  "Reviewed",
  "Archived",
]);

export const contextEnum = pgEnum("context", ["Home", "Work"]);

export const priorityEnum = pgEnum("priority", ["P0", "P1", "P2", "P3"]);

export const sourceEnum = pgEnum("source", ["web_ui", "mcp"]);

export const actorTypeEnum = pgEnum("actor_type", ["user", "ai"]);

export const entityTypeEnum = pgEnum("entity_type", [
  "task",
  "subtask",
  "capture",
  "tag",
  "saved_view",
]);

export const savedViewTypeEnum = pgEnum("saved_view_type", [
  "Tasks",
  "Captures",
  "KanbanLane",
]);
