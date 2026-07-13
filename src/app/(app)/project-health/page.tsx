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
import { getProjectEarlyWarningMap, getProjectHealthIntelligenceMap, getProjectHealthList } from "@/lib/data/project-health";
import { buildProjectMetricExportRows } from "@/lib/metrics/project-metrics-reporting";
import { projectHealthHref, projectsHref } from "@/lib/navigation/deep-links";
import { stripWorkspaceConfig } from "@/lib/projects/workspace-config";

export default async function ProjectHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; risk?: string; projectId?: string }>;
}) {
  await requirePageAccess("/project-health");
  const { search, risk, projectId } = await searchParams;
  const [projects, intelligenceByProject, earlyWarningByProject] = await Promise.all([
    getProjectHealthList(),
    getProjectHealthIntelligenceMap(),
    getProjectEarlyWarningMap(),
  ]);
  let filtered = projects;

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.project.name.toLowerCase().includes(q) ||
        stripWorkspaceConfig(p.project.description).toLowerCase().includes(q)
    );
  }

  if (projectId?.trim()) {
    filtered = filtered.filter((p) => p.project.id === projectId.trim());
  }

  if (risk === "at_risk") {
    filtered = filtered.filter((p) => {
      const ew = earlyWarningByProject[p.project.id];
      if (ew?.severity === "critical" || ew?.severity === "warning") return true;
      const intel = intelligenceByProject[p.project.id];
      if (intel) {
        return intel.riskTier === "at_risk" || intel.riskTier === "critical";
      }
      return p.overdueCount > 0 || p.blockedCount > 0;
    });
  }

  const atRisk = filtered.filter((p) => {
    const ew = earlyWarningByProject[p.project.id];
    if (ew?.severity === "critical" || ew?.severity === "warning") return true;
    const intel = intelligenceByProject[p.project.id];
    if (intel) return intel.riskTier === "at_risk" || intel.riskTier === "critical";
    return p.overdueCount > 0 || p.blockedCount > 0;
  }).length;
  const avgProgress =
    filtered.length > 0
      ? Math.round(filtered.reduce((s, p) => s + p.overallProgress, 0) / filtered.length)
      : 0;
  const totalQaIssues = filtered.reduce((s, p) => s + p.qaIssues, 0);
  const exportRows = buildProjectMetricExportRows(filtered.map((p) => p.project.id));
  const avgIntelligenceScore =
    filtered.length > 0
      ? Math.round(
          filtered.reduce(
            (s, p) => s + (intelligenceByProject[p.project.id]?.healthScore ?? 0),
            0
          ) / filtered.length
        )
      : 0;

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
            { id: "projects", label: "Active", value: filtered.length, status: "healthy", href: projectsHref(), helpKey: "activeProjects" },
            {
              id: "intelligence",
              label: "Avg health",
              value: avgIntelligenceScore,
              status: avgIntelligenceScore >= 75 ? "healthy" : "attention",
            },
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
            { id: "projects", label: "Active projects", value: filtered.length, href: projectsHref(), helpKey: "activeProjects" },
            {
              id: "intelligence",
              label: "Avg health score",
              value: avgIntelligenceScore,
              warn: avgIntelligenceScore < 75,
            },
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
          <ProjectHealthDashboard
            projects={filtered}
            highlightSearch={search?.trim()}
            highlightProjectId={projectId?.trim()}
            intelligenceByProject={intelligenceByProject}
            earlyWarningByProject={earlyWarningByProject}
          />
        </WorkspaceContainer>
      }
    />
  );
}
