import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardBlockProps {
  title: string;
  count?: number;
  viewAllHref?: string;
  icon?: React.ReactNode;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardBlock({
  title,
  count,
  viewAllHref,
  icon,
  emptyMessage = "Nothing here",
  children,
  className,
}: DashboardBlockProps) {
  const isEmpty =
    !children ||
    (Array.isArray(children) && children.length === 0) ||
    (children as React.ReactElement & { props?: { children?: unknown[] } })?.props?.children?.length === 0;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {count !== undefined && count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums">
              {count}
            </span>
          )}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1 px-2 pb-2">
        {isEmpty ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <div className="divide-y">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
