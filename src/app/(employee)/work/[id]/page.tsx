import { EmployeeTaskWorkspace } from "@/components/employee/employee-task-workspace";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveTaskTimeEntry,
  getLatestSubmission,
  getTaskFiles,
  getTotalTaskMinutes,
} from "@/lib/data/production-tracking";
import { getEmployeeTaskForUser } from "@/lib/employee/tasks";
import { getWorkEligibility } from "@/lib/work-eligibility";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { listEmployeeHelpFlags } from "@/lib/help-flags/engine";
import { getWorkPackages } from "@/lib/data/work-packages";
import { requirePageAccess } from "@/lib/auth/guard";
import { loadAccountSetupSummary } from "@/lib/setup/guard";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export default async function EmployeeTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autostart?: string }>;
}) {
  const user = await requirePageAccess("/work");
  const setup = loadAccountSetupSummary(user);
  if (isEmployeeRole(user.role) && setup.setupStatus === "needs_setup") {
    redirect("/work");
  }

  const { id } = await params;
  const { autostart } = await searchParams;

  const task = await getEmployeeTaskForUser(user.id, id);
  if (!task) {
    redirect("/work");
  }

  initFlowStore();
  const store = getFlowStore();
  await hydrateHelpFlagSettings();
  const packages = await getWorkPackages();
  const helpFlags = listEmployeeHelpFlags(user.id, packages, store.users).filter(
    (f) => f.task_id === task.id || !f.task_id
  );
  const activeTimer = getActiveTaskTimeEntry(user.id);

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
    />
  );
}
