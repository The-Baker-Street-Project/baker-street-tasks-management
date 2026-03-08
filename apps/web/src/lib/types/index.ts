// Re-export all types from the canonical location
export type {
  TaskStatus,
  Context,
  Priority,
  Source,
  SavedViewType,
  Tag,
  Subtask,
  Task,
  SavedView,
} from "@/types";

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: string;
  agentId: string | null;
  requestId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  undone: boolean;
  createdAt: Date;
}
