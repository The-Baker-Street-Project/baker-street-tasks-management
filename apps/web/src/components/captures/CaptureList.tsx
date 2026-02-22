"use client";

import { useQueryState } from "nuqs";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CaptureRow as SharedCaptureRow } from "@/components/shared/CaptureRow";
import type { Capture } from "@/types";
import type { CaptureTab } from "./CaptureFilterTabs";

interface CaptureListProps {
  captures: Capture[];
  isLoading?: boolean;
  onCreateClick: () => void;
}

function CaptureRowSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b px-4 py-3 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: string }) {
  const messages: Record<string, string> = {
    recent: "No recent captures. Add one to get started.",
    pinned: "No pinned captures.",
    reviewed: "No reviewed captures.",
    archived: "No archived captures.",
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-muted p-4">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No captures</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {messages[tab] ?? messages.recent}
      </p>
    </div>
  );
}

export function CaptureList({
  captures,
  isLoading = false,
  onCreateClick,
}: CaptureListProps) {
  const [selectedCaptureId, setSelectedCaptureId] = useQueryState("captureId");
  const [activeTab] = useQueryState("tab", {
    defaultValue: "recent" as CaptureTab,
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold">Captures</h2>
        <Button size="sm" onClick={onCreateClick}>
          + New
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <CaptureRowSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && captures.length === 0 && (
        <EmptyState tab={activeTab ?? "recent"} />
      )}

      {/* List */}
      {!isLoading && captures.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {captures.map((capture) => (
            <button
              key={capture.id}
              type="button"
              onClick={() => setSelectedCaptureId(capture.id)}
              className={cn(
                "w-full border-b transition-colors",
                selectedCaptureId === capture.id
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              )}
            >
              <SharedCaptureRow capture={capture} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
