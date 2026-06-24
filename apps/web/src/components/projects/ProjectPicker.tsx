"use client";

import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project, ProjectTreeNode } from "@/types";

interface ProjectPickerProps {
  projects: Project[];
  projectTree: ProjectTreeNode[];
  onChange: (projectIds: string[]) => void;
}

export function ProjectPicker({ projects, projectTree, onChange }: ProjectPickerProps) {
  const assignedIds = new Set(projects.map((p) => p.id));

  // Filter tree nodes to only those with at least one available project
  const availableNodes = projectTree
    .map((node) => ({
      ...node,
      projects: node.projects.filter((p) => !assignedIds.has(p.id)),
    }))
    .filter((node) => node.projects.length > 0);

  const hasAvailable = availableNodes.length > 0;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Projects</h4>
      {projects.length === 0 && !hasAvailable && (
        <p className="text-xs text-muted-foreground">No projects</p>
      )}
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {projects.map((project) => (
            <Badge key={project.id} variant="secondary" className="gap-1 pl-2 pr-1">
              {project.color && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
              )}
              {project.name}
              <button
                type="button"
                onClick={() =>
                  onChange(projects.filter((p) => p.id !== project.id).map((p) => p.id))
                }
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {hasAvailable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Add project
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {availableNodes.map((node, index) => (
              <div key={node.id ?? "__no_area__"}>
                {index > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {node.name}
                </DropdownMenuLabel>
                {node.projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() =>
                      onChange([...projects.map((p) => p.id), project.id])
                    }
                    className="cursor-pointer gap-2"
                  >
                    {project.color && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                    )}
                    {project.name}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
