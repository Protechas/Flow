import { redirect } from "next/navigation";
import { PeopleScopeRoster } from "@/components/people/people-scope-roster";
import { PeopleDashboard } from "@/components/people/people-dashboard";
import { FlowPageShell, OperationalPostureStrip, PLATFORM_EYEBROWS, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess, requireHierarchyUserAccess } from "@/lib/auth/guard";
import { getVisibleUserIds, isHierarchyOrgWide, filterUsersToHierarchyScope } from "@/lib/hierarchy/resolver";
import { hasPermission, isTeamLeadRole, canAccessHref } from "@/lib/auth/permissions";
import { getPeopleProfiles, getTeamScorecardSummary } from "@/lib/data/people";
import { getFlowStore, initFlowStore, listDepartments, listTeamsStore } from "@/lib/data/flow-store";
import { getUserPrimaryDepartmentId } from "@/lib/departments/resolve";
import { getWorkPackages } from "@/lib/data/work-packages";
import { buildOrgChartOpsMap, countOrgChartAttention } from "@/lib/hierarchy/org-chart-ops";
import { alertCenterHref, wrapUpsHref } from "@/lib/navigation/deep-links";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { initProductionTracking } from "@/lib/data/production-tracking";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const { userId } = await searchParams;
  if (userId?.trim()) {
    await requireHierarchyUserAccess(userId.trim());
    redirect(`/people/${userId.trim()}`);
  }

  const user = await requirePageAccess("/people");

  if (
    hasPermission(user.role, "people:view_own") &&
    !hasPermission(user.role, "people:view_all") &&
    !hasPermission(user.role, "people:view_team")
  ) {
    redirect(`/people/${user.id}`);
  }

  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  initFlowStore();
  initProductionTracking();
  const storeUsers = getFlowStore().users;
  const teams = listTeamsStore();
  const scopeIds = isHierarchyOrgWide(user)
    ? undefined
    : getVisibleUserIds(user, storeUsers, teams);
  const scopedUsers = isHierarchyOrgWide(user)
    ? storeUsers.filter((u) => u.is_active)
    : filterUsersToHierarchyScope(user, storeUsers, teams);
  const departments = listDepartments().filter((d) => d.status === "active");
  const packages = await getWorkPackages();
  const opsMap = buildOrgChartOpsMap(
    scopedUsers.map((u) => u.id),
    storeUsers,
    packages
  );
  const userDepartments = Object.fromEntries(
    scopedUsers.map((u) => [u.id, getUserPrimaryDepartmentId(u.id)])
  );

  const attention = countOrgChartAttention(opsMap);

  const [profiles, teamSummary] = await Promise.all([
    getPeopleProfiles(scopeIds),
    getTeamScorecardSummary(scopeIds),
  ]);

  const analyticsHref = canAccessHref(user.role, "/analytics")
    ? "/analytics"
    : canAccessHref(user.role, "/performance")
      ? "/performance"
      : undefined;

  return (
    <FlowPageShell
      title={isTeamLeadRole(user.role) ? "My Team" : "People"}
      eyebrow={PLATFORM_EYEBROWS.people}
      breadcrumbs={[{ label: "People" }]}
      description={
        isTeamLeadRole(user.role)
          ? "Team performance — workload, productivity, quality, and QA metrics for your direct reports"
          : "Workforce performance — Operations Score, productivity, quality, workload, and QA metrics"
      }
      pulse={
        <OperationalPostureStrip
          signals={[
            { id: "people", label: "In roster", value: scopedUsers.length, status: "healthy" },
            {
              id: "help",
              label: OPS_COPY.openEscalations,
              value: attention.needsHelp,
              status: attention.needsHelp > 0 ? "critical" : "healthy",
              href: alertCenterHref({ type: "help" }),
            },
            {
              id: "work",
              label: OPS_COPY.availableCapacity,
              value: attention.needsWork,
              status: attention.needsWork > 0 ? "attention" : "healthy",
              href: alertCenterHref({ type: "workload" }),
            },
            {
              id: "wrapup",
              label: OPS_COPY.outstandingDailyReports,
              value: attention.missingWrapUp,
              status: attention.missingWrapUp > 0 ? "attention" : "healthy",
              href: wrapUpsHref({ status: "missing" }),
            },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6 p-0">
          <PeopleScopeRoster
            users={scopedUsers}
            departments={departments}
            teams={teams}
            viewerId={user.id}
            opsMap={opsMap}
            userDepartments={userDepartments}
          />
          <PeopleDashboard
            profiles={profiles}
            teamSummary={teamSummary}
            analyticsHref={analyticsHref}
          />
        </WorkspaceContainer>
      }
    />
  );
}
