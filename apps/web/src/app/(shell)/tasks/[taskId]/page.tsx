import { getTask } from "@/lib/api/tasks";
import { notFound } from "next/navigation";
import { TaskDetailMobileClient } from "./task-detail-mobile-client";

interface TaskDetailPageProps {
  params: Promise<{ taskId: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { taskId } = await params;
  const task = await getTask(taskId);

  if (!task) {
    notFound();
  }

  return <TaskDetailMobileClient initialTask={task} />;
}
