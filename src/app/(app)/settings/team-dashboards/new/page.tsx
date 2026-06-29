import { TeamDashboardBuilder } from "@/components/team-dashboards/team-dashboard-builder";
import { FlowPageShell, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getProjects } from "@/lib/data/projects";
import { EMPTY_TEAM_DASHBOARD_INPUT } from "@/lib/team-dashboards/form";
import { hydrateTeamDashboardPacks } from "@/lib/team-dashboards/hydrate";

export default async function NewTeamDashboardPage() {
  await requirePageAccess("/settings/team-dashboards");
  await ensureAppDataLoaded();
  await hydrateTeamDashboardPacks();
  initFlowStore();
  const store = getFlowStore();
  const projects = await getProjects();

  return (
    <FlowPageShell
      title="New team dashboard"
      eyebrow="Build"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Team dashboards", href: "/settings/team-dashboards" },
        { label: "New" },
      ]}
      workspace={
        <WorkspaceContainer elevated={false}>
          <TeamDashboardBuilder
            mode="create"
            initial={EMPTY_TEAM_DASHBOARD_INPUT}
            teams={store.teams}
            projects={projects}
          />
        </WorkspaceContainer>
      }
    />
  );
}
