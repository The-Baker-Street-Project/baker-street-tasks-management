import { cn } from "@/lib/utils";
import type { Tag } from "@/types";

interface TagBadgeProps {
  tag: Tag;
  className?: string;
}

export function TagBadge({ tag, className }: TagBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium",
        tag.color
          ? undefined
          : "bg-secondary text-secondary-foreground",
        className
      )}
      style={
        tag.color
          ? {
              backgroundColor: `${tag.color}20`,
              color: tag.color,
            }
          : undefined
      }
    >
      {tag.name}
    </span>
  );
}
