import { PageHeader } from "@/components/layout/page-header";
import { OrgChartView } from "@/components/hierarchy/org-chart-view";
import { requirePageAccess } from "@/lib/auth/guard";
import {
  canAssignWork,
  hasPermission,
} from "@/lib/auth/permissions";
import { getFlowStore, initFlowStore, listDepartments, listTeamsStore } from "@/lib/data/flow-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { buildOrgChart, getVisibleUserIds, isOrgWideRole, pruneOrgChartNodes } from "@/lib/hierarchy/resolver";
import {
  buildOrgChartOpsMap,
  buildOrgChartProfileDetail,
  collectOrgChartUserIds,
  countOrgChartAttention,
} from "@/lib/hierarchy/org-chart-ops";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import type { OrgChartViewerPermissions } from "@/types/flow";

export default async function OrgChartPage() {
  const user = await requirePageAccess("/org-chart");
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  initFlowStore();
  const store = getFlowStore();
  const departments = listDepartments().filter((d) => d.status === "active");
  const teams = listTeamsStore();
  const packages = await getWorkPackages();

  const roots = isOrgWideRole(user.role)
    ? buildOrgChart(store.users, departments, teams)
    : buildOrgChart(store.users, departments, teams, user.id);

  const visibleIds = new Set(getVisibleUserIds(user, store.users, teams));
  const scopedRoots = isOrgWideRole(user.role)
    ? roots
    : pruneOrgChartNodes(roots, visibleIds);

  const visibleUserIds = collectOrgChartUserIds(scopedRoots);
  const opsMap = buildOrgChartOpsMap(visibleUserIds, store.users, packages);

  const profiles = Object.fromEntries(
    visibleUserIds
      .map((id) => {
        const detail = buildOrgChartProfileDetail(
          id,
          store.users,
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

  const permissions: OrgChartViewerPermissions = {
    canViewProfile:
      hasPermission(user.role, "people:view_all") ||
      hasPermission(user.role, "people:view_team"),
    canAssignTask: canAssignWork(user.role),
    canViewWorkload:
      hasPermission(user.role, "work:view_all") ||
      hasPermission(user.role, "work:view_team"),
    canViewWrapUps:
      hasPermission(user.role, "work:view_all") ||
      hasPermission(user.role, "work:view_team"),
    canViewHelpFlags:
      hasPermission(user.role, "work:view_all") ||
      hasPermission(user.role, "work:view_team"),
    canViewTimeclock:
      hasPermission(user.role, "work:view_all") ||
      hasPermission(user.role, "people:view_team"),
    canEditReportingChain: hasPermission(user.role, "users:manage"),
  };

  return (
    <>
      <PageHeader
        title="Organization Chart"
        eyebrow="Enterprise Command Map"
        breadcrumbs={[{ label: "Org Chart" }]}
        description="Live enterprise command map — reporting chain hierarchy with operational signals for help, workload, clock status, and wrap-ups."
      />
      <OrgChartView
        roots={scopedRoots}
        departments={departments}
        teams={teams}
        opsMap={opsMap}
        profiles={profiles}
        permissions={permissions}
        allUsers={store.users}
        viewerId={user.id}
        visibleUserIds={visibleUserIds}
        attention={attention}
      />
    </>
  );
}
