import { cn } from "@/lib/utils";
import { FlowWorkspace } from "@/components/layout/flow-workspace";

export function EnterpriseSection({
  title,
  description,
  children,
  actions,
  className,
  workspace,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Render inside elevated workspace container */
  workspace?: boolean;
}) {
  if (workspace) {
    return (
      <section className={cn("space-y-3", className)}>
        <FlowWorkspace title={title} description={description} actions={actions}>
          {children}
        </FlowWorkspace>
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-4 flow-section-header">
        <div>
          <h2 className="enterprise-section-title">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
