"use client";

import Link from "next/link";
import { DueDateStatusBadge } from "@/components/forecast/due-date-status-badge";
import { Badge } from "@/components/ui/badge";
import { formatForecastHours } from "@/lib/forecast/engine";
import { ProgramHealthBadge } from "@/components/projects/program-health-badge";
import { ProjectNextActionBadge } from "@/components/projects/project-next-action-badge";
import { BoardTrackingBadges } from "@/components/projects/board-tracking-badges";
import {
  buildProgramIntelligence,
  type ProgramRiskTier,
} from "@/lib/projects/project-intelligence";
import { getProjectHierarchyLabels } from "@/lib/projects/hierarchy-labels";
import { structureCountSummary } from "@/lib/projects/hierarchy-display";
import {
  departmentLabel,
  formatProjectType,
  getProjectNextAction,
  type ProjectWithStats,
} from "@/lib/projects/portfolio-utils";
import { cn } from "@/lib/utils";
import type {
  ActivityEvent,
  Department,
  ForecastSettings,
  Manufacturer,
  Project,
  QaReview,
  User,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";
import { ProjectPortfolioQuickActions } from "@/components/projects/project-portfolio-quick-actions";
import { ArrowRight, Factory } from "lucide-react";

const TIER_BORDER: Record<ProgramRiskTier, string> = {
  critical: "border-l-red-400",
  at_risk: "border-l-amber-400",
  watch: "border-l-sky-400",
  healthy: "border-l-emerald-400",
};

function nextActionClass(tone: ReturnType<typeof getProjectNextAction>["tone"]) {
  switch (tone) {
    case "danger":
      return "text-red-400 border-red-500/30 bg-red-500/10";
    case "warn":
      return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "success":
      return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    default:
      return "text-muted-foreground border-border/50 bg-muted/20";
  }
}

interface ProjectPortfolioCardsProps {
  projects: ProjectWithStats[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  workPackages: WorkPackage[];
  departments: Department[];
  forecastSettings: ForecastSettings;
  qaReviews?: QaReview[];
  activity?: ActivityEvent[];
  onSelectProject?: (projectId: string) => void;
  user?: User;
  allProjects?: Project[];
  analysts?: User[];
  canCreateTask?: boolean;
}

export function ProjectPortfolioCards({
  projects,
  manufacturers,
  yearItems,
  workPackages,
  departments,
  forecastSettings,
  qaReviews = [],
  activity = [],
  onSelectProject,
  user,
  allProjects,
  analysts = [],
  canCreateTask = false,
}: ProjectPortfolioCardsProps) {
  const taskProjects = allProjects ?? projects;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const archived = project.status === "archived";
        const mfrs = manufacturers.filter((m) => m.project_id === project.id && !m.is_archived);
        const projPackages = workPackages.filter((p) => p.project_id === project.id);
        const openTasks = projPackages.filter((p) => p.status !== "done").length;
        const labels = getProjectHierarchyLabels(project);
        const nextAction = getProjectNextAction(project, manufacturers, yearItems, workPackages);
        const primaryDue =
          project.active_project_due_date ??
          project.manual_project_due_date ??
          project.due_date ??
          project.suggested_project_due_date ??
          "—";
        const yearCount = yearItems.filter((y) => y.project_id === project.id).length;
        const structureLine = structureCountSummary(labels, {
          workstreams: mfrs.length,
          phases: yearCount,
          tasks: projPackages.length,
        });
        const intel = buildProgramIntelligence(
          project,
          workPackages,
          manufacturers,
          yearItems,
          qaReviews,
          activity,
          forecastSettings
        );

        return (
          <article
            key={project.id}
            className={cn(
              "enterprise-panel flex flex-col overflow-hidden transition-shadow hover:shadow-md border-l-2",
              TIER_BORDER[intel.riskTier],
              archived && "opacity-85"
            )}
          >
            <div className="p-4 flex-1 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-base font-semibold hover:text-primary line-clamp-2"
                  >
                    {project.name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {departmentLabel(project, departments)} · {formatProjectType(project.project_type)}
                  </p>
                </div>
                {archived && (
                  <Badge variant="outline" className="shrink-0">
                    Archived
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ProgramHealthBadge score={intel.healthScore} tier={intel.riskTier} compact />
                <BoardTrackingBadges project={project} />
                <DueDateStatusBadge status={project.project_due_date_status} />
                {!archived && user && forecastSettings ? (
                  <ProjectNextActionBadge
                    action={nextAction}
                    project={project}
                    projects={taskProjects}
                    manufacturers={manufacturers}
                    yearItems={yearItems}
                    analysts={analysts}
                    forecastSettings={forecastSettings}
                    user={user}
                  />
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium",
                      nextActionClass(nextAction.tone)
                    )}
                  >
                    Next: {nextAction.label}
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Progress</dt>
                  <dd className="font-medium tabular-nums">{project.completedPct}%</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Open tasks</dt>
                  <dd className="font-medium tabular-nums">{openTasks}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Primary due</dt>
                  <dd className="font-medium">{primaryDue}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Est. hours</dt>
                  <dd className="font-medium">{formatForecastHours(project.estimated_total_hours)}</dd>
                </div>
              </dl>

              <p className="text-[11px] text-muted-foreground line-clamp-2">{intel.primaryInsight}</p>

              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Factory className="h-3 w-3 shrink-0" />
                {structureLine}
              </p>
            </div>

            <footer className="border-t border-border/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-muted/10">
              <div className="flex items-center gap-3 min-w-0">
                {onSelectProject && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                    onClick={() => onSelectProject(project.id)}
                  >
                    View structure
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {!archived && (
                  <ProjectPortfolioQuickActions
                    project={project}
                    user={user}
                    projects={taskProjects}
                    manufacturers={manufacturers}
                    yearItems={yearItems}
                    analysts={analysts}
                    forecastSettings={forecastSettings}
                    canCreateTask={canCreateTask}
                    compact
                  />
                )}
                <Link
                  href={`/projects/${project.id}`}
                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open program
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
