import { notFound, redirect } from "next/navigation";
import { TeamDashboardView } from "@/components/team-dashboards/team-dashboard-view";
import { FlowPageShell, WorkspaceContainer } from "@/components/platform";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { getManagers, getProjectsWithStats, getAnalysts } from "@/lib/data/projects";
import { getWorkPackages } from "@/lib/data/work-packages";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { buildTeamDashboardSnapshot } from "@/lib/team-dashboards/engine";
import { hydrateTeamDashboardPacks } from "@/lib/team-dashboards/hydrate";
import { getTeamDashboardPack } from "@/lib/team-dashboards/packs";
import { canAccessTeamDashboardRoute, isTeamDashboardAdmin } from "@/lib/team-dashboards/nav";
import { hydrateOperatingModels } from "@/lib/operating-models/hydrate";
import { resolveOperatingModelKpiValues } from "@/lib/operating-models/kpi-engine";
import { buildOperatingContext } from "@/lib/operating-models/resolve";
import { mergeForecastWithOperatingModel } from "@/lib/operating-models/context";
import {
  teamDashboardCreationScope,
  teamDashboardWorkProjects,
} from "@/lib/team-dashboards/work-context";
import { getActiveDepartments } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { projectOwnerCandidates } from "@/lib/work-creation/client-defaults";

export default async function TeamDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pack = getTeamDashboardPack(slug);
  if (!pack) notFound();

  await ensureAppDataLoaded();
  await hydrateTeamDashboardPacks();
  await hydrateOperatingModels();
  await hydrateForecastSettings();
  initFlowStore();
  const store = getFlowStore();

  if (!canAccessTeamDashboardRoute(user, slug, store.teams, store.users)) {
    redirect("/unauthorized");
  }

  const [projects, packages, analysts, managers] = await Promise.all([
    getProjectsWithStats(false),
    getWorkPackages(),
    getAnalysts(),
    getManagers(),
  ]);

  const snapshot = buildTeamDashboardSnapshot({
    pack,
    projects,
    packages,
    manufacturers: store.manufacturers,
    yearItems: store.yearWorkItems,
    qaReviews: store.qaReviews,
    activity: store.activity,
    forecastSettings: store.forecastSettings,
    teams: store.teams,
    users: store.users,
  });

  const departments = getActiveDepartments(
    filterDepartmentsForViewer(listDepartments(), user)
  );
  const teams = store.teams;
  const creationScope = teamDashboardCreationScope(snapshot, teams);
  const operatingContext = buildOperatingContext({
    teamId: snapshot.team?.id ?? creationScope?.teamId,
    departmentId: snapshot.team?.department_id ?? creationScope?.departmentId,
    teams,
  });
  const workProjects = teamDashboardWorkProjects(snapshot, projects, teams);
  const forecastForTeam = mergeForecastWithOperatingModel(
    store.forecastSettings,
    operatingContext.model
  );
  const operatingModelKpis = resolveOperatingModelKpiValues(
    operatingContext.model.kpis,
    snapshot.portfolioKpis,
    snapshot.avgHealthScore,
    snapshot.avgCapacityLoadPct,
    snapshot.avgCompletionPct
  );
  const workProjectIds = new Set(workProjects.map((p) => p.id));
  const scopedManufacturers = store.manufacturers.filter((m) => workProjectIds.has(m.project_id));
  const scopedYearItems = store.yearWorkItems.filter((y) => workProjectIds.has(y.project_id));
  const projectOwners = projectOwnerCandidates(managers, user);

  return (
    <FlowPageShell
      title={pack.label}
      eyebrow={pack.eyebrow ?? "Team dashboard"}
      breadcrumbs={[
        { label: "Teams", href: "/settings/team-dashboards" },
        { label: pack.label },
      ]}
      description={pack.description}
      workspace={
        <WorkspaceContainer elevated={false}>
          <TeamDashboardView
            snapshot={snapshot}
            user={user}
            teams={teams}
            workProjects={workProjects}
            managers={projectOwners}
            manufacturers={scopedManufacturers}
            yearItems={scopedYearItems}
            departments={departments}
            forecastSettings={forecastForTeam}
            qaReviews={store.qaReviews}
            activity={store.activity}
            analysts={analysts}
            creationScope={creationScope}
            operatingContext={operatingContext}
            operatingModelKpis={operatingModelKpis}
            canManageConfig={isTeamDashboardAdmin(user)}
          />
        </WorkspaceContainer>
      }
    />
  );
}
