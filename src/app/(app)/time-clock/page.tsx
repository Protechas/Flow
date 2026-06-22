import { TimeClockAdminView } from "@/components/production/time-clock-admin-view";
import {
  FlowPageShell,
  KpiStrip,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { hasPermission } from "@/lib/auth/permissions";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getAllClockEntries } from "@/lib/data/production-tracking";
import { getTeamAvailability } from "@/lib/time-clock/get-team-availability";
import { buildDailyWrapUpComplianceReport } from "@/lib/wrap-up/compliance";
import { OPS_COPY, OPS_TOOLTIPS } from "@/lib/copy/executive-terminology";

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

  const onShift = availability.filter((a) => a.status === "on_shift" || a.status === "on_lunch").length;
  const offShift = availability.filter((a) => a.status === "off_shift").length;
  const missingWrapUp = wrapUpCompliance.filter((r) => r.wrapUpStatus === "missing").length;

  return (
    <FlowPageShell
      title={branchIds ? "Team Time Clock" : "Time Clock"}
      eyebrow={PLATFORM_EYEBROWS.timeClock}
      breadcrumbs={[{ label: "Time Clock" }]}
      description={
        branchIds
          ? "Team availability, daily report compliance, and shift punches"
          : "Team availability, daily report compliance, and daily shift records"
      }
      pulse={
        <OperationalPostureStrip
          signals={[
            {
              id: "working",
              label: "On shift",
              value: onShift,
              status: onShift > 0 ? "active" : "idle",
            },
            {
              id: "off",
              label: "Off shift",
              value: offShift,
              status: "idle",
            },
            {
              id: "wrap",
              label: OPS_COPY.outstandingDailyReports,
              value: missingWrapUp,
              status: missingWrapUp > 0 ? "attention" : "healthy",
            },
          ]}
        />
      }
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { id: "team", label: "Team members", value: employeeUsers.length },
            { id: "in", label: OPS_COPY.employeesClockedIn, value: onShift, spotlight: onShift > 0 },
            { id: "out", label: "Off shift", value: offShift },
            { id: "wrap", label: OPS_COPY.outstandingDailyReports, value: missingWrapUp, warn: missingWrapUp > 0, title: OPS_TOOLTIPS.outstandingDailyReports },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <TimeClockAdminView
            entries={entries}
            users={employeeUsers.length ? employeeUsers : visibleUsers.filter((u) => u.role === "employee")}
            availability={availability}
            wrapUpCompliance={wrapUpCompliance}
            canOverrideWrapUp={canOverrideWrapUp}
          />
        </WorkspaceContainer>
      }
    />
  );
}
