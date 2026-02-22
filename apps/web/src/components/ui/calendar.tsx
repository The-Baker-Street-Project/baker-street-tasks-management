"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface CalendarProps {
  mode?: "single";
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  className?: string;
  disabled?: (date: Date) => boolean;
  initialFocus?: boolean;
}

function Calendar({
  mode = "single",
  selected,
  onSelect,
  className,
  disabled,
  initialFocus,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    selected ? startOfMonth(selected) : startOfMonth(new Date())
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className={cn("p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium">
          {format(currentMonth, "MMMM yyyy")}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <th key={d} className="text-muted-foreground text-xs font-medium p-2 text-center">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((d, di) => {
                const isDisabled = disabled?.(d) ?? false;
                const isSelected = selected ? isSameDay(d, selected) : false;
                const isCurrentMonth = isSameMonth(d, currentMonth);
                const isToday = isSameDay(d, new Date());
                return (
                  <td key={di} className="text-center p-0">
                    <button
                      type="button"
                      disabled={isDisabled}
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                        !isCurrentMonth && "text-muted-foreground opacity-50",
                        isSelected && "bg-primary text-primary-foreground",
                        !isSelected && isToday && "bg-accent text-accent-foreground",
                        !isSelected && !isToday && "hover:bg-accent hover:text-accent-foreground",
                        isDisabled && "pointer-events-none opacity-50"
                      )}
                      onClick={() => onSelect?.(isSelected ? undefined : d)}
                    >
                      {format(d, "d")}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { Calendar };
export type { CalendarProps };
