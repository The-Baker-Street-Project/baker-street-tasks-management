import type { Priority } from "@/lib/types";

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; bgColor: string; borderColor: string; sortOrder: number }
> = {
  P0: {
    label: "Urgent",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-red-200 dark:border-red-800",
    sortOrder: 0,
  },
  P1: {
    label: "High",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    borderColor: "border-orange-200 dark:border-orange-800",
    sortOrder: 1,
  },
  P2: {
    label: "Medium",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    sortOrder: 2,
  },
  P3: {
    label: "Low",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-900",
    borderColor: "border-gray-200 dark:border-gray-800",
    sortOrder: 3,
  },
};

export function getPriorityLabel(priority: Priority | null): string {
  if (!priority) return "";
  return PRIORITY_CONFIG[priority].label;
}

export function getPriorityColor(priority: Priority | null): string {
  if (!priority) return "";
  return PRIORITY_CONFIG[priority].color;
}

export function getPrioritySortOrder(priority: Priority | null): number {
  if (!priority) return 999;
  return PRIORITY_CONFIG[priority].sortOrder;
}

export function comparePriority(a: Priority | null, b: Priority | null): number {
  return getPrioritySortOrder(a) - getPrioritySortOrder(b);
}
