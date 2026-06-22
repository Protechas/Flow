"use client";

import Link from "next/link";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SystemHealthReport } from "@/lib/system-health/integrity";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

const SEVERITY_STYLES = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-warning/40 bg-warning/5",
  info: "border-border/60 bg-muted/10",
} as const;

export function SystemHealthView({ report }: { report: SystemHealthReport }) {
  const healthy = report.issueCount === 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Admin only</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Integrity checks across users, teams, tasks, forecasts, alerts, and daily reports.
            Resolve issues here to keep workflows and KPIs trustworthy.
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Generated {format(parseISO(report.generatedAt), "MMM d, yyyy h:mm a")}
          </p>
        </div>
        {healthy ? (
          <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All checks passed
          </Badge>
        ) : (
          <div className="flex flex-wrap gap-2">
            {report.criticalCount > 0 && (
              <Badge variant="destructive">{report.criticalCount} critical</Badge>
            )}
            {report.warningCount > 0 && (
              <Badge variant="outline" className="border-warning/50 text-warning">
                {report.warningCount} warning
              </Badge>
            )}
          </div>
        )}
      </div>

      {healthy ? (
        <div className="enterprise-panel-elevated p-8 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
          <p className="font-semibold">No integrity issues detected</p>
          <p className="text-sm text-muted-foreground">
            Data relationships, assignments, and alert links appear consistent.
          </p>
        </div>
      ) : (
        <EnterpriseSection title="Issues" description="Ordered by severity. Follow links to resolve.">
          <ul className="space-y-3">
            {report.issues.map((issue) => (
              <li
                key={issue.id}
                className={cn(
                  "rounded-lg border px-4 py-3 space-y-2",
                  SEVERITY_STYLES[issue.severity]
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {issue.severity === "critical" ? (
                      <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{issue.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{issue.detail}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="tabular-nums shrink-0">
                    {issue.count}
                  </Badge>
                </div>
                {issue.href && (
                  <Button size="sm" variant="outline" render={<Link href={issue.href} />}>
                    Review
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </EnterpriseSection>
      )}
    </div>
  );
}
