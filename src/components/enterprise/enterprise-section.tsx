import { cn } from "@/lib/utils";
import { FlowWorkspace } from "@/components/layout/flow-workspace";

export function EnterpriseSection({
  title,
  description,
  children,
  actions,
  className,
  workspace,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  workspace?: boolean;
  id?: string;
}) {
  if (workspace) {
    return (
      <section id={id} className={cn("space-y-3", className)}>
        <FlowWorkspace title={title} description={description} actions={actions} className="flow-material-workspace">
          {children}
        </FlowWorkspace>
      </section>
    );
  }

  return (
    <section id={id} className={cn("space-y-3", className)}>
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
