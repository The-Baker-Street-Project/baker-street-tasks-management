"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useQueryState } from "nuqs";
import { Search, ListChecks, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TaskRow } from "@/components/shared/TaskRow";
import { toast } from "sonner";
import { searchTasks } from "@/lib/api/tasks";
import type { Task } from "@/types";

export function SearchPageClient() {
  const [query, setQuery] = useQueryState("q", { defaultValue: "" });
  const [inputValue, setInputValue] = useState(query);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setTasks([]);
        setHasSearched(false);
        return;
      }

      startTransition(async () => {
        try {
          const taskResults = await searchTasks(searchQuery);
          setTasks(taskResults);
          setHasSearched(true);
        } catch {
          toast.error("Search failed");
        }
      });
    },
    []
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputValue || null);
      performSearch(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, setQuery, performSearch]);

  // Search on mount if there's a query param
  useEffect(() => {
    if (query) {
      setInputValue(query);
      performSearch(query);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full overflow-auto">
      <div className="border-b px-4 py-3">
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">
          Search across your tasks
        </p>
      </div>

      <div className="p-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search tasks..."
            className="pl-10"
            autoFocus
          />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {!hasSearched && !isPending && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <Search className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="mt-4 text-sm font-medium">Search your tasks</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Find tasks by title, notes, or tags
            </p>
          </div>
        )}

        {hasSearched && tasks.length === 0 && !isPending && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <Search className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="mt-4 text-sm font-medium">No matches found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try different keywords for &ldquo;{query}&rdquo;
            </p>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 px-1">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">
                Tasks ({tasks.length})
              </h2>
            </div>
            <div className="divide-y rounded-lg border">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  href={`/tasks?taskId=${task.id}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
