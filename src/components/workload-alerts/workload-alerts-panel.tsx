"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  dismissWorkloadAlertAction,
  reviewWorkloadAlertAction,
  snoozeWorkloadAlertAction,
} from "@/app/actions/workload-alerts";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { Button } from "@/components/ui/button";
import { canAccessHref } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import type { UserRole, WorkloadAlertSeverity, WorkloadAlertView } from "@/types/flow";
import {
  AlertTriangle,
  Briefcase,
  Clock,
  ExternalLink,
  User,
} from "lucide-react";

const SEVERITY_STYLES: Record<
  WorkloadAlertSeverity,
  { border: string; badge: string; label: string }
> = {
  critical: {
    border: "border-destructive/40",
    badge: "bg-destructive/15 text-destructive",
    label: "Critical",
  },
  warning: {
    border: "border-warning/40",
    badge: "bg-warning/15 text-warning",
    label: "Warning",
  },
  info: {
    border: "border-info/40",
    badge: "bg-info/15 text-info",
    label: "Info",
  },
  needs_review: {
    border: "border-purple-500/30",
    badge: "bg-purple-500/15 text-purple-300",
    label: "Needs review",
  },
};

const TYPE_LABELS: Record<string, string> = {
  running_out_of_work: "Running out of work",
  no_assigned_work: "No assigned work",
  needs_more_work_soon: "Needs more work soon",
  task_almost_complete: "Task almost complete",
  needs_estimate: "Needs estimate",
};

function WorkloadAlertCard({
  alert,
  role,
  onAction,
}: {
  alert: WorkloadAlertView;
  role: UserRole;
  onAction: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const styles = SEVERITY_STYLES[alert.severity];
  const canOps = canAccessHref(role, "/operations");
  const canPeople = canAccessHref(role, `/people/${alert.employee_id}`);

  function run(action: () => Promise<void>) {
    setActionError(null);
    startTransition(() => {
      void action()
        .then(onAction)
        .catch((e) => {
          setActionError(e instanceof Error ? e.message : "Action failed");
        });
    });
  }

  return (
    <div
      className={cn(
        "flow-workspace rounded-lg border p-4 space-y-3",
        styles.border
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", styles.badge)}>
              {styles.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
            </span>
          </div>
          <h3 className="font-medium mt-1">{alert.employee_name}</h3>
          <p className="text-xs text-muted-foreground">
            {[alert.department_name, alert.team_name].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Raised {new Date(alert.created_at).toLocaleString()}
          </p>
        </div>
        {alert.remaining_hours != null && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-lg font-semibold tabular-nums">{alert.remaining_hours}h</p>
          </div>
        )}
      </div>

      <div className="grid gap-1 text-sm">
        <p>
          <span className="text-muted-foreground">Active task: </span>
          {alert.current_task_title ?? "None"}
        </p>
        <p>
          <span className="text-muted-foreground">Upcoming: </span>
          {alert.upcoming_task_count > 0
            ? `${alert.upcoming_task_count} assigned`
            : "None"}
        </p>
        {alert.is_clocked_in && (
          <p className="text-warning text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Clocked in{alert.has_active_timer ? " · timer running" : " · no active task"}
          </p>
        )}
        <p className="text-muted-foreground text-xs mt-1">{alert.recommended_action}</p>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {alert.can_assign && canOps ? (
          <Button
            size="sm"
            variant="default"
            render={
              <Link
                href={`/operations?search=${encodeURIComponent(alert.employee_name)}`}
              />
            }
          >
            <Briefcase className="h-3.5 w-3.5" />
            Assign task
          </Button>
        ) : null}
        {canPeople ? (
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/people/${alert.employee_id}`} />}
          >
            <User className="h-3.5 w-3.5" />
            View workload
          </Button>
        ) : null}
        {canOps ? (
          <Button size="sm" variant="outline" render={<Link href="/operations" />}>
            <ExternalLink className="h-3.5 w-3.5" />
            Available tasks
          </Button>
        ) : null}
        {alert.current_task_id && canOps ? (
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/operations?package=${alert.current_task_id}`} />}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View active task
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => snoozeWorkloadAlertAction(alert.id))}
        >
          Snooze
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => reviewWorkloadAlertAction(alert.id))}
        >
          Mark reviewed
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => dismissWorkloadAlertAction(alert.id))}
        >
          Dismiss
        </Button>
      </div>
      {actionError && <p className="text-xs text-destructive">{actionError}</p>}
    </div>
  );
}

export function WorkloadAlertsPanel({
  alerts,
  role,
  compact = false,
}: {
  alerts: WorkloadAlertView[];
  role: UserRole;
  compact?: boolean;
}) {
  const router = useRouter();

  if (alerts.length === 0) {
    return (
      <div className="flow-alert-strip flow-alert-strip-healthy">
        <p className="text-sm text-muted-foreground">
          No workload alerts — team capacity looks healthy.
        </p>
      </div>
    );
  }

  const severityRank: Record<WorkloadAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    needs_review: 2,
    info: 3,
  };
  const ordered = [...alerts].sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      b.created_at.localeCompare(a.created_at)
  );

  const content = (
    <div className={cn("grid gap-3", compact ? "grid-cols-1" : "md:grid-cols-2")}>
      {ordered.map((alert) => (
        <WorkloadAlertCard
          key={alert.id}
          alert={alert}
          role={role}
          onAction={() => router.refresh()}
        />
      ))}
    </div>
  );

  if (compact) return content;

  return (
    <EnterpriseSection
      title="Employee workload alerts"
      description="Team leads and managers are notified before employees run out of assigned work."
    >
      <div className="flex items-center gap-2 mb-4 text-warning">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">{alerts.length} open alerts</span>
      </div>
      {content}
    </EnterpriseSection>
  );
}
