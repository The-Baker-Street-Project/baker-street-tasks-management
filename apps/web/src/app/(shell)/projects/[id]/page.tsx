import { notFound } from "next/navigation";
import { getProjectDetail, getProjectsTree } from "@/lib/api/projects";
import { getTasks } from "@/lib/api/tasks";
import { getTags } from "@/lib/api/views";
import { ProjectDetailClient } from "./project-detail-client";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params;

  const [detail, tasks, projectTree, tags] = await Promise.all([
    getProjectDetail(id),
    getTasks({ projectId: id }),
    getProjectsTree(),
    getTags(),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <ProjectDetailClient
      project={detail.project}
      progress={detail.progress}
      initialTasks={tasks}
      projectTree={projectTree}
      allTags={tags}
    />
  );
}
