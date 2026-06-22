import type { BreadcrumbSegment } from "@/components/layout/context-breadcrumb";
import { ContextBreadcrumb } from "@/components/layout/context-breadcrumb";
import { cn } from "@/lib/utils";

export function FlowHero({
  title,
  description,
  breadcrumbs,
  eyebrow = "Executive Operations",
  children,
  className,
}: {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbSegment[];
  eyebrow?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flow-hero-panel mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <ContextBreadcrumb segments={breadcrumbs} className="mb-4" />
      )}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3.5">
            <div className="flow-brand-mark shrink-0" aria-hidden>
              F
            </div>
            <div className="min-w-0">
              <p className="flow-hero-eyebrow">{eyebrow}</p>
              <h1 className="flow-hero-title">{title}</h1>
            </div>
          </div>
          {description && (
            <p className="flow-hero-description mt-4 max-w-3xl">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 lg:justify-end">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
