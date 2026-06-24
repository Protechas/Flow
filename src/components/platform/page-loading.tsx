import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageLoadingSkeleton({
  variant = "default",
  className,
}: {
  variant?: "default" | "dashboard" | "table" | "workspace";
  className?: string;
}) {
  if (variant === "dashboard") {
    return (
      <div className={cn("flow-page-skeleton space-y-8 p-1", className)}>
        <div className="flow-material-card p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[5.5rem] rounded-[var(--flow-radius-card)]" />
            ))}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-[var(--flow-radius-panel)]" />
          <Skeleton className="h-64 rounded-[var(--flow-radius-panel)]" />
        </div>
        <Skeleton className="h-48 rounded-[var(--flow-radius-panel)]" />
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("flow-page-skeleton flow-workspace", className)}>
        <div className="flow-workspace-header">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="flow-workspace-toolbar flex gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-48 flex-1 max-w-xs" />
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "workspace") {
    return (
      <div className={cn("flow-page-skeleton space-y-6 p-1", className)}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-48" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[5rem] rounded-[var(--flow-radius-card)]" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-[var(--flow-radius-panel)]" />
      </div>
    );
  }

  return (
    <div className={cn("flow-page-skeleton space-y-6 p-1", className)}>
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-64 rounded-[var(--flow-radius-panel)]" />
    </div>
  );
}
