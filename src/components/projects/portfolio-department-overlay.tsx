"use client";

import { ProgramHealthBadge } from "@/components/projects/program-health-badge";
import type { DepartmentIntelligence } from "@/lib/projects/project-intelligence";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

export function PortfolioDepartmentOverlay({
  departments,
  onSelectDepartment,
  className,
}: {
  departments: DepartmentIntelligence[];
  onSelectDepartment?: (departmentId: string | null) => void;
  className?: string;
}) {
  if (departments.length <= 1) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">By department</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => {
          const needsAttention = dept.atRiskCount > 0 || dept.criticalCount > 0;
          const Wrapper = onSelectDepartment ? "button" : "div";

          return (
            <Wrapper
              key={dept.departmentId ?? "unassigned"}
              type={onSelectDepartment ? "button" : undefined}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                needsAttention
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border/50 bg-muted/10",
                onSelectDepartment && "hover:border-primary/40 hover:bg-primary/5"
              )}
              onClick={
                onSelectDepartment ? () => onSelectDepartment(dept.departmentId) : undefined
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{dept.departmentName}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {dept.projectCount} program{dept.projectCount === 1 ? "" : "s"} ·{" "}
                    {dept.avgCapacityLoadPct}% load
                  </p>
                </div>
                <ProgramHealthBadge
                  score={dept.avgHealthScore}
                  tier={dept.worstTier}
                  compact
                  className="shrink-0"
                />
              </div>
              {(dept.atRiskCount > 0 || dept.criticalCount > 0) && (
                <p className="text-[10px] text-amber-400 mt-1.5">
                  {dept.criticalCount > 0 && `${dept.criticalCount} critical`}
                  {dept.criticalCount > 0 && dept.atRiskCount > 0 && " · "}
                  {dept.atRiskCount > 0 && `${dept.atRiskCount} at risk`}
                </p>
              )}
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
