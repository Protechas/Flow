import { appTodayDate } from "@/lib/datetime/timezone";
import { EmployeeTaskWorkspace } from "@/components/employee/employee-task-workspace";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  getLatestSubmission,
  getPendingSessionTaskMinutes,
  getTaskFilesForPendingSession,
  getTodayClockEntries,
  getTotalTaskFileCount,
  getTotalTaskMinutes,
} from "@/lib/data/production-tracking";
import { buildTaskPageWorkflowInput } from "@/lib/employee/workflow-input";
import { getWorkEligibility } from "@/lib/work-eligibility";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { listEmployeeHelpFlags } from "@/lib/help-flags/engine";
import { getWorkPackages } from "@/lib/data/work-packages";
import { requireWorkPackageAccess } from "@/lib/auth/guard";
import { loadAccountSetupSummary } from "@/lib/setup/guard";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { normalizePayType } from "@/lib/users/pay-type";
import { getWrapUpComplianceStatus } from "@/lib/wrap-up/compliance";
import { employeeHasOpenWorkloadRequest } from "@/lib/workload-alerts/employee-requests";
import { redirect } from "next/navigation";
import { enrichPackages } from "@/lib/data/flow-store";
import { LiveRefresh } from "@/components/platform";
import { isTicketReceiver } from "@/lib/requests/audience";
import { listActiveTickets } from "@/lib/requests/tickets";

export default async function EmployeeTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autostart?: string }>;
}) {
  const { id } = await params;
  const { autostart } = await searchParams;

  const { user, pkg } = await requireWorkPackageAccess(id, "/work");
  const setup = loadAccountSetupSummary(user);
  if (isEmployeeRole(user.role) && setup.setupStatus === "needs_setup") {
    redirect("/work");
  }

  const [task] = enrichPackages([pkg]);
  if (!task) {
    redirect("/unauthorized");
  }

  initFlowStore();
  const store = getFlowStore();
  await hydrateHelpFlagSettings();
  const packages = await getWorkPackages();
  const helpFlags = listEmployeeHelpFlags(user.id, packages, store.users).filter(
    (f) => f.task_id === task.id || !f.task_id
  );
  const activeTimer = getActiveTaskTimeEntry(user.id);
  const today = appTodayDate();
  const payType = normalizePayType(user.pay_type, user.role);

  // Requests must be visible where people actually spend the day — inside a
  // task. Strip renders only when something is waiting.
  const canReceiveTickets = await isTicketReceiver(user);
  const openTickets = canReceiveTickets
    ? (await listActiveTickets().catch(() => [])).filter((t) => t.status === "open")
    : [];
  const ticketPulse = canReceiveTickets
    ? {
        open: openTickets.length,
        oldestMinutes: openTickets.length
          ? Math.max(
              0,
              Math.round(
                (Date.now() -
                  Math.min(...openTickets.map((t) => new Date(t.created_at).getTime()))) /
                  60000
              )
            )
          : null,
      }
    : null;

  const workflowInput = buildTaskPageWorkflowInput({
    user,
    task,
    payType,
    workEligibility: getWorkEligibility(user),
    activeClock: getActiveClockEntry(user.id),
    todayClockEntries: getTodayClockEntries(user.id),
    activeTaskTimer: activeTimer,
    wrapUpStatus: getWrapUpComplianceStatus(user.id, today),
    pendingWorkRequest: employeeHasOpenWorkloadRequest(user.id),
  });

  return (
    <>
    <LiveRefresh intervalMs={60_000} />
    <EmployeeTaskWorkspace
      task={task}
      comments={store.comments}
      qaReviews={store.qaReviews.filter((r) => r.work_package_id === task.id)}
      files={getTaskFilesForPendingSession(task.id)}
      totalFileCount={getTotalTaskFileCount(task.id)}
      userId={user.id}
      autostart={autostart === "1"}
      activeTimer={activeTimer?.task_id === task.id ? activeTimer : null}
      anyActiveTimer={activeTimer}
      totalMinutes={getPendingSessionTaskMinutes(task.id, user.id)}
      allTimeMinutes={getTotalTaskMinutes(task.id)}
      latestSubmission={getLatestSubmission(task.id)}
      helpFlags={helpFlags}
      workEligibility={getWorkEligibility(user)}
      workflowInput={workflowInput}
      ticketPulse={ticketPulse}
    />
    </>
  );
}
