import { PageHeader } from "@/components/layout/page-header";
import { TimeClockAdminView } from "@/components/production/time-clock-admin-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { hasPermission } from "@/lib/auth/permissions";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getAllClockEntries } from "@/lib/data/production-tracking";
import { getTeamAvailability } from "@/lib/time-clock/get-team-availability";
import { buildDailyWrapUpComplianceReport } from "@/lib/wrap-up/compliance";

export default async function TimeClockPage() {
  const user = await requirePageAccess("/time-clock");
  initFlowStore();
  const store = getFlowStore();

  const branchIds = getScopeMemberIds(user, store.users, store.teams);

  const entries = getAllClockEntries(
    branchIds?.length ? { userIds: branchIds, days: 14 } : { days: 14 }
  );

  const visibleUsers = branchIds?.length
    ? store.users.filter((u) => branchIds.includes(u.id))
    : store.users;

  const employeeUsers = visibleUsers.filter((u) => u.role === "employee" && u.is_active);
  const availability = getTeamAvailability(employeeUsers);
  const wrapUpCompliance = buildDailyWrapUpComplianceReport(
    employeeUsers.length ? employeeUsers : visibleUsers.filter((u) => u.role === "employee" && u.is_active)
  );
  const canOverrideWrapUp =
    hasPermission(user.role, "work:view_all") || hasPermission(user.role, "people:view_team");

  return (
    <>
      <PageHeader
        title={branchIds ? "Team Time Clock" : "Time Clock"}
        description={
          branchIds
            ? "Team availability, wrap-up compliance, and shift punches"
            : "Team availability, wrap-up compliance, and daily shift records"
        }
      />
      <TimeClockAdminView
        entries={entries}
        users={employeeUsers.length ? employeeUsers : visibleUsers.filter((u) => u.role === "employee")}
        availability={availability}
        wrapUpCompliance={wrapUpCompliance}
        canOverrideWrapUp={canOverrideWrapUp}
      />
    </>
  );
}
