import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { HelpTextKey } from "@/lib/help/help-text";

export function KpiPriorityZone({
  title,
  description,
  variant = "overview",
  children,
  className,
  helpKey,
}: {
  title?: string;
  description?: string;
  variant?: "attention" | "overview";
  children: ReactNode;
  className?: string;
  helpKey?: HelpTextKey;
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
          {title && (
            <h3 className="flow-kpi-zone-title flex items-center gap-1.5">
              {title}
              {helpKey && <InfoTooltip helpKey={helpKey} />}
            </h3>
          )}
          {description && <p className="flow-kpi-zone-description">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
