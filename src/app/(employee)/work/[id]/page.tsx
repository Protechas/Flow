import { EmployeeTaskWorkspace } from "@/components/employee/employee-task-workspace";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveClockEntry,
  getActiveTaskTimeEntry,
  getLatestSubmission,
  getTaskFiles,
  getTodayClockEntries,
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
import { format } from "date-fns";

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
  const today = format(new Date(), "yyyy-MM-dd");
  const payType = normalizePayType(user.pay_type, user.role);

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
    <EmployeeTaskWorkspace
      task={task}
      comments={store.comments}
      files={getTaskFiles(task.id)}
      userId={user.id}
      autostart={autostart === "1"}
      activeTimer={activeTimer?.task_id === task.id ? activeTimer : null}
      anyActiveTimer={activeTimer}
      totalMinutes={getTotalTaskMinutes(task.id)}
      latestSubmission={getLatestSubmission(task.id)}
      helpFlags={helpFlags}
      workEligibility={getWorkEligibility(user)}
      workflowInput={workflowInput}
    />
  );
}
