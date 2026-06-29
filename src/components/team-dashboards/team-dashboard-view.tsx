"use client";

import Link from "next/link";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ProjectPortfolioCards } from "@/components/projects/project-portfolio-cards";
import { PortfolioIntelligenceStrip } from "@/components/projects/portfolio-intelligence-strip";
import { TeamDashboardWorkBar } from "@/components/team-dashboards/team-dashboard-work-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CreationScopeOverride } from "@/lib/work-creation/client-defaults";
import type { OperatingContext } from "@/lib/operating-models/types";
import type { OperatingModelKpiValue } from "@/lib/operating-models/kpi-engine";
import { getAllowedCreationModes } from "@/lib/work-creation/permissions";
import type { TeamDashboardSnapshot } from "@/lib/team-dashboards/types";
import type {
  ActivityEvent,
  Department,
  ForecastSettings,
  Manufacturer,
  Project,
  QaReview,
  Team,
  User,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";
import { ArrowRight, Settings2 } from "lucide-react";

export function TeamDashboardView({
  snapshot,
  user,
  teams,
  workProjects,
  managers,
  manufacturers,
  yearItems,
  departments,
  forecastSettings,
  qaReviews,
  activity,
  analysts,
  creationScope,
  operatingContext,
  operatingModelKpis = [],
  canManageConfig,
}: {
  snapshot: TeamDashboardSnapshot;
  user: User;
  teams: Team[];
  workProjects: Project[];
  managers: User[];
  manufacturers: Manufacturer[];
  yearItems: YearWorkItem[];
  departments: Department[];
  forecastSettings: ForecastSettings;
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  analysts: User[];
  creationScope?: import("@/lib/work-creation/client-defaults").CreationScopeOverride;
  operatingContext?: OperatingContext;
  operatingModelKpis?: OperatingModelKpiValue[];
  canManageConfig?: boolean;
}) {
  const { pack, team, projects, packages, kpis } = snapshot;
  const canCreateTask = getAllowedCreationModes(user.role).includes("task");
  const defaultProjectId = projects[0]?.id;
  const canCreateWork = getAllowedCreationModes(user.role).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {pack.eyebrow ?? "Team dashboard"}
            </Badge>
            {team && (
              <Badge variant="secondary" className="text-[10px]">
                {team.name}
              </Badge>
            )}
            {operatingContext && (
              <Badge variant="outline" className="text-[10px]">
                {operatingContext.model.label}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{pack.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateWork && (
            <TeamDashboardWorkBar
              user={user}
              departments={departments}
              teams={teams}
              projects={workProjects}
              manufacturers={manufacturers}
              yearItems={yearItems}
              analysts={analysts}
              forecastSettings={forecastSettings}
              managers={managers}
              creationScope={creationScope}
              operatingContext={operatingContext}
              defaultProjectId={defaultProjectId}
            />
          )}
          {canManageConfig && (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/settings/team-dashboards/${pack.slug}`} />}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configure packs
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(operatingModelKpis.length > 0 ? operatingModelKpis : kpis).map((kpi) => (
          <MetricCard
            key={kpi.id}
            title={"name" in kpi ? kpi.name : kpi.label}
            value={kpi.value}
            subtitle={kpi.subtitle}
            warn={kpi.warn}
          />
        ))}
      </div>

      {projects.length > 0 && (
        <PortfolioIntelligenceStrip
          projects={projects}
          packages={packages}
          manufacturers={manufacturers}
          yearItems={yearItems}
          qaReviews={qaReviews}
          activity={activity}
          forecastSettings={forecastSettings}
          departments={departments}
        />
      )}

      {pack.showProjectPortfolio && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Programs in scope</h2>
            <span className="text-xs text-muted-foreground">{projects.length} active</span>
          </div>
          {projects.length === 0 ? (
            <div className="rounded-[var(--flow-radius-panel)] border border-dashed border-border/60 px-4 py-8 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                No programs in this team view yet. Create a program or board to get started — it
                will show here once it matches this team&apos;s scope.
              </p>
              {canCreateWork && (
                <div className="flex flex-wrap justify-center gap-2">
                  <TeamDashboardWorkBar
                    user={user}
                    departments={departments}
                    teams={teams}
                    projects={workProjects}
                    manufacturers={manufacturers}
                    yearItems={yearItems}
                    analysts={analysts}
                    forecastSettings={forecastSettings}
                    managers={managers}
                    creationScope={creationScope}
                    operatingContext={operatingContext}
                  />
                </div>
              )}
            </div>
          ) : (
            <ProjectPortfolioCards
              projects={projects}
              manufacturers={manufacturers}
              yearItems={yearItems}
              workPackages={packages}
              departments={departments}
              forecastSettings={forecastSettings}
              qaReviews={qaReviews}
              activity={activity}
              analysts={analysts}
              allProjects={projects as Project[]}
              user={user}
              canCreateTask={canCreateTask}
            />
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" render={<Link href="/project-health" />}>
          Project Health
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" render={<Link href="/planning" />}>
          Planning
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" render={<Link href="/operations" />}>
          Operations
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
