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
import { ChevronDown, Home, Briefcase } from "lucide-react";
import { createCapture } from "@/lib/api/captures";
import type { Context } from "@/types";

interface CaptureCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CaptureCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: CaptureCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setTitle("");
    setBody("");
    setContext(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      try {
        await createCapture({
          title: title.trim(),
          body: body.trim() || null,
          context,
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
            <DialogTitle>Quick Capture</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <label
                htmlFor="capture-title"
                className="text-sm font-medium"
              >
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="capture-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's on your mind?"
                autoFocus
              />
            </div>

            {/* Body */}
            <div className="space-y-1">
              <label
                htmlFor="capture-body"
                className="text-sm font-medium"
              >
                Details
              </label>
              <textarea
                id="capture-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Optional details..."
                className="w-full min-h-[60px] resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
              />
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
              {isPending ? "Capturing..." : "Capture"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
