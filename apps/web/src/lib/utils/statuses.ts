import type { TaskStatus } from "@/lib/types";

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  Inbox: {
    label: "Inbox",
    color: "text-[var(--status-inbox)]",
    bgColor: "bg-[var(--status-inbox-bg)]",
    icon: "inbox",
  },
  Active: {
    label: "Active",
    color: "text-[var(--status-active)]",
    bgColor: "bg-[var(--status-active-bg)]",
    icon: "circle-play",
  },
  Someday: {
    label: "Someday",
    color: "text-[var(--status-someday)]",
    bgColor: "bg-[var(--status-someday-bg)]",
    icon: "cloud",
  },
  Done: {
    label: "Done",
    color: "text-[var(--status-done)]",
    bgColor: "bg-[var(--status-done-bg)]",
    icon: "check-circle",
  },
  Archived: {
    label: "Archived",
    color: "text-[var(--status-archived)]",
    bgColor: "bg-[var(--status-archived-bg)]",
    icon: "archive",
  },
};

export function getTaskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_CONFIG[status].label;
}

export function getTaskStatusColor(status: TaskStatus): string {
  return TASK_STATUS_CONFIG[status].color;
}
