import { OperationsBoard } from "@/components/operations/operations-board";
import { PageHeader } from "@/components/layout/page-header";
import { NewWorkWizard } from "@/components/work-creation/new-work-wizard";
import { DepartmentFilterBar } from "@/components/departments/department-filter-bar";
import { WorkloadAlertsPanel } from "@/components/workload-alerts/workload-alerts-panel";
import { HelpFlagsPanel } from "@/components/help-flags/help-flags-panel";
import { requirePageAccess } from "@/lib/auth/guard";
import {
  canAssignWork,
  canDeleteProjects,
  canEditWork,
  canReviewQa,
  canSubmitToQa,
  hasPermission,
  isReadOnly,
  isTeamLeadRole,
} from "@/lib/auth/permissions";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { listWorkloadAlertsForViewer } from "@/lib/workload-alerts/engine";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { listHelpFlagsForViewer } from "@/lib/help-flags/engine";
import { getFlowStore, initFlowStore, listDepartments, listTeamsStore } from "@/lib/data/flow-store";
import { getAnalysts, getManagers } from "@/lib/data/projects";
import { getAllTaskFileUploads, initProductionTracking } from "@/lib/data/production-tracking";
import { getOperationsTree, getWorkPackages } from "@/lib/data/work-packages";
import {
  DEFAULT_OPS_FILTERS,
  filterOperationsTree,
  getTeamUserIds,
} from "@/lib/operations/board-filters";
import { parseDepartmentFilter } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getActiveDepartments } from "@/lib/departments/filters";
import { resolveDepartmentForProject } from "@/lib/departments/resolve";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { getAssignableUserIds } from "@/lib/hierarchy/resolver";
import { parseOpsViewParam } from "@/lib/navigation/deep-links";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; search?: string; package?: string; view?: string }>;
}) {
  const user = await requirePageAccess("/operations");
  const { department: deptParam, search: searchParam, package: packageParam, view: viewParam } =
    await searchParams;
  const initialViewId = parseOpsViewParam(viewParam);
  await hydrateForecastSettings();
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  initFlowStore();
  initProductionTracking();
  const store = getFlowStore();
  const teams = listTeamsStore();
  const departmentFilter = parseDepartmentFilter({ department: deptParam });
  const departments = getActiveDepartments(
    filterDepartmentsForViewer(listDepartments(), user)
  );

  const viewOwnOnly =
    hasPermission(user.role, "work:view_own") && !hasPermission(user.role, "work:view_all") && !hasPermission(user.role, "work:view_team");

  const [rawTree, analysts, managers] = await Promise.all([
    getOperationsTree(viewOwnOnly ? { assignedTo: user.id } : undefined),
    getAnalysts(),
    getManagers(),
  ]);

  const branchIds = getScopeMemberIds(user, store.users, teams);
  const teamUserIds = viewOwnOnly ? [user.id] : getTeamUserIds(user, analysts, store.users, teams);
  let tree = branchIds?.length
    ? filterOperationsTree(rawTree, { ...DEFAULT_OPS_FILTERS, viewId: "my_team" }, branchIds)
    : rawTree;

  if (departmentFilter) {
    tree = {
      projects: tree.projects.filter(
        (node) => resolveDepartmentForProject(node.project) === departmentFilter
      ),
    };
  }

  const allowedModes = getAllowedCreationModes(user.role);
  const assignableIds = new Set(getAssignableUserIds(user, store.users, teams));
  const scopedAnalysts = store.users.filter(
    (a) =>
      assignableIds.has(a.id) &&
      a.is_active &&
      (a.role === "employee" || a.role === "teamlead")
  );

  const packages = await getWorkPackages();
  const workloadAlerts =
    ["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(user.role)
      ? listWorkloadAlertsForViewer(user, packages, store.users)
      : [];
  const helpFlags =
    ["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(user.role)
      ? listHelpFlagsForViewer(user, packages, store.users)
      : [];

  return (
    <>
      <PageHeader
        title="Operations Workspace"
        eyebrow="Flow Operations"
        breadcrumbs={[{ label: "Operations" }]}
        description={
          isTeamLeadRole(user.role)
            ? "Manage team boards, projects, and tasks — update status, assign work, and submit to QA."
            : viewOwnOnly
              ? "Your assigned work — update status, log time, and submit to QA."
              : "Primary operations workspace — manage projects, manufacturers, years, and work packages."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {allowedModes.length > 0 && !isReadOnly(user.role) && (
            <NewWorkWizard
              user={user}
              departments={departments}
              teams={listTeamsStore()}
              projects={store.projects.filter((p) => p.status === "active")}
              analysts={scopedAnalysts}
              managers={managers}
              forecastSettings={store.forecastSettings}
            />
          )}
          <DepartmentFilterBar departments={departments} />
        </div>
      </PageHeader>
      {workloadAlerts.length > 0 && (
        <div className="mb-6">
          <WorkloadAlertsPanel alerts={workloadAlerts} role={user.role} compact />
        </div>
      )}
      {helpFlags.length > 0 && (
        <div className="mb-6">
          <HelpFlagsPanel flags={helpFlags} role={user.role} compact />
        </div>
      )}
      <OperationsBoard
        tree={tree}
        initialSearch={searchParam?.trim() ?? ""}
        initialPackageId={packageParam?.trim() || undefined}
        initialViewId={initialViewId}
        taskFileUploads={getAllTaskFileUploads()}
        analysts={scopedAnalysts}
        currentUserId={user.id}
        teamUserIds={teamUserIds}
        canEdit={canEditWork(user.role)}
        canAssign={canAssignWork(user.role)}
        canManageProjects={hasPermission(user.role, "projects:edit")}
        canDeleteProjects={canDeleteProjects(user.role)}
        canDeleteWork={hasPermission(user.role, "work:delete")}
        canSubmitQa={canSubmitToQa(user.role)}
        canEditQa={canReviewQa(user.role)}
        readOnly={isReadOnly(user.role)}
        comments={store.comments}
        timeLogs={store.timeLogs}
        forecastSettings={store.forecastSettings}
      />
    </>
  );
}
