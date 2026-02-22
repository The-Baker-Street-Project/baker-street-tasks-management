export default function KanbanLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-80 shrink-0 rounded-lg border bg-card p-3">
            <div className="mb-3 h-5 w-16 animate-pulse rounded bg-muted" />
            <div className="space-y-3">
              {Array.from({ length: 4 - i }).map((_, j) => (
                <div key={j} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
