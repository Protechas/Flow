import { cn } from "@/lib/utils";

export function FlowWorkspace({
  title,
  description,
  actions,
  toolbar,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const hasHeader = title || description || actions;

  return (
    <div className={cn("flow-workspace", className)}>
      {hasHeader && (
        <div className="flow-workspace-header">
          <div className="min-w-0">
            {title && <h2 className="flow-workspace-title">{title}</h2>}
            {description && (
              <p className="flow-workspace-description">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {toolbar && <div className="flow-workspace-toolbar">{toolbar}</div>}
      <div className={cn("flow-workspace-body", bodyClassName)}>{children}</div>
    </div>
  );
}
