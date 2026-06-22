"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acknowledgeHelpFlagAction,
  dismissHelpFlagAction,
  markHelpFlagInProgressAction,
  resolveHelpFlagAction,
} from "@/app/actions/help-flags";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { canAccessHref } from "@/lib/auth/permissions";
import { HELP_FLAG_REASON_LABELS } from "@/lib/help-flags/constants";
import { operationsHref } from "@/lib/navigation/deep-links";
import { cn } from "@/lib/utils";
import type { HelpFlagStatus, HelpFlagView, UserRole } from "@/types/flow";
import { Briefcase, ExternalLink, LifeBuoy, User } from "lucide-react";

const STATUS_STYLES: Record<
  HelpFlagStatus,
  { border: string; badge: string; label: string }
> = {
  open: {
    border: "border-warning/40",
    badge: "bg-warning/15 text-warning",
    label: "Open",
  },
  acknowledged: {
    border: "border-info/40",
    badge: "bg-info/15 text-info",
    label: "Acknowledged",
  },
  in_progress: {
    border: "border-info/40",
    badge: "bg-info/15 text-info",
    label: "In progress",
  },
  resolved: {
    border: "border-primary/30",
    badge: "bg-primary/15 text-primary",
    label: "Resolved",
  },
  dismissed: {
    border: "border-border/60",
    badge: "bg-muted text-muted-foreground",
    label: "Dismissed",
  },
};

function HelpFlagCard({
  flag,
  role,
  onAction,
}: {
  flag: HelpFlagView;
  role: UserRole;
  onAction: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showResolve, setShowResolve] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const [note, setNote] = useState("");
  const styles = STATUS_STYLES[flag.status];
  const isCritical = flag.severity === "critical" && flag.status === "open";
  const canOps = canAccessHref(role, "/operations");
  const canPeople = canAccessHref(role, `/people/${flag.employee_id}`);

  function run(action: () => Promise<void>) {
    setActionError(null);
    startTransition(() => {
      void action()
        .then(() => {
          setShowResolve(false);
          setShowDismiss(false);
          setNote("");
          onAction();
        })
        .catch((e) => {
          setActionError(e instanceof Error ? e.message : "Action failed. Please try again.");
        });
    });
  }

  return (
    <div
      className={cn(
        "flow-workspace rounded-lg border p-4 space-y-3",
        isCritical ? "border-destructive/40" : styles.border
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", styles.badge)}>
              {styles.label}
            </span>
            {isCritical && (
              <span className="text-xs font-medium text-destructive">Critical</span>
            )}
            {flag.escalated_at && (
              <span className="text-xs text-destructive">Escalated</span>
            )}
          </div>
          <h3 className="font-medium mt-1">{flag.employee_name}</h3>
          <p className="text-xs text-muted-foreground">
            {[flag.department_name, flag.team_name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <LifeBuoy className="h-5 w-5 text-warning shrink-0" />
      </div>

      <div className="text-sm space-y-1">
        <p>
          <span className="text-muted-foreground">Reason: </span>
          {HELP_FLAG_REASON_LABELS[flag.reason]}
        </p>
        {flag.task_title && (
          <p>
            <span className="text-muted-foreground">Task: </span>
            {flag.task_title}
          </p>
        )}
        {flag.project_name && (
          <p>
            <span className="text-muted-foreground">Project: </span>
            {flag.project_name}
          </p>
        )}
        {flag.notes && (
          <p className="text-muted-foreground text-xs mt-1">{flag.notes}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {new Date(flag.created_at).toLocaleString()} · via {flag.source.replace("_", " ")}
        </p>
      </div>

      {flag.can_respond && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {flag.status === "open" && (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => acknowledgeHelpFlagAction(flag.id, note || undefined))}
              >
                Acknowledge
              </Button>
            )}
            {["open", "acknowledged"].includes(flag.status) && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => markHelpFlagInProgressAction(flag.id, note || undefined))}
              >
                In progress
              </Button>
            )}
            {!["resolved", "dismissed"].includes(flag.status) && (
              <Button
                size="sm"
                variant="default"
                disabled={pending}
                onClick={() => setShowResolve((s) => !s)}
              >
                Resolve
              </Button>
            )}
            {!["resolved", "dismissed"].includes(flag.status) && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setShowDismiss((s) => !s)}
              >
                Dismiss
              </Button>
            )}
            {flag.can_assign && canOps && flag.task_id && (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={operationsHref({ package: flag.task_id! })} />}
              >
                <Briefcase className="h-3.5 w-3.5" />
                View task
              </Button>
            )}
            {canPeople && (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/people/${flag.employee_id}`} />}
              >
                <User className="h-3.5 w-3.5" />
                Employee
              </Button>
            )}
            {canOps && (
              <Button size="sm" variant="ghost" render={<Link href="/operations" />}>
                <ExternalLink className="h-3.5 w-3.5" />
                Operations
              </Button>
            )}
          </div>

          {(showResolve || showDismiss || flag.status === "open") && (
            <Textarea
              rows={2}
              placeholder={
                showDismiss
                  ? "Dismissal reason (optional)"
                  : showResolve
                    ? "Resolution notes for employee"
                    : "Add a note (optional)"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-sm"
            />
          )}

          {showResolve && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => resolveHelpFlagAction(flag.id, note || undefined))}
            >
              Confirm resolved
            </Button>
          )}
          {showDismiss && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => dismissHelpFlagAction(flag.id, note || undefined))}
            >
              Confirm dismiss
            </Button>
          )}
          {actionError && <p className="text-xs text-destructive">{actionError}</p>}
        </div>
      )}
    </div>
  );
}

export function HelpFlagsPanel({
  flags,
  role,
  compact = false,
}: {
  flags: HelpFlagView[];
  role: UserRole;
  compact?: boolean;
}) {
  const router = useRouter();

  if (flags.length === 0) {
    return (
      <div className="flow-alert-strip flow-alert-strip-healthy">
        <p className="text-sm text-muted-foreground">No open help requests.</p>
      </div>
    );
  }

  const content = (
    <div className={cn("grid gap-3", compact ? "grid-cols-1" : "md:grid-cols-2")}>
      {flags.map((flag) => (
        <HelpFlagCard
          key={flag.id}
          flag={flag}
          role={role}
          onAction={() => router.refresh()}
        />
      ))}
    </div>
  );

  if (compact) return content;

  return (
    <EnterpriseSection
      title="Help requests"
      description="Employees who flagged they need assistance — respond before work stalls."
    >
      <div className="flex items-center gap-2 mb-4 text-warning">
        <LifeBuoy className="h-4 w-4" />
        <span className="text-sm font-medium">{flags.length} open requests</span>
      </div>
      {content}
    </EnterpriseSection>
  );
}
