"use client";

import { useQueryState } from "nuqs";
import { Home, Briefcase, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ContextOption = "All" | "Home" | "Work";

const OPTIONS: { value: ContextOption; label: string; icon: React.ElementType }[] = [
  { value: "All", label: "All", icon: Globe },
  { value: "Home", label: "Home", icon: Home },
  { value: "Work", label: "Work", icon: Briefcase },
];

export function ContextToggle() {
  const [context, setContext] = useQueryState("context", {
    defaultValue: "All",
  });

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="sm"
          className={cn(
            "flex-1 gap-1.5 text-xs",
            context === option.value &&
              "bg-background text-foreground shadow-sm hover:bg-background"
          )}
          onClick={() => setContext(option.value === "All" ? null : option.value)}
        >
          <option.icon className="h-3.5 w-3.5" />
          {option.label}
        </Button>
      ))}
    </div>
  );
}
