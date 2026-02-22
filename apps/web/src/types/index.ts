// Types derived from the DB schema in @baker-street/db

export type TaskStatus = "Inbox" | "Active" | "Someday" | "Done" | "Archived";
export type CaptureStatus = "Captured" | "Reviewed" | "Archived";
export type Context = "Home" | "Work";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type Source = "web_ui" | "mcp";
export type SavedViewType = "Tasks" | "Captures" | "KanbanLane";

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  orderIndex: string;
  createdBy: Source;
  agentId: string | null;
  requestId: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  context: Context | null;
  priority: Priority;
  dueAt: Date | null;
  startAt: Date | null;
  completedAt: Date | null;
  estimate: number | null;
  orderIndex: string;
  isFocus: boolean;
  createdBy: Source;
  agentId: string | null;
  sourceMessageId: string | null;
  requestId: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
  subtasks?: Subtask[];
  tags?: Tag[];
}

export interface Capture {
  id: string;
  title: string;
  body: string | null;
  status: CaptureStatus;
  pinned: boolean;
  context: Context | null;
  source: Source;
  nudgeAt: Date | null;
  createdBy: Source;
  agentId: string | null;
  sourceMessageId: string | null;
  requestId: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: Tag[];
}

export interface SavedView {
  id: string;
  name: string;
  type: SavedViewType;
  isSystem: boolean;
  isHidden: boolean;
  filterDefinition: Record<string, unknown> | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
