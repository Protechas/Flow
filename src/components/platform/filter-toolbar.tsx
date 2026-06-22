import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function FilterToolbar({
  children,
  className,
  label = "Filters",
}: {
  children: ReactNode;
  className?: string;
  /** Visually hidden label for screen readers */
  label?: string;
}) {
  if (!children) return null;

  return (
    <div className={cn("flow-glass-bar flow-platform-filter-toolbar", className)} aria-label={label}>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
