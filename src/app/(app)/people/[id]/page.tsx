import { PageHeader } from "@/components/layout/page-header";
import { EmployeeScorecardView } from "@/components/performance/employee-scorecard-view";
import { EmployeeMyQueue } from "@/components/employee/employee-my-queue";
import { TimeClockAdminView } from "@/components/production/time-clock-admin-view";
import { buildEmployeeMyQueue } from "@/lib/employee/queue";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { requireHierarchyUserAccess } from "@/lib/auth/guard";
import { WorkloadAlertsPanel } from "@/components/workload-alerts/workload-alerts-panel";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { listWorkloadAlertsForViewer } from "@/lib/workload-alerts/engine";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getWorkPackages, listWorkPackages } from "@/lib/data/work-packages";
import {
  getActiveTaskTimeEntry,
  getClockEntriesForUser,
  initProductionTracking,
} from "@/lib/data/production-tracking";
import { getWorkEligibility } from "@/lib/work-eligibility";
import { hasPermission } from "@/lib/auth/permissions";
import { canViewerSeeUser, getTeamMemberIds } from "@/lib/auth/team-scope";
import { isHierarchyOrgWide } from "@/lib/hierarchy/resolver";
import { getPeopleProfile, getTeamScorecardSummary } from "@/lib/data/people";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { isTimeClockMember } from "@/lib/time-clock/members";
import {
  defaultClockRecordDateRange,
  MAX_CLOCK_RECORD_RANGE_DAYS,
} from "@/lib/time-clock/record-filters";
import { EmployeeEvaluationPanel } from "@/components/people/employee-evaluation-panel";
import {
  computeAutoIncidents,
  computeEvaluationSignals,
  listEmployeeIncidents,
} from "@/lib/people/employee-evaluation";
import { notFound } from "next/navigation";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireHierarchyUserAccess(id);
  const profile = await getPeopleProfile(id);
  if (!profile) notFound();

  const permissionRole = getEffectivePermissionRole(viewer);
  const canDrillDown = hasPermission(permissionRole, "people:view_all");
  let teamSummary = canDrillDown ? await getTeamScorecardSummary() : undefined;

  initFlowStore();
  const storeUsers = getFlowStore().users;

  if (!isHierarchyOrgWide(viewer) && viewer.role !== "employee") {
    const branchIds = getTeamMemberIds(viewer, storeUsers, getFlowStore().teams);
    teamSummary = await getTeamScorecardSummary(branchIds);
  }

  const canEditPayType =
    profile.user.role === "employee" &&
    (hasPermission(permissionRole, "users:manage") ||
      (hasPermission(permissionRole, "people:view_team") &&
        canViewerSeeUser(viewer, id, storeUsers, getFlowStore().teams)));

  await hydrateWorkloadAlertSettings();
  const packages = await getWorkPackages();
  const canViewBranch = !isHierarchyOrgWide(viewer) && viewer.role !== "employee";
  const employeeAlerts =
    canViewBranch &&
    viewer.id !== id &&
    canViewerSeeUser(viewer, id, storeUsers, getFlowStore().teams)
      ? listWorkloadAlertsForViewer(viewer, packages, storeUsers).filter(
          (a) => a.employee_id === id
        )
      : [];

  const showEmployeeQueue =
    profile.user.role === "employee" &&
    viewer.id !== id &&
    (hasPermission(permissionRole, "people:view_all") ||
      (hasPermission(permissionRole, "people:view_team") &&
        canViewerSeeUser(viewer, id, storeUsers, getFlowStore().teams)));

  const employeePackages = showEmployeeQueue ? listWorkPackages({ assignedTo: id }) : [];

  const employeeQueue = showEmployeeQueue
    ? buildEmployeeMyQueue({
        packages: employeePackages,
        currentTask:
          employeePackages.find((p) => p.status === "working_on_it") ?? null,
        activeTaskTimer: getActiveTaskTimeEntry(id),
      })
    : null;

  const canViewClockHistory =
    isTimeClockMember(profile.user) &&
    viewer.id !== id &&
    (hasPermission(permissionRole, "people:view_all") ||
      hasPermission(permissionRole, "people:view_team") ||
      hasPermission(permissionRole, "work:view_team"));
  const canEditClocks = hasPermission(permissionRole, "work:assign");

  let clockEntries: ReturnType<typeof getClockEntriesForUser> = [];
  if (canViewClockHistory) {
    await ensureAppDataLoaded();
    initProductionTracking();
    clockEntries = getClockEntriesForUser(id, MAX_CLOCK_RECORD_RANGE_DAYS);
  }

  // Evaluation: leads and up, never for your own profile.
  const canEvaluate =
    profile.user.role === "employee" &&
    viewer.id !== id &&
    (hasPermission(permissionRole, "people:view_all") ||
      (hasPermission(permissionRole, "people:view_team") &&
        canViewerSeeUser(viewer, id, storeUsers, getFlowStore().teams)));
  let evaluationSignals = null;
  let incidents: Awaited<ReturnType<typeof listEmployeeIncidents>> = [];
  let autoIncidents: ReturnType<typeof computeAutoIncidents> = [];
  if (canEvaluate) {
    await ensureAppDataLoaded();
    initProductionTracking();
    evaluationSignals = computeEvaluationSignals(id);
    incidents = await listEmployeeIncidents(id);
    autoIncidents = computeAutoIncidents(id);
  }

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
      {canEvaluate && evaluationSignals && (
        <div className="mt-6">
          <EmployeeEvaluationPanel
            employeeId={id}
            signals={evaluationSignals}
            incidents={incidents}
            autoIncidents={autoIncidents}
          />
        </div>
      )}
      {canViewClockHistory && (
        <div className="mt-6">
          <TimeClockAdminView
            entries={clockEntries}
            users={[profile.user]}
            availability={[]}
            wrapUpCompliance={[]}
            canOverrideWrapUp={false}
            canEdit={canEditClocks}
            initialDateRange={defaultClockRecordDateRange()}
            initialUserFilter={id}
            variant="employee"
          />
        </div>
      )}
      {employeeAlerts.length > 0 && (
        <div className="mt-6">
          <WorkloadAlertsPanel alerts={employeeAlerts} role={viewer.role} compact />
        </div>
      )}
      {employeeQueue && (
        <div className="mt-6 max-w-2xl">
          <EmployeeMyQueue
            queue={employeeQueue}
            activeTaskTimer={getActiveTaskTimeEntry(id)}
            workEligibility={getWorkEligibility(profile.user)}
            readOnly
          />
        </div>
      )}
    </>
  );
}
