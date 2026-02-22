import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  isPast,
  differenceInDays,
  differenceInHours,
  startOfDay,
} from "date-fns";

export function formatDueDate(date: Date | null): string {
  if (!date) return "";
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";

  const daysAway = differenceInDays(startOfDay(date), startOfDay(new Date()));
  if (daysAway > 0 && daysAway <= 6) {
    return format(date, "EEEE"); // e.g., "Wednesday"
  }
  if (daysAway > 6 && daysAway <= 365) {
    return format(date, "MMM d"); // e.g., "Mar 15"
  }
  return format(date, "MMM d, yyyy"); // e.g., "Mar 15, 2026"
}

export function isOverdue(date: Date | null): boolean {
  if (!date) return false;
  return isPast(date) && !isToday(date);
}

export function isDueToday(date: Date | null): boolean {
  if (!date) return false;
  return isToday(date);
}

export function relativeDate(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const hours = differenceInHours(now, date);

  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;

  const days = differenceInDays(now, date);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}

export function formatDateTime(date: Date | null): string {
  if (!date) return "";
  return format(date, "MMM d, yyyy 'at' h:mm a");
}
