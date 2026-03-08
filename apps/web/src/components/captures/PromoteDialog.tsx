"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Home, Briefcase } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityIndicator } from "@/components/shared/PriorityIndicator";
import { promoteCapture } from "@/lib/api/captures";
import type { Capture, TaskStatus, Priority, Context } from "@/types";

interface PromoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capture: Capture;
  onPromoted: () => void;
}

const STATUSES: TaskStatus[] = ["Inbox", "Active", "Someday"];
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

export function PromoteDialog({
  open,
  onOpenChange,
  capture,
  onPromoted,
}: PromoteDialogProps) {
  const [title, setTitle] = useState(capture.title);
  const [notes, setNotes] = useState(capture.body ?? "");
  const [status, setStatus] = useState<TaskStatus>("Inbox");
  const [priority, setPriority] = useState<Priority>("P3");
  const [context, setContext] = useState<Context | null>(capture.context);
  const [isPending, startTransition] = useTransition();

  // Reset form when capture changes
  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTitle(capture.title);
      setNotes(capture.body ?? "");
      setStatus("Inbox");
      setPriority("P3");
      setContext(capture.context);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      try {
        await promoteCapture(capture.id, {
          title: title.trim(),
          notes: notes.trim() || null,
          status,
          priority,
          context,
        });
        onOpenChange(false);
        onPromoted();
      } catch {
        // Server action not yet implemented
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Promote to Task</DialogTitle>
            <DialogDescription>
              Create a new task from this capture. The capture will be archived
              after promotion.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <label
                htmlFor="promote-title"
                className="text-sm font-medium"
              >
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="promote-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label
                htmlFor="promote-notes"
                className="text-sm font-medium"
              >
                Notes
              </label>
              <textarea
                id="promote-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Task notes..."
                className="w-full min-h-[60px] resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
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
              <div className="col-span-2 space-y-1">
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
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isPending}
            >
              {isPending ? "Promoting..." : "Promote to Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
