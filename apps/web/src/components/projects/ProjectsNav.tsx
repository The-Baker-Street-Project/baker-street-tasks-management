"use client";

import Link from "next/link";
import { Folder, FolderKanban } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { ProjectTreeNode } from "@/types";

interface ProjectsNavProps {
  tree: ProjectTreeNode[];
}

export function ProjectsNav({ tree }: ProjectsNavProps) {
  if (tree.length === 0) return null;

  return (
    <>
      <SidebarSeparator />
      <SidebarGroup>
        <SidebarGroupLabel>Projects</SidebarGroupLabel>
        <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
          <SidebarMenu>
            {tree.map((areaNode) => (
              <SidebarMenuItem key={areaNode.id ?? "__no_area__"}>
                <SidebarMenuButton
                  tabIndex={-1}
                  size="sm"
                  className="pointer-events-none cursor-default text-xs font-medium text-sidebar-foreground/70 hover:bg-transparent hover:text-sidebar-foreground/70"
                >
                  <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{areaNode.name}</span>
                  {areaNode.color && (
                    <span
                      className="ml-auto h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: areaNode.color }}
                    />
                  )}
                </SidebarMenuButton>
                {areaNode.projects.length > 0 && (
                  <SidebarMenuSub>
                    {areaNode.projects.map((project) => (
                      <SidebarMenuSubItem key={project.id}>
                        <SidebarMenuSubButton asChild>
                          <Link href={`/tasks?project=${project.id}`}>
                            <Folder className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{project.name}</span>
                            {project.color && (
                              <span
                                className="ml-auto h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: project.color }}
                              />
                            )}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
