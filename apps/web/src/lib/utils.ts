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
    P0: "text-red-600 bg-red-50 border-red-200",
    P1: "text-orange-600 bg-orange-50 border-orange-200",
    P2: "text-blue-600 bg-blue-50 border-blue-200",
    P3: "text-gray-600 bg-gray-50 border-gray-200",
  };
  return map[priority] ?? "text-gray-600 bg-gray-50 border-gray-200";
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    Inbox: "text-gray-700 bg-gray-100",
    Active: "text-blue-700 bg-blue-100",
    Someday: "text-purple-700 bg-purple-100",
    Done: "text-green-700 bg-green-100",
    Archived: "text-gray-500 bg-gray-50",
    Captured: "text-yellow-700 bg-yellow-100",
    Reviewed: "text-teal-700 bg-teal-100",
  };
  return map[status] ?? "text-gray-700 bg-gray-100";
}
