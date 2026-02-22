"use client";

import { useQueryState } from "nuqs";
import {
  Inbox,
  Zap,
  CalendarClock,
  Archive,
  ListChecks,
  Tag as TagIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedView, Tag } from "@/types";

interface TaskSidebarProps {
  savedViews: SavedView[];
  tags: Tag[];
}

const SYSTEM_ICONS: Record<string, React.ReactNode> = {
  "All Tasks": <ListChecks className="h-4 w-4" />,
  Inbox: <Inbox className="h-4 w-4" />,
  Active: <Zap className="h-4 w-4" />,
  Someday: <CalendarClock className="h-4 w-4" />,
  Archived: <Archive className="h-4 w-4" />,
};

export function TaskSidebar({ savedViews, tags }: TaskSidebarProps) {
  const [selectedView, setSelectedView] = useQueryState("view", {
    defaultValue: "all",
  });
  const [selectedTag, setSelectedTag] = useQueryState("tag");

  const systemViews: SavedView[] =
    savedViews.length > 0
      ? savedViews.filter((v) => v.isSystem)
      : [
          {
            id: "all",
            name: "All Tasks",
            type: "Tasks" as const,
            isSystem: true,
            isHidden: false,
            filterDefinition: null,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "inbox",
            name: "Inbox",
            type: "Tasks" as const,
            isSystem: true,
            isHidden: false,
            filterDefinition: { status: ["Inbox"] },
            sortOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "active",
            name: "Active",
            type: "Tasks" as const,
            isSystem: true,
            isHidden: false,
            filterDefinition: { status: ["Active"] },
            sortOrder: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

  const customViews = savedViews.filter((v) => !v.isSystem && !v.isHidden);

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar-background">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-6">
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Saved Views
          </h3>
          <nav className="space-y-0.5">
            {systemViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => {
                  setSelectedView(view.id);
                  setSelectedTag(null);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  selectedView === view.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                {SYSTEM_ICONS[view.name] ?? (
                  <ListChecks className="h-4 w-4" />
                )}
                {view.name}
              </button>
            ))}
          </nav>
        </div>

        {customViews.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              Custom Views
            </h3>
            <nav className="space-y-0.5">
              {customViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => {
                    setSelectedView(view.id);
                    setSelectedTag(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                    selectedView === view.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <ListChecks className="h-4 w-4" />
                  {view.name}
                </button>
              ))}
            </nav>
          </div>
        )}

        <div>
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Tags
          </h3>
          {tags.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">No tags yet</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 px-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    if (selectedTag === tag.id) {
                      setSelectedTag(null);
                    } else {
                      setSelectedTag(tag.id);
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                    selectedTag === tag.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  <TagIcon className="h-3 w-3" />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
