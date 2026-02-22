"use client";

import { useState, useTransition } from "react";
import {
  GripVertical,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createSubtask,
  toggleSubtask,
  deleteSubtask,
} from "@/lib/api/tasks";
import type { Subtask, Tag, Source } from "@/types";

// ── Subtasks Panel ──────────────────────────────────────────────

interface SubtasksPanelProps {
  taskId: string;
  subtasks: Subtask[];
  onRefresh: () => void;
}

export function SubtasksPanel({
  taskId,
  subtasks,
  onRefresh,
}: SubtasksPanelProps) {
  const [newTitle, setNewTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const doneCount = subtasks.filter((s) => s.done).length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    startTransition(async () => {
      try {
        await createSubtask({ taskId, title });
        setNewTitle("");
        onRefresh();
      } catch {
        // Server action not yet implemented
      }
    });
  };

  const handleToggle = (subtask: Subtask) => {
    startTransition(async () => {
      try {
        await toggleSubtask(subtask.id, !subtask.done);
        onRefresh();
      } catch {
        // Server action not yet implemented
      }
    });
  };

  const handleDelete = (subtaskId: string) => {
    startTransition(async () => {
      try {
        await deleteSubtask(subtaskId);
        onRefresh();
      } catch {
        // Server action not yet implemented
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Subtasks</h4>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {doneCount}/{totalCount}
          </span>
        )}
      </div>

      {totalCount > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {subtasks
          .sort((a, b) => a.orderIndex.localeCompare(b.orderIndex))
          .map((subtask) => (
            <div
              key={subtask.id}
              className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/50"
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100" />
              <button
                type="button"
                onClick={() => handleToggle(subtask)}
                className="shrink-0"
                disabled={isPending}
              >
                {subtask.done ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm",
                  subtask.done && "line-through text-muted-foreground"
                )}
              >
                {subtask.title}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(subtask.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100"
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add subtask..."
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          disabled={isPending}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={isPending || !newTitle.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Tags Panel ──────────────────────────────────────────────────

interface TagsPanelProps {
  tags: Tag[];
  allTags?: Tag[];
  onRemoveTag: (tagId: string) => void;
  onAddTag?: (tagId: string) => void;
}

export function TagsPanel({ tags, allTags = [], onRemoveTag, onAddTag }: TagsPanelProps) {
  const assignedIds = new Set(tags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !assignedIds.has(t.id));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Tags</h4>
      {tags.length === 0 && availableTags.length === 0 && (
        <p className="text-xs text-muted-foreground">No tags</p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 pl-2 pr-1"
            >
              {tag.color && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
              <button
                type="button"
                onClick={() => onRemoveTag(tag.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {onAddTag && availableTags.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Add tag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {availableTags.map((tag) => (
              <DropdownMenuItem
                key={tag.id}
                onClick={() => onAddTag(tag.id)}
                className="cursor-pointer gap-2"
              >
                {tag.color && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                {tag.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ── AI Metadata Panel ───────────────────────────────────────────

interface AIMetadataPanelProps {
  createdBy: Source;
  agentId: string | null;
  sourceMessageId: string | null;
  requestId: string | null;
  reason: string | null;
}

export function AIMetadataPanel({
  createdBy,
  agentId,
  reason,
}: AIMetadataPanelProps) {
  if (createdBy !== "mcp") return null;

  return (
    <div className="space-y-2">
      <Separator />
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">AI Created</h4>
      </div>
      <div className="space-y-1 rounded-md bg-muted p-3 text-xs">
        {agentId && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Agent</span>
            <span className="font-mono">{agentId}</span>
          </div>
        )}
        {reason && (
          <div>
            <span className="text-muted-foreground">Reason:</span>
            <p className="mt-0.5">{reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
