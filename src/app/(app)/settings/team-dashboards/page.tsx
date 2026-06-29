import { TeamDashboardsAdmin } from "@/components/team-dashboards/team-dashboards-admin";
import { FlowPageShell, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getProjectsWithStats } from "@/lib/data/projects";
import { hydrateTeamDashboardPacks } from "@/lib/team-dashboards/hydrate";
import { listTeamDashboardPacksFromStore } from "@/lib/team-dashboards/store";
import { resolveTeamForPack, scopeProjectsForPack } from "@/lib/team-dashboards/resolve";

export default async function TeamDashboardsSettingsPage() {
  await requirePageAccess("/settings/team-dashboards");
  await ensureAppDataLoaded();
  await hydrateTeamDashboardPacks();
  initFlowStore();
  const store = getFlowStore();
  const projects = await getProjectsWithStats(false);
  const packs = listTeamDashboardPacksFromStore(false);

  const programCounts = Object.fromEntries(
    packs.map((pack) => {
      const team = resolveTeamForPack(pack, store.teams);
      const scoped = scopeProjectsForPack(pack, projects, team);
      return [pack.slug, scoped.length];
    })
  );

  return (
    <FlowPageShell
      title="Team dashboards"
      eyebrow="Build & configure"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Team dashboards" },
      ]}
      description="Create and edit custom team operating dashboards — scope, KPIs, navigation, and access — without code changes."
      workspace={
        <WorkspaceContainer elevated={false}>
          <TeamDashboardsAdmin packs={packs} programCounts={programCounts} />
        </WorkspaceContainer>
      }
    />
  );
}
