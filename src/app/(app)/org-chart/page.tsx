import { OrgChartView } from "@/components/hierarchy/org-chart-view";
import {
  FlowPageShell,
  KpiStrip,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess, assertScopedUserIdParam } from "@/lib/auth/guard";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { canAssignWork, hasPermission } from "@/lib/auth/permissions";
import {
  countVacantPositions,
  listUnassignedUsers,
} from "@/lib/positions/resolver";
import { OrgStructureBuilder } from "@/components/hierarchy/org-structure-builder";
import {
  buildDepartmentGroupedSections,
  buildOrgChartWithDiagnostics,
  buildOrgTree,
  hasGroupedDepartmentStructure,
  loadOrgChartBundle,
} from "@/lib/positions/org-tree";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { getWorkPackages } from "@/lib/data/work-packages";
import {
  buildOrgChartOpsMap,
  buildOrgChartProfileDetail,
  collectOrgChartUserIds,
  countOrgChartAttention,
} from "@/lib/hierarchy/org-chart-ops";
import { getHierarchyTree } from "@/lib/hierarchy/scope";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { alertCenterHref, wrapUpsHref } from "@/lib/navigation/deep-links";
import { OPS_COPY, OPS_TOOLTIPS } from "@/lib/copy/executive-terminology";
import type { OrgChartViewerPermissions } from "@/types/flow";

export default async function OrgChartPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const sessionUser = await requirePageAccess("/org-chart");
  const { userId: initialUserId } = await searchParams;
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();

  const bundle = await loadOrgChartBundle();
  const { integrity } = buildOrgChartWithDiagnostics(bundle);
  const { users: allUsers, departments, teams, positions } = bundle;

  const viewer = allUsers.find((u) => u.id === sessionUser.id) ?? sessionUser;
  const packages = await getWorkPackages();

  const scopedRoots = getHierarchyTree(
    viewer,
    allUsers,
    departments,
    teams,
    positions
  );

  const visibleUserIds = collectOrgChartUserIds(scopedRoots);
  assertScopedUserIdParam(viewer, initialUserId, visibleUserIds);
  const safeInitialUserId =
    initialUserId?.trim() && visibleUserIds.includes(initialUserId.trim())
      ? initialUserId.trim()
      : null;
  const opsMap = buildOrgChartOpsMap(visibleUserIds, allUsers, packages);

  const profiles = Object.fromEntries(
    visibleUserIds
      .map((id) => {
        const detail = buildOrgChartProfileDetail(
          id,
          allUsers,
          packages,
          opsMap,
          departments,
          teams
        );
        return detail ? [id, detail] as const : null;
      })
      .filter((x): x is [string, NonNullable<typeof x>[1]] => x !== null)
  );

  const attention = countOrgChartAttention(opsMap);

  const permissionRole = getEffectivePermissionRole(viewer);

  const permissions: OrgChartViewerPermissions = {
    canViewProfile:
      hasPermission(permissionRole, "people:view_all") ||
      hasPermission(permissionRole, "people:view_team"),
    canAssignTask: canAssignWork(permissionRole),
    canViewWorkload:
      hasPermission(permissionRole, "work:view_all") ||
      hasPermission(permissionRole, "work:view_team"),
    canViewWrapUps:
      hasPermission(permissionRole, "work:view_all") ||
      hasPermission(permissionRole, "work:view_team"),
    canViewHelpFlags:
      hasPermission(permissionRole, "work:view_all") ||
      hasPermission(permissionRole, "work:view_team"),
    canViewTimeclock:
      hasPermission(permissionRole, "work:view_all") ||
      hasPermission(permissionRole, "people:view_team"),
    canEditReportingChain: hasPermission(permissionRole, "users:manage"),
    canManagePositions: hasPermission(permissionRole, "users:manage"),
    canAssignPositions: hasPermission(permissionRole, "users:manage"),
  };

  const canManageAccounts =
    permissions.canManagePositions && isAdminConfigured();

  const usePositionChart = positions.length > 0;
  const tree = buildOrgTree(bundle);
  const useGroupedDisplay = hasGroupedDepartmentStructure(departments, positions);
  const groupedSections = useGroupedDisplay
    ? buildDepartmentGroupedSections(tree, departments, teams, scopedRoots)
    : [];
  const unassignedUsers = listUnassignedUsers(allUsers, positions);
  const vacantPositionCount = countVacantPositions(positions);

  if (integrity.issues.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn("[org-chart] loaded with integrity warnings", integrity.issues.length);
  }

  return (
    <FlowPageShell
      title="Organization Chart"
      eyebrow={PLATFORM_EYEBROWS.orgChart}
      breadcrumbs={[{ label: "Org Chart" }]}
      description="Organization reporting structure with status for escalations, capacity, attendance, and daily reports."
      pulse={
        <OperationalPostureStrip
          signals={[
            {
              id: "people",
              label: "In scope",
              value: visibleUserIds.length,
              status: "healthy",
            },
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
      kpis={
        <KpiStrip
          columns={4}
          items={[
            {
              id: "visible",
              label: "People in scope",
              value: visibleUserIds.length,
            },
            {
              id: "help",
              label: OPS_COPY.openEscalations,
              value: attention.needsHelp,
              warn: attention.needsHelp > 0,
              href: alertCenterHref({ type: "help" }),
              title: OPS_TOOLTIPS.openEscalations,
            },
            {
              id: "work",
              label: OPS_COPY.availableCapacity,
              value: attention.needsWork,
              warn: attention.needsWork > 0,
              href: alertCenterHref({ type: "workload" }),
              title: OPS_TOOLTIPS.availableCapacity,
            },
            {
              id: "wrapup",
              label: OPS_COPY.outstandingDailyReports,
              value: attention.missingWrapUp,
              warn: attention.missingWrapUp > 0,
              href: wrapUpsHref({ status: "missing" }),
              title: OPS_TOOLTIPS.outstandingDailyReports,
            },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          {permissions.canManagePositions && (
            <div className="p-4 pb-0">
              <OrgStructureBuilder
                departments={departments}
                users={allUsers}
                canManage={permissions.canManagePositions}
              />
            </div>
          )}
          <OrgChartView
            roots={scopedRoots}
            departments={departments}
            teams={teams}
            positions={positions}
            unassignedUsers={unassignedUsers}
            vacantPositionCount={vacantPositionCount}
            usePositionChart={usePositionChart}
            useGroupedDisplay={useGroupedDisplay}
            groupedSections={groupedSections}
            opsMap={opsMap}
            profiles={profiles}
            permissions={permissions}
            allUsers={allUsers}
            viewerId={viewer.id}
            visibleUserIds={visibleUserIds}
            attention={attention}
            initialUserId={safeInitialUserId}
            canManageAccounts={canManageAccounts}
          />
        </WorkspaceContainer>
      }
    />
  );
}
