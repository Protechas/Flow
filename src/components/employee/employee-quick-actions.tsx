"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HelpFlagDialog } from "@/components/help-flags/help-flag-dialog";
import { useEmployeeWorkflow } from "@/components/employee/employee-workflow-context";
import { WorkEligibilityGateDialog } from "@/components/employee/work-eligibility-gate-dialog";
import { cn } from "@/lib/utils";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import type { DailyWrapUp } from "@/types/flow";
import { BookOpen, FileUp, Moon } from "lucide-react";

function QuickActionCard({
  label,
  icon: Icon,
  onClick,
  href,
  disabled,
  subdued,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  subdued?: boolean;
}) {
  const className = cn(
    "flex flex-col items-center justify-center gap-2 rounded-lg border border-border/60 bg-card/50 p-4 min-h-[5.5rem] text-center transition-colors",
    subdued && "opacity-90",
    !disabled && "hover:bg-muted/40 hover:border-border",
    disabled && "opacity-45 pointer-events-none"
  );

  const inner = (
    <>
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {inner}
    </button>
  );
}

export function EmployeeQuickActions({
  todayWrapUp: _todayWrapUp,
  visibility: _visibility,
  onOpenWrapUp,
}: {
  todayWrapUp: DailyWrapUp | null;
  visibility?: {
    clockedMinutes: number;
    recordedTaskMinutes: number;
    unassignedMinutes: number;
    taskTrackingCompliancePct: number | null;
  };
  onOpenWrapUp: () => void;
}) {
  const wf = useEmployeeWorkflow();
  const router = useRouter();
  const [gateOpen, setGateOpen] = useState(false);

  const uploadTaskId = wf.uploadTaskId;
  const canUpload = wf.actions.uploadFiles && Boolean(uploadTaskId);

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {wf.actions.requestHelp && (
            <div className="min-w-0 [&_.flow-employee-action-tile]:min-h-[5.5rem] [&_.flow-employee-action-tile]:rounded-lg [&_.flow-employee-action-tile]:border-border/60 [&_.flow-employee-action-tile]:bg-card/50">
              <HelpFlagDialog
                taskId={uploadTaskId ?? undefined}
                source="dashboard"
                triggerLabel={OPS_COPY.requestAssistance}
                tile
                onSubmitted={() => router.refresh()}
              />
            </div>
          )}

          <QuickActionCard
            label="Upload Files"
            icon={FileUp}
            href={canUpload ? `/work/${uploadTaskId}?autostart=1` : undefined}
            disabled={!canUpload}
            subdued
            onClick={uploadTaskId && !wf.workEligible ? () => setGateOpen(true) : undefined}
          />

          <QuickActionCard label="View SOPs" icon={BookOpen} href="/work/files" subdued />

          {wf.actions.submitWrapUp && (
            <QuickActionCard label="Submit Daily Report" icon={Moon} subdued onClick={onOpenWrapUp} />
          )}
        </div>
      </section>

      <WorkEligibilityGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        message="You must be clocked in before uploading task files."
        onClockedIn={() => router.refresh()}
      />
    </>
  );
}
