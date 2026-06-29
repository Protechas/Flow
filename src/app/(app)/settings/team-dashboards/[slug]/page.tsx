import { notFound } from "next/navigation";
import { TeamDashboardBuilder } from "@/components/team-dashboards/team-dashboard-builder";
import { FlowPageShell, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getProjects } from "@/lib/data/projects";
import { packToFormInput } from "@/lib/team-dashboards/form";
import { hydrateTeamDashboardPacks } from "@/lib/team-dashboards/hydrate";
import { getTeamDashboardPackFromStore } from "@/lib/team-dashboards/store";

export default async function EditTeamDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePageAccess("/settings/team-dashboards");
  const { slug } = await params;
  await ensureAppDataLoaded();
  await hydrateTeamDashboardPacks();
  initFlowStore();
  const store = getFlowStore();
  const pack = getTeamDashboardPackFromStore(slug);
  if (!pack) notFound();

  const projects = await getProjects();

  return (
    <FlowPageShell
      title={`Edit ${pack.label}`}
      eyebrow="Build"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Team dashboards", href: "/settings/team-dashboards" },
        { label: pack.label },
      ]}
      workspace={
        <WorkspaceContainer elevated={false}>
          <TeamDashboardBuilder
            mode="edit"
            initial={packToFormInput(pack)}
            teams={store.teams}
            projects={projects}
          />
        </WorkspaceContainer>
      }
    />
  );
}
