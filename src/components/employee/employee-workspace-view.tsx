"use client";

import { useMemo, useState } from "react";
import { TicketPulse } from "@/components/requests/ticket-pulse";
import { EmployeeActiveProjects } from "@/components/employee/employee-active-projects";
import { EmployeeActivityHistory } from "@/components/employee/employee-activity-history";
import { EmployeeAttentionPanel } from "@/components/employee/employee-attention-panel";
import { EmployeeQuickActions } from "@/components/employee/employee-quick-actions";
import { EmployeeTodayScore } from "@/components/employee/employee-today-score";
import { EmployeeTodaysMission } from "@/components/employee/employee-todays-mission";
import { EmployeeUpNextList } from "@/components/employee/employee-up-next-list";
import { EmployeeWorkflowProvider } from "@/components/employee/employee-workflow-context";
import { EmployeeWorkflowPanel } from "@/components/employee/employee-workflow-panel";
import { SideSessionCard } from "@/components/employee/side-session-card";
import { requiresShiftClock } from "@/lib/users/pay-type";
import { sortOverdueFirst } from "@/lib/employee/queue";
import type { WorkEligibility } from "@/lib/work-eligibility";
import type { EmployeeDashboard } from "@/lib/employee/dashboard";
import type {
  HelpFlagView,
  PayType,
  SideSession,
  TimeClockEntry,
  WrapUpComplianceStatus,
} from "@/types/flow";

export function EmployeeWorkspaceView({
  dashboard,
  userName,
  payType,
  activeClock,
  todayClockEntries,
  wrapUpStatus,
  helpFlags = [],
  workEligibility,
  visibilityToday,
  pendingWorkRequest = false,
  taskReadyForSubmission = false,
  sideSession = null,
  sideSessionMinutes = 0,
  ticketPulse = null,
  teamWorkspace,
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
  visibilityToday: {
    clockedMinutes: number;
    recordedTaskMinutes: number;
    unassignedMinutes: number;
    taskTrackingCompliancePct: number | null;
  };
  pendingWorkRequest?: boolean;
  taskReadyForSubmission?: boolean;
  sideSession?: SideSession | null;
  sideSessionMinutes?: number;
  ticketPulse?: { open: number; oldestMinutes: number | null } | null;
  /** Per-team workspace behavior from the team's operating model. */
  teamWorkspace?: {
    wrapUpFields: { id: string; label: string; placeholder?: string }[];
    showActiveProjectsPanel: boolean;
    overdueFirst: boolean;
  };
}) {
  const [wrapUpOpen, setWrapUpOpen] = useState(false);

  const {
    currentTask,
    nextTask,
    activeTaskTimer,
    dailySummary,
    qaReturns,
    todayWrapUp,
    recentActivity,
    myQueue,
    board,
  } = dashboard;

  const useShiftClock = requiresShiftClock({ role: "employee", pay_type: payType });
  const openHelpFlags = helpFlags.filter((f) =>
    ["open", "acknowledged", "in_progress"].includes(f.status)
  );

  const missionNext = myQueue.upNext[0] ?? nextTask ?? null;
  const assignedTaskCount = board.all.filter((t) => t.status !== "done").length;

  const timerTask = activeTaskTimer
    ? board.all.find((t) => t.id === activeTaskTimer.task_id) ?? null
    : null;
  const stagedTask =
    !activeTaskTimer &&
    currentTask &&
    (currentTask.status === "working_on_it" || currentTask.status === "correction_needed")
      ? currentTask
      : null;
  const submittedTask =
    currentTask && ["ready_for_qa", "in_qa", "done"].includes(currentTask.status)
      ? currentTask
      : null;

  const workflowInput = useMemo(
    () => ({
      useShiftClock,
      workEligibility,
      activeClock,
      todayClockEntries,
      timerTask,
      stagedTask,
      submittedTask,
      activeTaskTimer,
      nextTask: missionNext,
      wrapUpStatus,
      assignedTaskCount,
      pendingWorkRequest,
      taskReadyForSubmission,
    }),
    [
      useShiftClock,
      workEligibility,
      activeClock,
      todayClockEntries,
      timerTask,
      stagedTask,
      submittedTask,
      activeTaskTimer,
      missionNext,
      wrapUpStatus,
      assignedTaskCount,
      pendingWorkRequest,
      taskReadyForSubmission,
    ]
  );

  const upNextBase = currentTask
    ? myQueue.upNext
    : myQueue.upNext.filter((t) => t.id !== missionNext?.id);
  // Teams that opt in (workspace.overdueFirst) surface overdue work at the top.
  const upNextTasks = teamWorkspace?.overdueFirst ? sortOverdueFirst(upNextBase) : upNextBase;

  const waitingOnQa = [...board.waitingQa].map((t) => ({ id: t.id, title: t.title }));
  const blockedIds = new Set(myQueue.blocked.map((b) => b.task.id));
  const qaReturnIds = new Set(qaReturns.map((r) => r.package.id));
  const waitingOnQaFiltered = waitingOnQa.filter(
    (t) => !blockedIds.has(t.id) && !qaReturnIds.has(t.id)
  );

  return (
    <EmployeeWorkflowProvider input={workflowInput}>
      <div className="flow-employee-workspace space-y-5 pb-10">
        <div className="px-1 pt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {(() => {
                const h = new Date().getHours();
                const greeting =
                  h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
                return (
                  <>
                    {greeting}, <span className="text-primary">{userName.split(" ")[0]}</span>.
                  </>
                );
              })()}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here&apos;s your day — your mission, your queue, and where you stand.
            </p>
          </div>
          {ticketPulse && <TicketPulse pulse={ticketPulse} showWhenEmpty />}
        </div>

        <EmployeeWorkflowPanel
          todayWrapUp={todayWrapUp}
          visibility={visibilityToday}
          wrapUpOpen={wrapUpOpen}
          onWrapUpOpenChange={setWrapUpOpen}
          wrapUpExtraFields={teamWorkspace?.wrapUpFields}
        />

        <SideSessionCard
          initialSession={sideSession}
          todayMinutes={sideSessionMinutes}
          canStart={!useShiftClock || Boolean(activeClock)}
        />

        <EmployeeTodaysMission activeTaskTimer={activeTaskTimer} />

        {teamWorkspace?.showActiveProjectsPanel && (
          <EmployeeActiveProjects tasks={board.all} />
        )}

        <EmployeeUpNextList tasks={upNextTasks} />

        <EmployeeQuickActions
          todayWrapUp={todayWrapUp}
          visibility={visibilityToday}
          onOpenWrapUp={() => setWrapUpOpen(true)}
        />

        <EmployeeTodayScore
          summary={dailySummary}
          qaReturns={qaReturns.length}
          scorecardHref={dashboard.scorecard ? "/scorecard" : undefined}
        />

        <EmployeeAttentionPanel
          qaReturns={qaReturns}
          blocked={myQueue.blocked.filter((b) => !qaReturnIds.has(b.task.id))}
          waitingOnQa={waitingOnQaFiltered}
          openHelpFlags={openHelpFlags}
        />

        <EmployeeActivityHistory events={recentActivity} />
      </div>
    </EmployeeWorkflowProvider>
  );
}
