import { FlowWorkspace } from "@/components/layout/flow-workspace";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function WorkspaceContainer({
  children,
  title,
  description,
  actions,
  toolbar,
  className,
  bodyClassName,
  elevated = true,
  tier = 1,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Apply platform workspace elevation (default true) */
  elevated?: boolean;
  /** Visual depth tier: 1 = primary workspace, 2 = nested, 3 = tertiary */
  tier?: 1 | 2 | 3;
}) {
  const tierClass =
    tier === 1 ? "flow-workspace-tier-1" : tier === 2 ? "flow-workspace-tier-2" : "flow-workspace-tier-3";

  if (title || description || actions || toolbar) {
    return (
      <FlowWorkspace
        title={title}
        description={description}
        actions={actions}
        toolbar={toolbar}
        className={cn(elevated && "flow-platform-workspace flow-material-workspace", elevated && tierClass, className)}
        bodyClassName={bodyClassName}
      >
        {children}
      </FlowWorkspace>
    );
  }

  return (
    <div className={cn(elevated && "flow-platform-workspace flow-material-workspace", elevated && tierClass, className)}>
      <div className={cn("flow-platform-workspace-body", bodyClassName)}>{children}</div>
    </div>
  );
}
