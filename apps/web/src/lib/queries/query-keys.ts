export const queryKeys = {
  tasks: {
    all: ["tasks"] as const,
    lists: () => [...queryKeys.tasks.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.tasks.lists(), filters] as const,
    details: () => [...queryKeys.tasks.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
    overdue: () => [...queryKeys.tasks.all, "overdue"] as const,
    dueToday: () => [...queryKeys.tasks.all, "dueToday"] as const,
    highPriority: () => [...queryKeys.tasks.all, "highPriority"] as const,
    focus: () => [...queryKeys.tasks.all, "focus"] as const,
    search: (query: string) =>
      [...queryKeys.tasks.all, "search", query] as const,
  },
  captures: {
    all: ["captures"] as const,
    lists: () => [...queryKeys.captures.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.captures.lists(), filters] as const,
    details: () => [...queryKeys.captures.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.captures.details(), id] as const,
    pinned: () => [...queryKeys.captures.all, "pinned"] as const,
    search: (query: string) =>
      [...queryKeys.captures.all, "search", query] as const,
  },
  tags: {
    all: ["tags"] as const,
    list: () => [...queryKeys.tags.all, "list"] as const,
  },
  views: {
    all: ["views"] as const,
    list: (type?: string) => [...queryKeys.views.all, "list", type] as const,
  },
} as const;
