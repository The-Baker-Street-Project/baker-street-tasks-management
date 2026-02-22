import type { TaskStatus, CaptureStatus } from "@/lib/types";

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  Inbox: {
    label: "Inbox",
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    icon: "inbox",
  },
  Active: {
    label: "Active",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900",
    icon: "circle-play",
  },
  Someday: {
    label: "Someday",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-100 dark:bg-purple-900",
    icon: "cloud",
  },
  Done: {
    label: "Done",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900",
    icon: "check-circle",
  },
  Archived: {
    label: "Archived",
    color: "text-gray-500 dark:text-gray-500",
    bgColor: "bg-gray-50 dark:bg-gray-900",
    icon: "archive",
  },
};

export const CAPTURE_STATUS_CONFIG: Record<
  CaptureStatus,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  Captured: {
    label: "Captured",
    color: "text-yellow-700 dark:text-yellow-300",
    bgColor: "bg-yellow-100 dark:bg-yellow-900",
    icon: "zap",
  },
  Reviewed: {
    label: "Reviewed",
    color: "text-teal-700 dark:text-teal-300",
    bgColor: "bg-teal-100 dark:bg-teal-900",
    icon: "eye",
  },
  Archived: {
    label: "Archived",
    color: "text-gray-500 dark:text-gray-500",
    bgColor: "bg-gray-50 dark:bg-gray-900",
    icon: "archive",
  },
};

export function getTaskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_CONFIG[status].label;
}

export function getTaskStatusColor(status: TaskStatus): string {
  return TASK_STATUS_CONFIG[status].color;
}

export function getCaptureStatusLabel(status: CaptureStatus): string {
  return CAPTURE_STATUS_CONFIG[status].label;
}

export function getCaptureStatusColor(status: CaptureStatus): string {
  return CAPTURE_STATUS_CONFIG[status].color;
}
