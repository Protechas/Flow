import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function KpiPriorityZone({
  title,
  description,
  variant = "overview",
  children,
  className,
}: {
  title?: string;
  description?: string;
  variant?: "attention" | "overview";
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flow-kpi-zone",
        variant === "attention" && "flow-kpi-zone-attention",
        variant === "overview" && "flow-kpi-zone-overview",
        className
      )}
    >
      {(title || description) && (
        <div className="flow-kpi-zone-header mb-3">
          {title && <h3 className="flow-kpi-zone-title">{title}</h3>}
          {description && <p className="flow-kpi-zone-description">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
