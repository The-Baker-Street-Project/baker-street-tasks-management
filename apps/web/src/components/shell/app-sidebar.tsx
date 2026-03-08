"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Columns3,
  Search,
  Settings,
  Tag as TagIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ContextToggle } from "./context-toggle";
import { ThemeToggle } from "./theme-toggle";
import type { SavedView, Tag } from "@/types";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/kanban", label: "Kanban", icon: Columns3 },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AppSidebarProps {
  savedViews?: SavedView[];
  tags?: Tag[];
}

export function AppSidebar({ savedViews = [], tags = [] }: AppSidebarProps) {
  const pathname = usePathname();

  const customViews = savedViews.filter((v) => !v.isSystem && !v.isHidden);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">I</span>
          </div>
          <span className="flex-1 font-semibold group-data-[collapsible=icon]:hidden">
            Baker Street Tasks
          </span>
          <div className="group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <ContextToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {customViews.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Saved Views</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {customViews.map((view) => (
                    <SidebarMenuItem key={view.id}>
                      <SidebarMenuButton asChild>
                        <Link href={`/tasks?view=${view.id}`}>
                          <ListChecks />
                          <span>{view.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {tags.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Tags</SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="flex flex-wrap gap-1 px-2 group-data-[collapsible=icon]:hidden">
                  {tags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/tasks?tag=${tag.id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                    >
                      <TagIcon className="h-3 w-3" />
                      {tag.name}
                    </Link>
                  ))}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
