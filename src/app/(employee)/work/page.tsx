import { EmployeeHome } from "@/components/employee/employee-home";
import { requirePageAccess } from "@/lib/auth/guard";
import { getEmployeeDashboard } from "@/lib/employee/dashboard";
import {
  getActiveClockEntry,
  getTaskMinutesToday,
  getTodayClockEntries,
} from "@/lib/data/production-tracking";
import { normalizePayType } from "@/lib/users/pay-type";
import { getWrapUpComplianceStatus } from "@/lib/wrap-up/compliance";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { listEmployeeHelpFlags } from "@/lib/help-flags/engine";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getWorkPackages } from "@/lib/data/work-packages";
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
    />
  );
}
