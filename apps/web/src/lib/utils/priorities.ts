import type { Priority } from "@/lib/types";

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; bgColor: string; borderColor: string; sortOrder: number }
> = {
  P0: {
    label: "Urgent",
    color: "text-[var(--priority-p0)]",
    bgColor: "bg-[var(--priority-p0-bg)]",
    borderColor: "border-[var(--priority-p0-border)]",
    sortOrder: 0,
  },
  P1: {
    label: "High",
    color: "text-[var(--priority-p1)]",
    bgColor: "bg-[var(--priority-p1-bg)]",
    borderColor: "border-[var(--priority-p1-border)]",
    sortOrder: 1,
  },
  P2: {
    label: "Medium",
    color: "text-[var(--priority-p2)]",
    bgColor: "bg-[var(--priority-p2-bg)]",
    borderColor: "border-[var(--priority-p2-border)]",
    sortOrder: 2,
  },
  P3: {
    label: "Low",
    color: "text-[var(--priority-p3)]",
    bgColor: "bg-[var(--priority-p3-bg)]",
    borderColor: "border-[var(--priority-p3-border)]",
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
