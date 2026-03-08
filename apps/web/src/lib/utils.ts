import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0 && days <= 7) return `In ${days} days`;
  if (days < 0 && days >= -7) return `${Math.abs(days)} days ago`;
  return formatDate(date);
}

export function priorityLabel(priority: string): string {
  const map: Record<string, string> = {
    P0: "Urgent",
    P1: "High",
    P2: "Medium",
    P3: "Low",
  };
  return map[priority] ?? priority;
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    P0: "text-[var(--priority-p0)] bg-[var(--priority-p0-bg)] border-[var(--priority-p0-border)]",
    P1: "text-[var(--priority-p1)] bg-[var(--priority-p1-bg)] border-[var(--priority-p1-border)]",
    P2: "text-[var(--priority-p2)] bg-[var(--priority-p2-bg)] border-[var(--priority-p2-border)]",
    P3: "text-[var(--priority-p3)] bg-[var(--priority-p3-bg)] border-[var(--priority-p3-border)]",
  };
  return map[priority] ?? "text-[var(--priority-p3)] bg-[var(--priority-p3-bg)] border-[var(--priority-p3-border)]";
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    Inbox: "text-[var(--status-inbox)] bg-[var(--status-inbox-bg)]",
    Active: "text-[var(--status-active)] bg-[var(--status-active-bg)]",
    Someday: "text-[var(--status-someday)] bg-[var(--status-someday-bg)]",
    Done: "text-[var(--status-done)] bg-[var(--status-done-bg)]",
    Archived: "text-[var(--status-archived)] bg-[var(--status-archived-bg)]",
  };
  return map[status] ?? "text-[var(--status-inbox)] bg-[var(--status-inbox-bg)]";
}
