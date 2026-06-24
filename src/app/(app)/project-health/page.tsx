import { ProjectHealthDashboard } from "@/components/project-health/project-health-dashboard";
import { ProjectHealthExportActions } from "@/components/project-health/project-health-export-actions";
import {
  FlowPageShell,
  KpiStrip,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { getProjectHealthList } from "@/lib/data/project-health";
import { buildProjectMetricExportRows } from "@/lib/metrics/project-metrics-reporting";
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
  const exportRows = buildProjectMetricExportRows(projects.map((p) => p.project.id));

  return (
    <FlowPageShell
      title="Project Health"
      eyebrow={PLATFORM_EYEBROWS.projectHealth}
      breadcrumbs={[{ label: "Project Health" }]}
      description="Progress, hours, QA issues, and projections by project"
      headerActions={<ProjectHealthExportActions rows={exportRows} />}
      pulse={
        <OperationalPostureStrip
          signals={[
            { id: "projects", label: "Active", value: projects.length, status: "healthy", href: projectsHref(), helpKey: "activeProjects" },
            {
              id: "progress",
              label: "Avg progress",
              value: `${avgProgress}%`,
              status: avgProgress >= 70 ? "healthy" : "attention",
              helpKey: "overallProgress",
            },
            {
              id: "risk",
              label: "At risk",
              value: atRisk,
              status: atRisk > 0 ? "critical" : "healthy",
              href: projectHealthHref({ risk: "at_risk" }),
              helpKey: "projectsAtRisk",
            },
            {
              id: "qa",
              label: "QA issues",
              value: totalQaIssues,
              status: totalQaIssues > 0 ? "attention" : "healthy",
              href: "/qa-center",
              helpKey: "qaIssues",
            },
          ]}
        />
      }
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { id: "projects", label: "Active projects", value: projects.length, href: projectsHref(), helpKey: "activeProjects" },
            { id: "progress", label: "Avg progress", value: `${avgProgress}%`, helpKey: "overallProgress" },
            {
              id: "risk",
              label: "At risk",
              value: atRisk,
              warn: atRisk > 0,
              href: projectHealthHref({ risk: "at_risk" }),
              helpKey: "projectsAtRisk",
            },
            {
              id: "qa",
              label: "QA issues",
              value: totalQaIssues,
              warn: totalQaIssues > 0,
              href: "/qa-center",
              helpKey: "qaIssues",
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
