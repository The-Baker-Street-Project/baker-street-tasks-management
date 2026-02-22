"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateFab() {
  return (
    <Button
      size="icon"
      className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg md:hidden"
      onClick={() => {
        // Dispatch a custom event that pages can listen to
        window.dispatchEvent(new CustomEvent("bst:create"));
      }}
    >
      <Plus className="h-6 w-6" />
      <span className="sr-only">Create new</span>
    </Button>
  );
}
