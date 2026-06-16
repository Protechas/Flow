"use client";

import Link from "next/link";
import { ActivityFeed } from "@/components/enterprise/activity-feed";
import { EmployeeClockWidget } from "@/components/employee/employee-clock-widget";
import { EmployeePrimaryActions } from "@/components/employee/employee-primary-actions";
import { EmployeeQaReturns } from "@/components/employee/employee-qa-returns";
import { LiveForecastStatusBadge } from "@/components/forecast/live-forecast-status-badge";
import { HelpFlagStatusList } from "@/components/help-flags/help-flag-status";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { primaryDueDate } from "@/lib/forecast/live";
import { formatMinutes } from "@/lib/production/metrics";
import { clockStatusLabel, getEmployeeClockStatus } from "@/lib/time-clock/labels";
import { requiresShiftClock } from "@/lib/users/pay-type";
import type { WorkEligibility } from "@/lib/work-eligibility";
import { cn } from "@/lib/utils";
import type { EmployeeDashboard } from "@/lib/employee/dashboard";
import type {
  HelpFlagView,
  PayType,
  TimeClockEntry,
  WrapUpComplianceStatus,
} from "@/types/flow";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  LifeBuoy,
  Moon,
  Play,
  Target,
} from "lucide-react";

const WRAP_UP_LABELS: Record<WrapUpComplianceStatus, string> = {
  submitted: "Submitted today",
  missing: "Not submitted yet",
  overridden: "Exempt today",
};

function nextStepMessage({
  currentTask,
  nextTask,
  qaReturns,
  openHelp,
  wrapUpStatus,
  onShift,
  useShiftClock,
  workEligible,
}: {
  currentTask: EmployeeDashboard["currentTask"];
  nextTask: EmployeeDashboard["nextTask"];
  qaReturns: EmployeeDashboard["qaReturns"];
  openHelp: number;
  wrapUpStatus: WrapUpComplianceStatus;
  onShift: boolean;
  useShiftClock: boolean;
  workEligible: boolean;
}): string {
  if (useShiftClock && !workEligible) {
    return "Clock in to start work on your assigned tasks.";
  }
  if (qaReturns.length > 0) {
    return "QA returned work — fix corrections first.";
  }
  if (openHelp > 0) {
    return "Your help request is open — a lead will respond soon.";
  }
  if (currentTask) {
    return "Continue your active task or upload completed files.";
  }
  if (nextTask) {
    return "Start your next task when you're ready.";
  }
  if (useShiftClock && onShift && wrapUpStatus === "missing") {
    return "End your day with a wrap-up before clocking out.";
  }
  return "No assigned work right now — check back soon.";
}

