import { TimeClockAdminView } from "@/components/production/time-clock-admin-view";
import {
  FlowPageShell,
  KpiStrip,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore } from "@/lib/data/flow-store";
import { initProductionTracking, getAllClockEntries } from "@/lib/data/production-tracking";
import {
  filterUsersToHierarchyScope,
  isHierarchyOrgWide,
} from "@/lib/hierarchy/resolver";
import { getTeamAvailability } from "@/lib/time-clock/get-team-availability";
import { isTimeClockMember } from "@/lib/time-clock/members";
import {
  normalizeClockRecordDateRange,
  parseClockRecordDateRange,
} from "@/lib/time-clock/record-filters";
import { buildDailyWrapUpComplianceReport } from "@/lib/wrap-up/compliance";
import { OPS_COPY } from "@/lib/copy/executive-terminology";

export default async function TimeClockPage({
  searchParams,
}: {
  searchParams: Promise<{
    employee?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await requirePageAccess("/time-clock");
  const sp = await searchParams;
  const dateRange = normalizeClockRecordDateRange(parseClockRecordDateRange(sp));
  await ensureAppDataLoaded();
  initProductionTracking();
  const store = getFlowStore();

  const scopedUsers = filterUsersToHierarchyScope(user, store.users, store.teams);
  const employeeUsers = scopedUsers.filter(isTimeClockMember);
  const teamMemberIds = employeeUsers.map((u) => u.id);
  const branchScoped = !isHierarchyOrgWide(user);

  const entries = getAllClockEntries(
    teamMemberIds.length
      ? { userIds: teamMemberIds, from: dateRange.from, to: dateRange.to }
      : { from: dateRange.from, to: dateRange.to }
  );

  const initialUserFilter =
    sp.employee && employeeUsers.some((u) => u.id === sp.employee) ? sp.employee : "all";
  const focusEmployee =
    initialUserFilter !== "all"
      ? employeeUsers.find((u) => u.id === initialUserFilter)
      : null;

  const availability = getTeamAvailability(employeeUsers);
  const wrapUpCompliance = buildDailyWrapUpComplianceReport(employeeUsers);
  const canOverrideWrapUp =
    hasPermission(user.role, "work:view_all") || hasPermission(user.role, "people:view_team");
  const canEditClocks = hasPermission(user.role, "work:assign");

  const onShift = availability.filter((a) => a.status === "on_shift" || a.status === "on_lunch").length;
  const offShift = availability.filter((a) => a.status === "off_shift").length;
  const missingWrapUp = wrapUpCompliance.filter((r) => r.wrapUpStatus === "missing").length;

  return (
    <FlowPageShell
      title={branchScoped ? "Team Time Clock" : "Time Clock"}
      eyebrow={PLATFORM_EYEBROWS.timeClock}
      breadcrumbs={[
        { label: "Time Clock" },
        ...(focusEmployee ? [{ label: focusEmployee.full_name }] : []),
      ]}
      description={
        branchScoped
          ? "Team availability, daily report compliance, and shift punches — managers can correct clock errors here"
          : "Team availability, daily report compliance, and shift records — managers can correct clock errors here"
      }
      pulse={
        <OperationalPostureStrip
          signals={[
            {
              id: "working",
              label: "On shift",
              value: onShift,
              status: onShift > 0 ? "active" : "idle",
              helpKey: "clockedIn",
            },
            {
              id: "off",
              label: "Off shift",
              value: offShift,
              status: "idle",
              helpKey: "offShift",
            },
            {
              id: "wrap",
              label: OPS_COPY.outstandingDailyReports,
              value: missingWrapUp,
              status: missingWrapUp > 0 ? "attention" : "healthy",
              helpKey: "outstandingDailyReports",
            },
          ]}
        />
      }
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { id: "team", label: "Team members", value: employeeUsers.length, helpKey: "teamMembers" },
            { id: "in", label: OPS_COPY.employeesClockedIn, value: onShift, spotlight: onShift > 0, helpKey: "employeesClockedIn" },
            { id: "out", label: "Off shift", value: offShift, helpKey: "offShift" },
            { id: "wrap", label: OPS_COPY.outstandingDailyReports, value: missingWrapUp, warn: missingWrapUp > 0, helpKey: "outstandingDailyReports" },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <TimeClockAdminView
            entries={entries}
            users={employeeUsers}
            availability={availability}
            wrapUpCompliance={wrapUpCompliance}
            canOverrideWrapUp={canOverrideWrapUp}
            canEdit={canEditClocks}
            initialDateRange={dateRange}
            initialUserFilter={initialUserFilter}
            syncFiltersToUrl
          />
        </WorkspaceContainer>
      }
    />
  );
}
