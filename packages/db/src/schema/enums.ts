// SQLite has no native enum type. We define the allowed values as const arrays
// and export union types for type-safe column definitions.

export const taskStatusValues = [
  "Inbox",
  "Active",
  "Someday",
  "Done",
  "Archived",
] as const;
export type TaskStatus = (typeof taskStatusValues)[number];

export const contextValues = ["Home", "Work"] as const;
export type Context = (typeof contextValues)[number];

export const priorityValues = ["P0", "P1", "P2", "P3"] as const;
export type Priority = (typeof priorityValues)[number];

export const sourceValues = ["web_ui", "mcp"] as const;
export type Source = (typeof sourceValues)[number];

export const actorTypeValues = ["user", "ai"] as const;
export type ActorType = (typeof actorTypeValues)[number];

export const entityTypeValues = [
  "task",
  "subtask",
  "tag",
  "saved_view",
] as const;
export type EntityType = (typeof entityTypeValues)[number];

export const savedViewTypeValues = ["Tasks", "KanbanLane"] as const;
export type SavedViewType = (typeof savedViewTypeValues)[number];
