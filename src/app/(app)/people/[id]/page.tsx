import { PageHeader } from "@/components/layout/page-header";
import { EmployeeScorecardView } from "@/components/performance/employee-scorecard-view";
import { requireOwnProfileOrTeam } from "@/lib/auth/guard";
import { WorkloadAlertsPanel } from "@/components/workload-alerts/workload-alerts-panel";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { listWorkloadAlertsForViewer } from "@/lib/workload-alerts/engine";
import { getWorkPackages } from "@/lib/data/work-packages";
import { hasPermission } from "@/lib/auth/permissions";
import { canViewerSeeUser, getTeamMemberIds } from "@/lib/auth/team-scope";
import { isOrgWideRole } from "@/lib/hierarchy/resolver";
import { getPeopleProfile, getTeamScorecardSummary } from "@/lib/data/people";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { notFound } from "next/navigation";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireOwnProfileOrTeam(id);
  const profile = await getPeopleProfile(id);
  if (!profile) notFound();

  const canDrillDown = hasPermission(viewer.role, "people:view_all");
  let teamSummary = canDrillDown ? await getTeamScorecardSummary() : undefined;

  initFlowStore();
  const storeUsers = getFlowStore().users;

  if (!isOrgWideRole(viewer.role) && viewer.role !== "employee") {
    const branchIds = getTeamMemberIds(viewer, storeUsers, getFlowStore().teams);
    teamSummary = await getTeamScorecardSummary(branchIds);
  }

  const canEditPayType =
    profile.user.role === "employee" &&
    (hasPermission(viewer.role, "users:manage") ||
      (hasPermission(viewer.role, "people:view_team") &&
        canViewerSeeUser(viewer, id, storeUsers, getFlowStore().teams)));

  await hydrateWorkloadAlertSettings();
  const packages = await getWorkPackages();
  const canViewBranch =
    !isOrgWideRole(viewer.role) && viewer.role !== "employee";
  const employeeAlerts =
    canViewBranch &&
    viewer.id !== id &&
    canViewerSeeUser(viewer, id, storeUsers, getFlowStore().teams)
      ? listWorkloadAlertsForViewer(viewer, packages, storeUsers).filter(
          (a) => a.employee_id === id
        )
      : [];

  return (
    <>
      <PageHeader
        title={profile.user.full_name}
        description="Employee scorecard with performance metrics and trends"
      />
      <EmployeeScorecardView
        scorecard={profile}
        teamSummary={teamSummary}
        showManagerDrillDown={canDrillDown || canViewBranch}
        backHref={canDrillDown || canViewBranch ? "/people" : undefined}
        canEditPayType={canEditPayType}
      />
      {employeeAlerts.length > 0 && (
        <div className="mt-6">
          <WorkloadAlertsPanel alerts={employeeAlerts} role={viewer.role} compact />
        </div>
      )}
    </>
  );
}
