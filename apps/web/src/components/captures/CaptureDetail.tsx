"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import {
  Pin,
  PinOff,
  Calendar,
  Home,
  Briefcase,
  Trash2,
  X,
  ArrowRightCircle,
  ChevronDown,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
import { updateCapture, deleteCapture, removeTagFromCapture } from "@/lib/api/captures";
import { PromoteDialog } from "./PromoteDialog";
import type { Capture, CaptureStatus, Context } from "@/types";

interface CaptureDetailProps {
  capture: Capture;
  onClose: () => void;
  onRefresh: () => void;
}

const STATUSES: CaptureStatus[] = ["Captured", "Reviewed", "Archived"];

export function CaptureDetail({
  capture,
  onClose,
  onRefresh,
}: CaptureDetailProps) {
  const [title, setTitle] = useState(capture.title);
  const [body, setBody] = useState(capture.body ?? "");
  const [status, setStatus] = useState<CaptureStatus>(capture.status);
  const [pinned, setPinned] = useState(capture.pinned);
  const [context, setContext] = useState<Context | null>(capture.context);
  const [nudgeAt, setNudgeAt] = useState(
    capture.nudgeAt
      ? new Date(capture.nudgeAt).toISOString().split("T")[0]
      : ""
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitle(capture.title);
    setBody(capture.body ?? "");
    setStatus(capture.status);
    setPinned(capture.pinned);
    setContext(capture.context);
    setNudgeAt(
      capture.nudgeAt
        ? new Date(capture.nudgeAt).toISOString().split("T")[0]
        : ""
    );
  }, [capture]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [body]);

  const saveField = useCallback(
    (field: string, value: unknown) => {
      startTransition(async () => {
        try {
          await updateCapture(capture.id, { [field]: value });
          onRefresh();
        } catch {
          // Server action not yet implemented
        }
      });
    },
    [capture.id, onRefresh]
  );

  const handleTitleBlur = () => {
    if (title.trim() && title !== capture.title) {
      saveField("title", title.trim());
    }
  };

  const handleBodyBlur = () => {
    if (body !== (capture.body ?? "")) {
      saveField("body", body || null);
    }
  };

  const handleStatusChange = (newStatus: CaptureStatus) => {
    setStatus(newStatus);
    saveField("status", newStatus);
  };

  const handlePinToggle = () => {
    setPinned(!pinned);
    saveField("pinned", !pinned);
  };

  const handleContextToggle = () => {
    const next: (Context | null)[] = [null, "Home", "Work"];
    const currentIdx = next.indexOf(context);
    const newContext = next[(currentIdx + 1) % next.length];
    setContext(newContext);
    saveField("context", newContext);
  };

  const handleNudgeDateChange = (value: string) => {
    setNudgeAt(value);
    saveField("nudgeAt", value ? new Date(value) : null);
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteCapture(capture.id);
        onClose();
        onRefresh();
      } catch {
        // Server action not yet implemented
      }
    });
  };

  const handleRemoveTag = (tagId: string) => {
    startTransition(async () => {
      try {
        await removeTagFromCapture(capture.id, tagId);
        onRefresh();
      } catch {
        // Server action not yet implemented
      }
    });
  };

  return (
    <div className="flex h-full w-[480px] flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} type="capture" />
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
            placeholder="Capture title"
          />

          {/* Body */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Body
            </label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={handleBodyBlur}
              placeholder="Add details..."
              className="w-full min-h-[100px] resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={4}
            />
          </div>

          {/* Controls */}
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
                      className={cn(
                        "cursor-pointer",
                        status === s && "font-semibold"
                      )}
                    >
                      <StatusBadge status={s} type="capture" className="mr-2" />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Pin */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Pin
              </label>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full justify-start gap-2",
                  pinned && "border-amber-300 bg-amber-50"
                )}
                onClick={handlePinToggle}
              >
                {pinned ? (
                  <>
                    <PinOff className="h-3.5 w-3.5" /> Unpin
                  </>
                ) : (
                  <>
                    <Pin className="h-3.5 w-3.5" /> Pin
                  </>
                )}
              </Button>
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

            {/* Nudge date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Nudge Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={nudgeAt}
                  onChange={(e) => handleNudgeDateChange(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Tags */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Tags</h4>
            {(!capture.tags || capture.tags.length === 0) ? (
              <p className="text-xs text-muted-foreground">No tags</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {capture.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="gap-1 pl-2 pr-1"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* AI Metadata */}
          {capture.createdBy === "mcp" && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">AI Created</h4>
                </div>
                <div className="space-y-1 rounded-md bg-muted p-3 text-xs">
                  {capture.agentId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Agent</span>
                      <span className="font-mono">{capture.agentId}</span>
                    </div>
                  )}
                  {capture.reason && (
                    <div>
                      <span className="text-muted-foreground">Reason:</span>
                      <p className="mt-0.5">{capture.reason}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Timestamps */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Created: {formatDateTime(capture.createdAt)}</p>
            <p>Updated: {formatDateTime(capture.updatedAt)}</p>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setShowPromote(true)}
            >
              <ArrowRightCircle className="h-4 w-4" />
              Promote to Task
            </Button>

            <Dialog
              open={showDeleteConfirm}
              onOpenChange={setShowDeleteConfirm}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete capture
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete capture</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &quot;{capture.title}&quot;?
                    This action cannot be undone.
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
          </div>
        </div>
      </div>

      {/* Promote dialog */}
      <PromoteDialog
        open={showPromote}
        onOpenChange={setShowPromote}
        capture={capture}
        onPromoted={() => {
          onRefresh();
          onClose();
        }}
      />
    </div>
  );
}
