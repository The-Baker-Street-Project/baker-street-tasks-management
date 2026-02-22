"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { BottomNav } from "./bottom-nav";
import { CommandMenu } from "@/components/shared/CommandMenu";
import { CreateFab } from "@/components/shared/CreateFab";
import { ThemeToggle } from "./theme-toggle";
import type { SavedView, Tag } from "@/types";

interface ShellLayoutProps {
  children: React.ReactNode;
  savedViews: SavedView[];
  tags: Tag[];
}

export function ShellLayout({ children, savedViews, tags }: ShellLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar savedViews={savedViews} tags={tags} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="flex-1 font-semibold">Baker Street Tasks</span>
          <ThemeToggle />
        </header>
        <div className="flex-1 overflow-hidden pb-16 md:pb-0">
          {children}
        </div>
      </SidebarInset>
      <BottomNav />
      <CreateFab />
      <CommandMenu />
    </SidebarProvider>
  );
}
