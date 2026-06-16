import { Skeleton } from "@/components/ui/skeleton";

export function CommandCenterSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <Skeleton className="h-[140px] rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-md" />
        ))}
      </div>
      <Skeleton className="h-14 rounded-md" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
      <Skeleton className="h-[280px] rounded-xl" />
      <Skeleton className="h-[320px] rounded-xl" />
    </div>
  );
}
