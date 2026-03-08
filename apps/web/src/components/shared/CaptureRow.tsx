"use client";

import Link from "next/link";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { AiBadge } from "./AiBadge";
import { TagBadge } from "./TagBadge";
import type { Capture } from "@/types";

interface CaptureRowProps {
  capture: Capture;
  compact?: boolean;
  href?: string;
}

export function CaptureRow({ capture, compact = false, href }: CaptureRowProps) {
  const content = (
    <div
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/50",
        compact && "py-1.5"
      )}
    >
      <div className="flex flex-1 min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          {capture.pinned && (
            <Pin className="h-3 w-3 shrink-0 fill-current text-amber-500" />
          )}
          <span className="truncate text-sm font-medium">{capture.title}</span>
          {capture.createdBy === "mcp" && <AiBadge />}
        </div>

        {!compact && capture.body && (
          <p className="truncate text-xs text-muted-foreground">
            {capture.body}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={capture.status} type="capture" />
          {capture.context && (
            <span className="text-xs text-muted-foreground">
              {capture.context}
            </span>
          )}
          {capture.tags && capture.tags.length > 0 && (
            <div className="flex gap-1">
              {capture.tags.slice(0, 2).map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
