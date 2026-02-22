import { ShellLayout } from "@/components/shell/shell-layout";
import { RealtimeRefresh } from "@/components/shell/realtime-refresh";
import { getSavedViews, getTags } from "@/lib/api/views";

export const dynamic = "force-dynamic";

export default async function ShellRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [savedViews, tags] = await Promise.all([
    getSavedViews(),
    getTags(),
  ]);

  return (
    <ShellLayout savedViews={savedViews} tags={tags}>
      <RealtimeRefresh />
      {children}
    </ShellLayout>
  );
}
