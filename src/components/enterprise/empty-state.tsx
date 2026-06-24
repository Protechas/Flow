import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-16 flow-empty-state-premium",
        className
      )}
    >
      {Icon && (
        <div className="flow-empty-icon mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--flow-radius-card)] text-muted-foreground">
          <Icon className="h-5 w-5 opacity-80" />
        </div>
      )}
      <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
