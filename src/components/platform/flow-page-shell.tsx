import { PageHeader } from "@/components/layout/page-header";
import type { BreadcrumbSegment } from "@/components/layout/context-breadcrumb";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type FlowPageShellProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbSegment[];
  headerActions?: ReactNode;
  pulse?: ReactNode;
  kpis?: ReactNode;
  alerts?: ReactNode;
  filters?: ReactNode;
  workspace: ReactNode;
  detail?: ReactNode;
  className?: string;
};

/**
 * Standard Flow page layout:
 * 1. Page Header
 * 2. KPI Summary
 * 3. Global Alert Bar
 * 4. Search & Filters
 * 5. Primary Workspace
 * 6. Detail Drawer (optional, sibling)
 */
export function FlowPageShell({
  title,
  description,
  eyebrow,
  breadcrumbs,
  headerActions,
  pulse,
  kpis,
  alerts,
  filters,
  workspace,
  detail,
  className,
}: FlowPageShellProps) {
  return (
    <div className={cn("flow-platform-page space-y-6", className)}>
      <PageHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
      >
        {headerActions}
      </PageHeader>

      {pulse && <section className="flow-platform-section flow-layer-2-workspace p-0.5">{pulse}</section>}

      {kpis && <section className="flow-platform-section">{kpis}</section>}

      {alerts && <section className="flow-platform-section">{alerts}</section>}

      {filters && <section className="flow-platform-section">{filters}</section>}

      <section className="flow-platform-section flow-platform-workspace-zone flow-layer-2-workspace p-0.5">{workspace}</section>

      {detail}
    </div>
  );
}
