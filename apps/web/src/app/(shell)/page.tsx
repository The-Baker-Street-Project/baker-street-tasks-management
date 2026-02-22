import { DashboardClient } from "./dashboard-client";
import {
  getOverdueTasks,
  getDueTodayTasks,
  getTasks,
  getHighPriorityTasks,
  getFocusTasks,
} from "@/lib/api/tasks";
import { getPinnedCaptures } from "@/lib/api/captures";

export default async function DashboardPage() {
  const [overdue, dueToday, nextUp, highPriority, inbox, focus, pinnedCaptures] =
    await Promise.all([
      getOverdueTasks(),
      getDueTodayTasks(),
      getTasks({ status: ["Active"], sort: "order" }).then((t) => t.slice(0, 5)),
      getHighPriorityTasks(),
      getTasks({ status: ["Inbox"] }).then((t) => t.slice(0, 5)),
      getFocusTasks(),
      getPinnedCaptures(),
    ]);

  return (
    <div className="h-full overflow-auto">
      <div className="border-b px-4 py-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your task overview at a glance
        </p>
      </div>

      <DashboardClient
        overdue={overdue}
        dueToday={dueToday}
        nextUp={nextUp}
        highPriority={highPriority}
        inbox={inbox}
        focus={focus}
        pinnedCaptures={pinnedCaptures}
      />
    </div>
  );
}
