"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import {
  Star,
  Calendar,
  Clock,
  Timer,
  Home,
  Briefcase,
  Trash2,
  X,
  ChevronDown,
  Eye,
  Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityIndicator } from "@/components/shared/PriorityIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SubtasksPanel,
  TagsPanel,
  AIMetadataPanel,
} from "./TaskDetailPanels";
import { updateTask, deleteTask, removeTagFromTask, addTagToTask, toggleSubtask } from "@/lib/api/tasks";
import type { Task, TaskStatus, Priority, Context, Tag } from "@/types";

interface TaskDetailProps {
  task: Task;
  allTags?: Tag[];
  onClose: () => void;
  onRefresh: () => void;
}

const STATUSES: TaskStatus[] = ["Inbox", "Active", "Someday", "Done", "Archived"];
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

export function TaskDetail({ task, allTags, onClose, onRefresh }: TaskDetailProps) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [context, setContext] = useState<Context | null>(task.context);
  const [isFocus, setIsFocus] = useState(task.isFocus);
  const [dueAt, setDueAt] = useState(
    task.dueAt ? new Date(task.dueAt).toISOString().split("T")[0] : ""
  );
  const [startAt, setStartAt] = useState(
    task.startAt ? new Date(task.startAt).toISOString().split("T")[0] : ""
  );
  const [estimate, setEstimate] = useState(
    task.estimate?.toString() ?? ""
  );
  const [notesPreview, setNotesPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSubtaskWarning, setShowSubtaskWarning] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when task prop changes
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setContext(task.context);
    setIsFocus(task.isFocus);
    setDueAt(task.dueAt ? new Date(task.dueAt).toISOString().split("T")[0] : "");
    setStartAt(task.startAt ? new Date(task.startAt).toISOString().split("T")[0] : "");
    setEstimate(task.estimate?.toString() ?? "");
  }, [task]);

  // Reset preview mode when task changes
  useEffect(() => {
    setNotesPreview(false);
  }, [task.id]);

  // Auto-resize textarea
  useEffect(() => {
    const el = notesRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [notes]);

  const saveField = useCallback(
    (field: string, value: unknown) => {
      startTransition(async () => {
        try {
          await updateTask(task.id, { [field]: value });
          onRefresh();
        } catch {
          toast.error("Failed to update task");
        }
      });
    },
    [task.id, onRefresh]
  );

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      saveField("title", title.trim());
    }
  };

  const handleNotesBlur = () => {
    if (notes !== (task.notes ?? "")) {
      saveField("notes", notes || null);
    }
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    // Check for incomplete subtasks when marking as Done
    if (newStatus === "Done") {
      const incompleteSubtasks = (task.subtasks ?? []).filter((s) => !s.done);
      if (incompleteSubtasks.length > 0) {
        setPendingStatus(newStatus);
        setShowSubtaskWarning(true);
        return;
      }
    }
    setStatus(newStatus);
    saveField("status", newStatus);
  };

  const handleConfirmComplete = () => {
    setShowSubtaskWarning(false);
    if (pendingStatus) {
      setStatus(pendingStatus);
      // Auto-complete all subtasks, then set parent status
      startTransition(async () => {
        try {
          const incompleteSubtasks = (task.subtasks ?? []).filter((s) => !s.done);
          for (const subtask of incompleteSubtasks) {
            await toggleSubtask(subtask.id, true);
          }
          await updateTask(task.id, { status: pendingStatus });
          onRefresh();
          toast.success("Task completed");
        } catch {
          toast.error("Failed to complete task");
        }
      });
      setPendingStatus(null);
    }
  };

  const handlePriorityChange = (newPriority: Priority) => {
    setPriority(newPriority);
    saveField("priority", newPriority);
  };

  const handleContextToggle = () => {
    const next: (Context | null)[] = [null, "Home", "Work"];
    const currentIdx = next.indexOf(context);
    const newContext = next[(currentIdx + 1) % next.length];
    setContext(newContext);
    saveField("context", newContext);
  };

  const handleFocusToggle = () => {
    setIsFocus(!isFocus);
    saveField("isFocus", !isFocus);
  };

  const handleDueDateChange = (value: string) => {
    setDueAt(value);
    saveField("dueAt", value ? new Date(value) : null);
  };

  const handleStartDateChange = (value: string) => {
    setStartAt(value);
    saveField("startAt", value ? new Date(value) : null);
  };

  const handleEstimateBlur = () => {
    const num = estimate ? parseInt(estimate, 10) : null;
    if (num !== task.estimate) {
      saveField("estimate", Number.isNaN(num) ? null : num);
    }
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteTask(task.id);
        onClose();
        onRefresh();
        toast.success("Task deleted");
      } catch {
        toast.error("Failed to delete task");
      }
    });
  };

  const handleRemoveTag = (tagId: string) => {
    startTransition(async () => {
      try {
        await removeTagFromTask(task.id, tagId);
        onRefresh();
      } catch {
        toast.error("Failed to update tags");
      }
    });
  };

  const handleAddTag = (tagId: string) => {
    startTransition(async () => {
      try {
        await addTagToTask(task.id, tagId);
        onRefresh();
      } catch {
        toast.error("Failed to update tags");
      }
    });
  };

  return (
    <div className="flex h-full w-[480px] flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {isPending && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-full bg-transparent text-xl font-semibold outline-none placeholder:text-muted-foreground"
            placeholder="Task title"
          />

          {/* Controls row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                  >
                    {status}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={cn("cursor-pointer", status === s && "font-semibold")}
                    >
                      <StatusBadge status={s} className="mr-2" />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Priority
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                  >
                    <PriorityIndicator priority={priority} />
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {PRIORITIES.map((p) => (
                    <DropdownMenuItem
                      key={p}
                      onClick={() => handlePriorityChange(p)}
                      className="cursor-pointer"
                    >
                      <PriorityIndicator priority={p} className="mr-2" />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Context */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Context
              </label>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={handleContextToggle}
              >
                {context === "Home" && (
                  <>
                    <Home className="h-3.5 w-3.5" /> Home
                  </>
                )}
                {context === "Work" && (
                  <>
                    <Briefcase className="h-3.5 w-3.5" /> Work
                  </>
                )}
                {context === null && (
                  <span className="text-muted-foreground">None</span>
                )}
              </Button>
            </div>

            {/* Focus */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Focus
              </label>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full justify-start gap-2",
                  isFocus && "border-yellow-500/50 bg-yellow-500/10"
                )}
                onClick={handleFocusToggle}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    isFocus
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  )}
                />
                {isFocus ? "Focused" : "Not focused"}
              </Button>
            </div>

            {/* Due date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Due Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={dueAt}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>

            {/* Start date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Start Date
              </label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={startAt}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>

            {/* Estimate */}
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Estimate (minutes)
              </label>
              <div className="relative">
                <Timer className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  onBlur={handleEstimateBlur}
                  placeholder="e.g. 30"
                  className="h-8 pl-8 text-sm"
                  min={0}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Notes
              </label>
              {task.notes && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setNotesPreview(!notesPreview)}
                      aria-label={notesPreview ? "Edit notes" : "Preview markdown"}
                    >
                      {notesPreview ? (
                        <Pencil className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {notesPreview ? "Edit notes" : "Preview markdown"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {notesPreview ? (
              task.notes?.trim() ? (
                <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border border-input px-3 py-2">
                  <ReactMarkdown
                    components={{
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" />
                      ),
                    }}
                  >
                    {task.notes}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="rounded-md border border-input px-3 py-2 text-sm text-muted-foreground">
                  Add notes...
                </div>
              )
            ) : (
              <textarea
                ref={notesRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add notes..."
                className="w-full min-h-[80px] resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
              />
            )}
          </div>

          <Separator />

          {/* Subtasks */}
          <SubtasksPanel
            taskId={task.id}
            subtasks={task.subtasks ?? []}
            onRefresh={onRefresh}
          />

          <Separator />

          {/* Tags */}
          <TagsPanel
            tags={task.tags ?? []}
            allTags={allTags}
            onRemoveTag={handleRemoveTag}
            onAddTag={handleAddTag}
          />

          {/* AI Metadata */}
          <AIMetadataPanel
            createdBy={task.createdBy}
            agentId={task.agentId}
            sourceMessageId={task.sourceMessageId}
            requestId={task.requestId}
            reason={task.reason}
          />

          <Separator />

          {/* Timestamps */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Created: {formatDateTime(task.createdAt)}</p>
            <p>Updated: {formatDateTime(task.updatedAt)}</p>
            {task.completedAt && (
              <p>Completed: {formatDateTime(task.completedAt)}</p>
            )}
          </div>

          {/* Delete */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete task</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{task.title}&quot;? This
                  action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

      {/* Subtask completion warning */}
      <Dialog open={showSubtaskWarning} onOpenChange={setShowSubtaskWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Incomplete subtasks</DialogTitle>
            <DialogDescription>
              This task has {(task.subtasks ?? []).filter((s) => !s.done).length} incomplete
              subtask(s). Completing the task will also mark all subtasks as done.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSubtaskWarning(false);
                setPendingStatus(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmComplete} disabled={isPending}>
              Complete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
