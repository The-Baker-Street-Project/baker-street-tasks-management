"use client";

import { useQueryState } from "nuqs";
import { cn } from "@/lib/utils";

export type CaptureTab = "recent" | "pinned" | "reviewed" | "archived";

const TABS: { value: CaptureTab; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "pinned", label: "Pinned" },
  { value: "reviewed", label: "Reviewed" },
  { value: "archived", label: "Archived" },
];

interface CaptureFilterTabsProps {
  counts?: Record<CaptureTab, number>;
}

export function CaptureFilterTabs({ counts }: CaptureFilterTabsProps) {
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "recent" as CaptureTab,
  });

  return (
    <div className="flex border-b">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => setActiveTab(tab.value)}
          className={cn(
            "relative px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === tab.value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {counts && counts[tab.value] > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold">
              {counts[tab.value]}
            </span>
          )}
          {activeTab === tab.value && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
