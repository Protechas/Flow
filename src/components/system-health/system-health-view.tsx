"use client";

import Link from "next/link";
import { SystemHealthRepairButton } from "@/components/system-health/system-health-repair-button";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProductionConfigReport } from "@/lib/system-health/production-config";
import type { RuntimeHealthReport } from "@/lib/system-health/runtime-checks";
import type { PermissionDiagnosticsReport } from "@/lib/system-health/permission-diagnostics";
import type { SystemHealthReport } from "@/lib/system-health/integrity";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

const SEVERITY_STYLES = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-warning/40 bg-warning/5",
  info: "border-border/60 bg-muted/10",
} as const;

const CONFIG_STATUS_STYLES = {
  ok: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-warning/40 bg-warning/5",
  critical: "border-destructive/40 bg-destructive/5",
} as const;

export function SystemHealthView({
  report,
  configReport,
  runtimeReport,
  permissionReport,
}: {
  report: SystemHealthReport;
  configReport: ProductionConfigReport;
  runtimeReport: RuntimeHealthReport;
  permissionReport?: PermissionDiagnosticsReport;
}) {
  const healthy = report.issueCount === 0;
  const configHealthy = configReport.criticalCount === 0;
  const runtimeHealthy = runtimeReport.criticalCount === 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Admin only</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Environment configuration and integrity checks across users, teams, tasks, forecasts,
            alerts, and daily reports.
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

      <EnterpriseSection
        title="Production configuration"
        description="Runtime env checks for auth, persistence, and email links."
      >
        <ul className="space-y-2">
          {configReport.checks.map((check) => (
            <li
              key={check.id}
              className={cn(
                "rounded-lg border px-4 py-3 flex flex-wrap items-start justify-between gap-2",
                CONFIG_STATUS_STYLES[check.status]
              )}
            >
              <div>
                <p className="font-medium text-sm">{check.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
              </div>
              <Badge
                variant={check.status === "critical" ? "destructive" : "outline"}
                className="shrink-0 capitalize"
              >
                {check.status}
              </Badge>
            </li>
          ))}
        </ul>
        {!configHealthy && (
          <p className="text-xs text-muted-foreground mt-3">
            Fix critical items before inviting users or testing clock-in / password reset in
            production.
          </p>
        )}
      </EnterpriseSection>

      {runtimeReport.checks.length > 0 && (
        <EnterpriseSection
          title="Live runtime checks"
          description="Supabase connectivity, schema spot-checks, and auth profile alignment."
        >
          <ul className="space-y-2">
            {runtimeReport.checks.map((check) => (
              <li
                key={check.id}
                className={cn(
                  "rounded-lg border px-4 py-3 flex flex-wrap items-start justify-between gap-2",
                  check.status === "ok"
                    ? CONFIG_STATUS_STYLES.ok
                    : check.status === "skipped"
                      ? "border-border/60 bg-muted/10"
                      : CONFIG_STATUS_STYLES[check.status === "critical" ? "critical" : "warning"]
                )}
              >
                <div>
                  <p className="font-medium text-sm">{check.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {check.status}
                </Badge>
              </li>
            ))}
          </ul>
          {!runtimeHealthy && runtimeReport.supabaseConfigured && (
            <p className="text-xs text-muted-foreground mt-3">
              Critical runtime issues block reliable login, invites, and time clock persistence.
            </p>
          )}
        </EnterpriseSection>
      )}

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
                {issue.repairKey && (
                  <SystemHealthRepairButton repairKey={issue.repairKey} count={issue.count} />
                )}
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

      {permissionReport && (
        <EnterpriseSection
          title="Permission diagnostics"
          description="Enterprise permission layer integrity, migration status, and profile conflicts."
        >
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">{permissionReport.migrationStatus.phase}</Badge>
            <Badge variant="secondary">
              {permissionReport.customizedProfileCount} customized profiles
            </Badge>
            <Badge variant="outline">
              {permissionReport.usersWithoutProfile} users on role defaults
            </Badge>
            {permissionReport.criticalCount > 0 && (
              <Badge variant="destructive">{permissionReport.criticalCount} critical</Badge>
            )}
          </div>
          <ul className="space-y-2">
            {permissionReport.issues.map((issue) => (
              <li
                key={issue.id}
                className={cn(
                  "rounded-lg border p-3 flex flex-wrap items-start justify-between gap-3",
                  SEVERITY_STYLES[issue.severity]
                )}
              >
                <div>
                  <p className="text-sm font-medium">{issue.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{issue.detail}</p>
                </div>
                <Badge variant="outline" className="tabular-nums shrink-0">
                  {issue.count}
                </Badge>
              </li>
            ))}
          </ul>
        </EnterpriseSection>
      )}
    </div>
  );
}
