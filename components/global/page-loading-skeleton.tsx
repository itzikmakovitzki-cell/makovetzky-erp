/**
 * Generic dense-table skeleton shown by loading.tsx while a route segment's
 * server data is being fetched. Kept content-agnostic (header bar + rows)
 * since it has to fit every dashboard page, not just list views.
 */
export function PageLoadingSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      <div className="flex items-end justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-1 w-12 rounded-full bg-muted" />
        </div>
        <div className="h-8 w-24 rounded bg-muted" />
      </div>
      <div className="rounded-md border bg-card">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border/40 px-3 py-2.5 last:border-b-0"
          >
            <div className="h-3.5 w-1/4 rounded bg-muted" />
            <div className="h-3.5 w-1/6 rounded bg-muted" />
            <div className="h-3.5 w-1/5 rounded bg-muted" />
            <div className="ms-auto h-3.5 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
