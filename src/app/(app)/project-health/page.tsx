import { ProjectHealthDashboard } from "@/components/project-health/project-health-dashboard";
import {
  FlowPageShell,
  KpiStrip,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { getProjectHealthList } from "@/lib/data/project-health";
import { operationsHref, projectHealthHref, projectsHref } from "@/lib/navigation/deep-links";

export default async function ProjectHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; risk?: string }>;
}) {
  await requirePageAccess("/project-health");
  const { search, risk } = await searchParams;
  let projects = await getProjectHealthList();

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    projects = projects.filter(
      (p) =>
        p.project.name.toLowerCase().includes(q) ||
        p.project.description?.toLowerCase().includes(q)
    );
  }

  if (risk === "at_risk") {
    projects = projects.filter((p) => p.overdueCount > 0 || p.blockedCount > 0);
  }

  const atRisk = projects.filter((p) => p.overdueCount > 0 || p.blockedCount > 0).length;
  const avgProgress =
    projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + p.overallProgress, 0) / projects.length)
      : 0;
  const totalQaIssues = projects.reduce((s, p) => s + p.qaIssues, 0);

  return (
    <FlowPageShell
      title="Project Health"
      eyebrow={PLATFORM_EYEBROWS.projectHealth}
      breadcrumbs={[{ label: "Project Health" }]}
      description="Progress, hours, QA issues, and projections by project"
      pulse={
        <OperationalPostureStrip
          signals={[
            { id: "projects", label: "Active", value: projects.length, status: "healthy", href: projectsHref() },
            {
              id: "progress",
              label: "Avg progress",
              value: `${avgProgress}%`,
              status: avgProgress >= 70 ? "healthy" : "attention",
            },
            {
              id: "risk",
              label: "At risk",
              value: atRisk,
              status: atRisk > 0 ? "critical" : "healthy",
              href: projectHealthHref({ risk: "at_risk" }),
            },
            {
              id: "qa",
              label: "QA issues",
              value: totalQaIssues,
              status: totalQaIssues > 0 ? "attention" : "healthy",
              href: "/qa-center",
            },
          ]}
        />
      }
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { id: "projects", label: "Active projects", value: projects.length, href: projectsHref() },
            { id: "progress", label: "Avg progress", value: `${avgProgress}%` },
            {
              id: "risk",
              label: "At risk",
              value: atRisk,
              warn: atRisk > 0,
              href: projectHealthHref({ risk: "at_risk" }),
            },
            {
              id: "qa",
              label: "QA issues",
              value: totalQaIssues,
              warn: totalQaIssues > 0,
              href: "/qa-center",
            },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <ProjectHealthDashboard projects={projects} highlightSearch={search?.trim()} />
        </WorkspaceContainer>
      }
    />
  );
}
