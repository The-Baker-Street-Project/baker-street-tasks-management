"use client";

import { useState, useTransition } from "react";
import { Tag as TagIcon, Plus, Pencil, Trash2, Copy, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTag, updateTag, deleteTag } from "@/lib/api/views";
import type { Tag } from "@/types";

interface SettingsPageClientProps {
  initialTags: Tag[];
}

export function SettingsPageClient({ initialTags }: SettingsPageClientProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const apiKeyPlaceholder = "bst_sk_xxxxxxxxxxxxxxxxxxxx";

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    startTransition(async () => {
      const tag = await createTag({ name, color: newTagColor });
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName("");
    });
  };

  const handleUpdateTag = () => {
    if (!editingTag) return;
    const name = editName.trim();
    if (!name) return;
    startTransition(async () => {
      const updated = await updateTag(editingTag.id, {
        name,
        color: editColor || null,
      });
      setTags((prev) =>
        prev
          .map((t) => (t.id === updated.id ? updated : t))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingTag(null);
    });
  };

  const handleDeleteTag = (tagId: string) => {
    startTransition(async () => {
      await deleteTag(tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    });
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKeyPlaceholder);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="border-b px-4 py-3">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your tags, API keys, and app preferences
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 p-4">
        {/* Tag Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TagIcon className="h-5 w-5" />
              Tags
            </CardTitle>
            <CardDescription>
              Create and manage tags to organize your tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create tag */}
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-9 w-9 cursor-pointer rounded border border-input"
              />
              <Button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isPending}
                size="sm"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>

            <Separator />

            {/* Tag list */}
            {tags.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No tags yet. Create one above.
              </p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {tag.color && (
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <span className="text-sm font-medium">{tag.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingTag(tag);
                          setEditName(tag.name);
                          setEditColor(tag.color ?? "#6366f1");
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteTag(tag.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* MCP API Key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              MCP API Key
            </CardTitle>
            <CardDescription>
              Use this key to connect AI agents via the MCP server
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={apiKeyPlaceholder}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyApiKey}
              >
                {copied ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Configure your MCP client to use this key for authenticated access.
            </p>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About Baker Street Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">0.1.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Framework</span>
              <span>Next.js 15</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Database</span>
              <span>PostgreSQL + Drizzle</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">AI Integration</span>
              <Badge variant="secondary" className="text-xs">
                MCP Server
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Tag Dialog */}
      <Dialog
        open={editingTag !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTag(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border border-input"
                />
                <Input
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder="#6366f1"
                  className="flex-1 font-mono"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTag(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateTag}
              disabled={!editName.trim() || isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
