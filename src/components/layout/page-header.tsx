import type { BreadcrumbSegment } from "@/components/layout/context-breadcrumb";
import { FlowHero } from "@/components/layout/flow-hero";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbSegment[];
  eyebrow?: string;
  children?: React.ReactNode;
  /** @deprecated Use default hero presentation */
  variant?: "hero" | "compact";
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  eyebrow,
  children,
  variant = "hero",
}: PageHeaderProps) {
  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-6 pb-4 flow-section-header">
        <div className="min-w-0">
          <h1 className="flow-page-title text-lg sm:text-xl">{title}</h1>
          {description && <p className="flow-helper mt-1 max-w-2xl">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">{children}</div>}
      </div>
    );
  }

  return (
    <FlowHero
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      eyebrow={eyebrow}
    >
      {children}
    </FlowHero>
  );
}
