import { OperationsBoard } from "@/components/operations/operations-board";
import { NewWorkWizard } from "@/components/work-creation/new-work-wizard";
import { DepartmentFilterBar } from "@/components/departments/department-filter-bar";
import { WorkloadAlertsPanel } from "@/components/workload-alerts/workload-alerts-panel";
import { HelpFlagsPanel } from "@/components/help-flags/help-flags-panel";
import {
  FlowPageShell,
  FilterToolbar,
  LiveActivityStream,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess, requireWorkPackageAccess } from "@/lib/auth/guard";
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
import { parseOpsViewParam, alertCenterHref } from "@/lib/navigation/deep-links";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";
import { OperationsPlanningProvider } from "@/components/operations/operations-planning-context";
import { ActivityGapsPanel } from "@/components/work-visibility/activity-gaps-panel";
import { hydrateWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";
import { listActivityGapsForViewer } from "@/lib/work-visibility/engine";
import { runWorkflowChecksAction } from "@/app/actions/notifications";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; search?: string; package?: string; taskId?: string; view?: string }>;
}) {
  const user = await requirePageAccess("/operations");
  const {
    department: deptParam,
    search: searchParam,
    package: packageParam,
    taskId: taskIdParam,
    view: viewParam,
  } = await searchParams;
  const resolvedPackageId = (packageParam ?? taskIdParam)?.trim();
  if (resolvedPackageId) {
    await requireWorkPackageAccess(resolvedPackageId, "/operations");
  }
  const initialViewId = parseOpsViewParam(viewParam);
  await hydrateForecastSettings();
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  await hydrateWorkVisibilitySettings();
  await runWorkflowChecksAction();
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

  const activityGaps =
    ["admin", "super_admin", "senior_manager", "manager", "teamlead"].includes(user.role)
      ? listActivityGapsForViewer(user, store.users)
      : [];

  let activePackages = 0;
  let inProgress = 0;
  for (const projectNode of tree.projects) {
    for (const mfrNode of projectNode.manufacturers) {
      for (const yearNode of mfrNode.years) {
        activePackages += yearNode.packages.length;
        inProgress += yearNode.packages.filter(
          (p) => p.status === "working_on_it" || p.status === "assigned"
        ).length;
      }
    }
  }
  const recentActivity = [...store.activity]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);
  const hasSignals = helpFlags.length > 0 || workloadAlerts.length > 0 || activityGaps.length > 0;

  const planningContext = {
    viewer: user,
    workPackages: packages,
    projects: store.projects.filter((p) => p.status === "active"),
    teams: teams.map((t) => ({ id: t.id, department_id: t.department_id ?? "" })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
  };

  return (
    <FlowPageShell
      title="Operations Workspace"
      eyebrow={PLATFORM_EYEBROWS.operations}
      breadcrumbs={[{ label: "Operations" }]}
      description={
        isTeamLeadRole(user.role)
          ? "Manage team boards, projects, and tasks — update status, assign work, and submit to QA."
          : viewOwnOnly
            ? "Your assigned work — update status, log time, and submit to QA."
            : "Primary operations workspace — manage projects, manufacturers, years, and work packages."
      }
      pulse={
        <OperationalPostureStrip
          signals={[
            {
              id: "active",
              label: OPS_COPY.workPackages,
              value: activePackages,
              status: inProgress > 0 ? "active" : "idle",
            },
            {
              id: "progress",
              label: OPS_COPY.inProgress,
              value: inProgress,
              status: inProgress > 0 ? "active" : "idle",
            },
            {
              id: "help",
              label: OPS_COPY.openEscalations,
              value: helpFlags.length,
              status: helpFlags.length > 0 ? "critical" : "healthy",
              href: alertCenterHref({ type: "help" }),
            },
            {
              id: "workload",
              label: OPS_COPY.availableCapacity,
              value: workloadAlerts.length,
              status: workloadAlerts.length > 0 ? "attention" : "healthy",
              href: alertCenterHref({ type: "workload" }),
            },
            {
              id: "activity_gaps",
              label: OPS_COPY.activityGap,
              value: activityGaps.length,
              status: activityGaps.length > 0 ? "attention" : "healthy",
              href: alertCenterHref({ type: "activity_gaps" }),
            },
          ]}
        />
      }
      filters={
        <FilterToolbar>
          {allowedModes.length > 0 && !isReadOnly(user.role) && (
            <NewWorkWizard
              user={user}
              departments={departments}
              teams={listTeamsStore()}
              projects={store.projects.filter((p) => p.status === "active")}
              analysts={scopedAnalysts}
              managers={managers}
              forecastSettings={store.forecastSettings}
              workPackages={store.workPackages}
            />
          )}
          <DepartmentFilterBar departments={departments} />
        </FilterToolbar>
      }
      alerts={
        workloadAlerts.length > 0 || helpFlags.length > 0 || activityGaps.length > 0 ? (
          <div className="space-y-4">
            {activityGaps.length > 0 && (
              <ActivityGapsPanel gaps={activityGaps} compact />
            )}
            {workloadAlerts.length > 0 && (
              <WorkloadAlertsPanel alerts={workloadAlerts} role={user.role} compact />
            )}
            {helpFlags.length > 0 && (
              <HelpFlagsPanel flags={helpFlags} role={user.role} compact />
            )}
          </div>
        ) : undefined
      }
      workspace={
        <OperationsPlanningProvider value={planningContext}>
          <WorkspaceContainer elevated={false} bodyClassName="space-y-6 p-0 flow-operations-workspace">
            <OperationsBoard
            tree={tree}
            initialSearch={searchParam?.trim() ?? ""}
            initialPackageId={resolvedPackageId || undefined}
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
          <LiveActivityStream
            events={recentActivity}
            title="Operations Activity"
            description="Live status changes, assignments, and QA events"
            maxItems={8}
            pulseStatus={hasSignals ? "attention" : inProgress > 0 ? "nominal" : "nominal"}
          />
        </WorkspaceContainer>
        </OperationsPlanningProvider>
      }
    />
  );
}
