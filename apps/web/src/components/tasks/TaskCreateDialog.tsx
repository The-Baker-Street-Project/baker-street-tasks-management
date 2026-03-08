"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Calendar,
  Home,
  Briefcase,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityIndicator } from "@/components/shared/PriorityIndicator";
import { createTask } from "@/lib/api/tasks";
import type { TaskStatus, Priority, Context } from "@/types";

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const STATUSES: TaskStatus[] = ["Inbox", "Active", "Someday"];
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

export function TaskCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<TaskStatus>("Inbox");
  const [priority, setPriority] = useState<Priority>("P3");
  const [context, setContext] = useState<Context | null>(null);
  const [dueAt, setDueAt] = useState("");
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setTitle("");
    setNotes("");
    setStatus("Inbox");
    setPriority("P3");
    setContext(null);
    setDueAt("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      try {
        await createTask({
          title: title.trim(),
          notes: notes.trim() || null,
          status,
          priority,
          context,
          dueAt: dueAt ? new Date(dueAt) : null,
        });
        reset();
        onOpenChange(false);
        onCreated();
      } catch {
        // Server action not yet implemented
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <label
                htmlFor="task-title"
                className="text-sm font-medium"
              >
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label
                htmlFor="task-notes"
                className="text-sm font-medium"
              >
                Notes
              </label>
              <textarea
                id="task-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add details..."
                className="w-full min-h-[60px] resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Status
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-between"
                    >
                      <StatusBadge status={status} type="task" />
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {STATUSES.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => setStatus(s)}
                        className="cursor-pointer"
                      >
                        <StatusBadge status={s} type="task" className="mr-2" />
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
                      type="button"
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
                        onClick={() => setPriority(p)}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-between"
                    >
                      {context === "Home" && (
                        <span className="flex items-center gap-1">
                          <Home className="h-3.5 w-3.5" /> Home
                        </span>
                      )}
                      {context === "Work" && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5" /> Work
                        </span>
                      )}
                      {context === null && (
                        <span className="text-muted-foreground">None</span>
                      )}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => setContext(null)}
                      className="cursor-pointer"
                    >
                      None
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setContext("Home")}
                      className="cursor-pointer"
                    >
                      <Home className="mr-2 h-3.5 w-3.5" /> Home
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setContext("Work")}
                      className="cursor-pointer"
                    >
                      <Briefcase className="mr-2 h-3.5 w-3.5" /> Work
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Due Date */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Due Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isPending}
            >
              {isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
