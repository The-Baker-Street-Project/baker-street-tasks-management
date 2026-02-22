"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  ListChecks,
  Inbox,
  Columns3,
  Search,
  Settings,
  Plus,
} from "lucide-react";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onClick={() => navigate("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onClick={() => navigate("/tasks")}>
            <ListChecks className="mr-2 h-4 w-4" />
            Tasks
          </CommandItem>
          <CommandItem onClick={() => navigate("/captures")}>
            <Inbox className="mr-2 h-4 w-4" />
            Captures
          </CommandItem>
          <CommandItem onClick={() => navigate("/kanban")}>
            <Columns3 className="mr-2 h-4 w-4" />
            Kanban
          </CommandItem>
          <CommandItem onClick={() => navigate("/search")}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </CommandItem>
          <CommandItem onClick={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("bst:create"));
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Task
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
