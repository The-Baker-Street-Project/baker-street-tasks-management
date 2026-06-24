import { ShellLayout } from "@/components/shell/shell-layout";
import { RealtimeRefresh } from "@/components/shell/realtime-refresh";
import { getSavedViews, getTags } from "@/lib/api/views";
import { getProjectsTree } from "@/lib/api/projects";

export const dynamic = "force-dynamic";

export default async function ShellRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [savedViews, tags, projectsTree] = await Promise.all([
    getSavedViews(),
    getTags(),
    getProjectsTree(),
  ]);

  return (
    <ShellLayout savedViews={savedViews} tags={tags} projectsTree={projectsTree}>
      <RealtimeRefresh />
      {children}
    </ShellLayout>
  );
}
