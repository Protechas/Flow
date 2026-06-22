import { EmployeeHome } from "@/components/employee/employee-home";
import { EmployeeNeedsSetupView } from "@/components/setup/employee-needs-setup-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { loadAccountSetupSummary } from "@/lib/setup/guard";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { getEmployeeDashboard } from "@/lib/employee/dashboard";
import {
  getActiveClockEntry,
  getTaskMinutesToday,
  getTodayClockEntries,
} from "@/lib/data/production-tracking";
import { normalizePayType } from "@/lib/users/pay-type";
import { getWrapUpComplianceStatus } from "@/lib/wrap-up/compliance";
import { getWorkEligibility, syncWorkEligibilityMismatchAlert } from "@/lib/work-eligibility";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { listEmployeeHelpFlags } from "@/lib/help-flags/engine";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { getTodayVisibilityForUser } from "@/lib/work-visibility/calculator";
import { employeeHasOpenWorkloadRequest } from "@/lib/workload-alerts/employee-requests";
import { format } from "date-fns";

export default async function EmployeeWorkPage() {
  const user = await requirePageAccess("/work");
  const dashboard = await getEmployeeDashboard(user.id);
  const payType = normalizePayType(user.pay_type, user.role);
  const today = format(new Date(), "yyyy-MM-dd");
  await hydrateHelpFlagSettings();
  initFlowStore();
  const store = getFlowStore();
  const packages = await getWorkPackages();
  const helpFlags = listEmployeeHelpFlags(user.id, packages, store.users);
  syncWorkEligibilityMismatchAlert(user);

  const setup = loadAccountSetupSummary(user);
  if (isEmployeeRole(user.role) && setup.setupStatus === "needs_setup") {
    return <EmployeeNeedsSetupView user={user} setup={setup} />;
  }

  return (
    <EmployeeHome
      dashboard={dashboard}
      userName={user.full_name}
      payType={payType}
      activeClock={getActiveClockEntry(user.id)}
      todayClockEntries={getTodayClockEntries(user.id)}
      taskMinutesToday={getTaskMinutesToday(user.id)}
      wrapUpStatus={getWrapUpComplianceStatus(user.id, today)}
      helpFlags={helpFlags}
      workEligibility={getWorkEligibility(user)}
      visibilityToday={getTodayVisibilityForUser(user.id)}
      pendingWorkRequest={employeeHasOpenWorkloadRequest(user.id)}
    />
  );
}
