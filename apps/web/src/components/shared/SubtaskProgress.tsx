import { cn } from "@/lib/utils";

interface SubtaskProgressProps {
  done: number;
  total: number;
  className?: string;
}

export function SubtaskProgress({ done, total, className }: SubtaskProgressProps) {
  const percentage = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            percentage === 100
              ? "bg-green-500"
              : percentage > 0
                ? "bg-primary"
                : "bg-transparent"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}