export function EmployeeWorkspaceView({
  dashboard,
  userName,
  payType,
  activeClock,
  todayClockEntries,
  taskMinutesToday,
  wrapUpStatus,
  helpFlags = [],
  workEligibility,
}: {
  dashboard: EmployeeDashboard;
  userName: string;
  payType: PayType;
  activeClock: TimeClockEntry | null;
  todayClockEntries: TimeClockEntry[];
  taskMinutesToday: number;
  wrapUpStatus: WrapUpComplianceStatus;
  helpFlags?: HelpFlagView[];
  workEligibility: WorkEligibility;
}) {
  const {
    currentTask,
    nextTask,
    activeTaskTimer,
    dailySummary,
    qaReturns,
    todayWrapUp,
    recentActivity,
  } = dashboard;

  const useShiftClock = requiresShiftClock({ role: "employee", pay_type: payType });
  const clockState = getEmployeeClockStatus(activeClock, todayClockEntries);
  const onShift = clockState === "on_shift";
  const openHelp = helpFlags.filter((f) =>
    ["open", "acknowledged", "in_progress"].includes(f.status)
  ).length;

  const task = currentTask;
  const totalDocs = task?.estimated_document_count ?? 0;
  const completedDocs = task?.current_documents_completed ?? 0;
  const remainingDocs =
    task?.estimated_remaining_documents ??
    (totalDocs > 0 ? Math.max(0, totalDocs - completedDocs) : null);
  const progressPct =
    totalDocs > 0 ? Math.min(100, Math.round((completedDocs / totalDocs) * 100)) : null;
  const forecastDate = task ? primaryDueDate(task) ?? task.suggested_due_date : null;
  const wrapUpComplete = wrapUpStatus === "submitted" || wrapUpStatus === "overridden";

  const guidance = nextStepMessage({
    currentTask,
    nextTask,
    qaReturns,
    openHelp,
    wrapUpStatus,
    onShift,
    useShiftClock,
    workEligible: workEligibility.eligible,
  });

  const eligibilityLabel =
    workEligibility.status === "eligible"
      ? "Eligible for work"
      : workEligibility.status === "needs_setup"
        ? "Setup incomplete"
      : workEligibility.status === "on_break"
        ? "On lunch break"
        : workEligibility.status === "override_active"
          ? "Override active"
          : workEligibility.status === "inactive"
            ? "Account inactive"
            : "Clocked out";

  return (
    <div className="flow-employee-workspace space-y-6 pb-10">
      {workEligibility.requiresClockIn && (
        <section
          className={cn(
            "enterprise-panel-elevated rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-3",
            workEligibility.eligible
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          )}
        >
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide">
              {eligibilityLabel}
            </p>
            <p className="text-sm text-muted-foreground">
              {clockStatusLabel(activeClock, todayClockEntries)}
              {workEligibility.eligible && workEligibility.sessionMinutes > 0
                ? ` · Session ${formatMinutes(workEligibility.sessionMinutes)}`
                : ""}
              {currentTask ? ` · Active task: ${currentTask.title}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span
              className={cn(
                "px-2 py-1 rounded-full border",
                workEligibility.clockedIn
                  ? "border-emerald-500/40 text-emerald-400"
                  : "border-border text-muted-foreground"
              )}
            >
              {workEligibility.clockedIn ? "Clocked in" : "Clocked out"}
            </span>
            {activeTaskTimer && (
              <span className="px-2 py-1 rounded-full border border-primary/30 text-primary">
                {activeTaskTimer.status === "active" ? "Timer running" : "Timer paused"}
              </span>
            )}
          </div>
        </section>
      )}

      <section className="flow-employee-hero enterprise-panel-elevated p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Briefcase className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="enterprise-label">Employee Workspace</p>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight mt-0.5">
              Good {getDayPart()}, {userName.split(" ")[0]}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{guidance}</p>
          </div>
        </div>
      </section>

      {useShiftClock && (
        <EmployeeClockWidget
          activeEntry={activeClock}
          todayEntries={todayClockEntries}
          shiftMinutesToday={dailySummary.shiftMinutesToday ?? workEligibility.sessionMinutes}
          wrapUpStatus={wrapUpStatus}
        />
      )}

      <section className="space-y-2">
        <p className="enterprise-label px-1">What do I do next?</p>
        <EmployeePrimaryActions
          currentTask={currentTask}
          nextTask={nextTask}
          activeTaskTimer={activeTaskTimer}
          useShiftClock={false}
          activeClock={activeClock}
          todayClockEntries={todayClockEntries}
          wrapUpStatus={wrapUpStatus}
          todayWrapUp={todayWrapUp}
          workEligibility={workEligibility}
        />
      </section>

      {qaReturns.length > 0 && <EmployeeQaReturns returns={qaReturns} />}

      <section className="flow-employee-active-panel enterprise-panel-elevated p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="enterprise-label mb-0">What am I working on?</p>
          {task && <StatusBadge status={task.status} />}
        </div>

        {task ? (
          <>
            <div>
              <h2 className="text-base sm:text-lg font-semibold leading-snug">{task.title}</h2>
              <p className="flow-meta mt-1">
                {task.project?.name}
                {task.manufacturer?.name ? ` · ${task.manufacturer.name}` : ""}
                {task.year ? ` · ${task.year}` : ""}
              </p>
            </div>

            {progressPct != null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Current progress</span>
                  <span className="font-semibold tabular-nums">{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetricChip
                label="Documents done"
                value={totalDocs > 0 ? String(completedDocs) : "—"}
                icon={FileText}
              />
              <MetricChip
                label="Remaining"
                value={remainingDocs != null ? String(remainingDocs) : "—"}
                icon={Target}
              />
              <MetricChip
                label="Forecast done"
                value={forecastDate ?? "—"}
                icon={Clock}
              />
              <MetricChip
                label="Task time"
                value={
                  useShiftClock
                    ? dailySummary.shiftMinutesToday != null
                      ? formatMinutes(dailySummary.shiftMinutesToday)
                      : "—"
                    : taskMinutesToday > 0
                      ? formatMinutes(taskMinutesToday)
                      : "—"
                }
                icon={Clock}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LiveForecastStatusBadge status={task.live_forecast_status} />
              {activeTaskTimer?.status === "paused" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                  Timer paused
                </span>
              )}
              {activeTaskTimer?.status === "active" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                  Timer running
                </span>
              )}
            </div>

            <Link
              href={`/work/${task.id}`}
              className={cn(buttonVariants({ size: "lg" }), "w-full h-11")}
            >
              <Play className="h-4 w-4 mr-2" />
              Open task workspace
            </Link>
          </>
        ) : (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">No active task right now.</p>
            {nextTask ? (
              <p className="text-xs text-muted-foreground">
                Next up: <span className="text-foreground font-medium">{nextTask.title}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Your manager will assign work when it&apos;s ready.
              </p>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatusCard
          title="Help request"
          icon={LifeBuoy}
          warn={openHelp > 0}
          value={openHelp > 0 ? `${openHelp} open` : "No open requests"}
          detail={
            openHelp > 0
              ? "Your team has been notified."
              : "Use Need Help if you're stuck."
          }
        />
        <StatusCard
          title="Wrap-up"
          icon={Moon}
          warn={useShiftClock && onShift && !wrapUpComplete}
          value={WRAP_UP_LABELS[wrapUpStatus]}
          detail={
            todayWrapUp?.completed_summary
              ? todayWrapUp.completed_summary
              : wrapUpComplete
                ? "You're set for today."
                : "Submit before clocking out."
          }
        />
      </div>

      {openHelp > 0 && (
        <section className="space-y-2">
          <p className="enterprise-label px-1">Help status</p>
          <HelpFlagStatusList flags={helpFlags} />
        </section>
      )}

      <section className="flow-live-panel">
        <div className="flow-live-panel-header">
          <div>
            <h3 className="enterprise-section-title">Recent activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Your tasks and updates</p>
          </div>
        </div>
        <div className="px-4 py-2">
          <ActivityFeed
            events={recentActivity}
            maxItems={10}
            emptyTitle="No activity yet"
            emptyDescription="Updates on your tasks will show up here."
          />
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {dailySummary.tasksCompletedToday} completed today
        </span>
        {useShiftClock && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {clockStatusLabel(activeClock, todayClockEntries)}
          </span>
        )}
        {dashboard.scorecard && (
          <Link href="/scorecard" className="text-primary hover:underline shrink-0">
            My scorecard
          </Link>
        )}
      </div>
    </div>
  );
}

function MetricChip({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="enterprise-panel px-3 py-2.5 text-center min-w-0">
      <Icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
      <p className="text-sm font-semibold tabular-nums truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function StatusCard({
  title,
  icon: Icon,
  value,
  detail,
  warn,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  detail: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "enterprise-panel p-4 space-y-1",
        warn && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", warn ? "text-amber-400" : "text-muted-foreground")} />
        <p className="enterprise-label mb-0">{title}</p>
      </div>
      <p className="font-semibold text-sm">{value}</p>
      <p className="text-xs text-muted-foreground line-clamp-2">{detail}</p>
    </div>
  );
}

function getDayPart(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
