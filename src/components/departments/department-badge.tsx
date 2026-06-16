import { cn } from "@/lib/utils";

export function DepartmentBadge({
  departmentId,
  name,
  className,
}: {
  departmentId: string | null | undefined;
  name?: string;
  className?: string;
}) {
  if (!departmentId) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary",
        className
      )}
    >
      {name ?? departmentId}
    </span>
  );
}
