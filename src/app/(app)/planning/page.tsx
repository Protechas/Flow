import { PlanningCenterView } from "@/components/planning/planning-center-view";
import { FlowPageShell, PLATFORM_EYEBROWS, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { getAnalysts } from "@/lib/data/projects";
import { getFlowStore, initFlowStore, listDepartments, listTeamsStore } from "@/lib/data/flow-store";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { buildPlanningCenterSnapshot } from "@/lib/planning/snapshot";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getActiveDepartments } from "@/lib/departments/filters";
import { runWorkflowChecksAction } from "@/app/actions/notifications";
import { hydrateWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";

export default async function PlanningPage() {
  const user = await requirePageAccess("/planning");
  await hydrateForecastSettings();
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  await hydrateWorkVisibilitySettings();
  await runWorkflowChecksAction();
  initFlowStore();

  const snapshot = await buildPlanningCenterSnapshot(user);
  const store = getFlowStore();
  const departments = getActiveDepartments(filterDepartmentsForViewer(listDepartments(), user));
  const branchIds = getScopeMemberIds(user, store.users, listTeamsStore());
  const analysts = await getAnalysts();
  const scopedAnalysts = branchIds?.length
    ? analysts.filter((a) => branchIds.includes(a.id))
    : analysts;

  let projects = store.projects.filter((p) => p.status === "active");
  if (branchIds?.length) {
    const projectIds = new Set(
      store.workPackages
        .filter((p) => p.assigned_to && branchIds.includes(p.assigned_to))
        .map((p) => p.project_id)
    );
    projects = projects.filter((p) => projectIds.has(p.id));
  }

  return (
    <FlowPageShell
      title="Planning & Forecasting"
      eyebrow={PLATFORM_EYEBROWS.planning}
      breadcrumbs={[{ label: "Planning & Forecasting" }]}
      description="Capacity, forecast completion, expected outcomes, and operational recommendations — integrated with live assignments and delivery data."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <PlanningCenterView
            snapshot={snapshot}
            settings={store.forecastSettings}
            departments={departments}
            projects={projects}
            analysts={scopedAnalysts.length ? scopedAnalysts : store.users.filter((u) => u.is_active)}
            workPackages={
              branchIds?.length
                ? store.workPackages.filter((p) => p.assigned_to && branchIds.includes(p.assigned_to))
                : store.workPackages
            }
            teams={listTeamsStore().map((t) => ({
              id: t.id,
              department_id: t.department_id ?? "",
            }))}
          />
        </WorkspaceContainer>
      }
    />
  );
}
