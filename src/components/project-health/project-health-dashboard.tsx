import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ProjectMetricDisplay } from "@/components/projects/project-metric-display";
import { ProjectHealthIntelligenceRow } from "@/components/project-health/project-health-intelligence-row";
import { PROJECT_HEALTH_STAT_HELP } from "@/lib/help/help-text";
import type { HelpTextKey } from "@/lib/help/help-text";
import { FLOW_MATERIAL } from "@/components/platform";
import type { ProgramIntelligence } from "@/lib/projects/project-intelligence";
import type { ProjectHealth } from "@/types/flow";
import { AlertTriangle, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProjectHealthDashboard({
  projects,
  highlightSearch,
  intelligenceByProject = {},
  highlightProjectId,
}: {
  projects: ProjectHealth[];
  highlightSearch?: string;
  intelligenceByProject?: Record<string, ProgramIntelligence>;
  highlightProjectId?: string;
}) {
  return (
    <div className={cn("space-y-6 p-4 sm:p-5", FLOW_MATERIAL.ambientCommand)}>
      {projects.map((ph) => {
        const atRisk = ph.overdueCount > 0 || ph.blockedCount > 0;
        const accent = atRisk ? "warning" : ph.qaIssues > 0 ? "compliance" : "healthy";

        const matchesSearch =
          !highlightSearch ||
          ph.project.name.toLowerCase().includes(highlightSearch.toLowerCase());
        const matchesProject =
          !highlightProjectId || ph.project.id === highlightProjectId;
        const intelligence = intelligenceByProject[ph.project.id];

        return (
          <article
            key={ph.project.id}
            id={`project-${ph.project.id}`}
            className={cn(
              "enterprise-panel-elevated p-5 sm:p-6 space-y-6 scroll-mt-24",
              (matchesSearch && highlightSearch) || (matchesProject && highlightProjectId)
                ? "ring-1 ring-primary/40"
                : undefined
            )}
            data-accent={accent}
          >
            {intelligence && (
              <ProjectHealthIntelligenceRow
                projectId={ph.project.id}
                projectName={ph.project.name}
                intelligence={intelligence}
              />
            )}

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight">{ph.project.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {ph.project.description}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                    {ph.overallProgress}%
                  </p>
                  <p className="enterprise-label mt-0.5 flex items-center justify-end gap-0.5">
                    Overall
                    <InfoTooltip helpKey="overallProgress" />
                  </p>
                </div>
                {ph.projectedCompletion && (
                  <Badge variant="outline" className="gap-1 rounded-full">
                    <Calendar className="h-3 w-3" />
                    Est. {ph.projectedCompletion}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
              <Stat label="Hours Logged" value={`${ph.hoursLogged}h`} />
              <Stat label="Est. Remaining" value={`${ph.estimatedRemaining}h`} />
              <Stat label="QA Issues" value={ph.qaIssues} warn={ph.qaIssues > 0} compliance={ph.qaIssues > 0} />
              <Stat label="Blocked/Stuck" value={ph.blockedCount} warn={ph.blockedCount > 0} />
              <Stat label="Overdue" value={ph.overdueCount} warn={ph.overdueCount > 0} critical={ph.overdueCount > 0} />
            </div>

            {ph.customMetrics.length > 0 && (
              <div>
                <p className="flow-section-title mb-3 flex items-center gap-1.5">
                  Performance metrics
                  <InfoTooltip helpKey="customProjectMetrics" />
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ph.customMetrics.map((metric) => (
                    <ProjectMetricDisplay key={metric.id} metric={metric} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="enterprise-label mb-2 flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                Assigned
              </p>
              <p className="text-sm text-foreground">{ph.assignedAnalysts.join(", ") || "None"}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {ph.rollup.manufacturerCount} manufacturers · {ph.rollup.yearCount} years ·{" "}
                {ph.rollup.totalPackages} packages
              </p>
            </div>

            <div>
              <p className="flow-section-title mb-3">Progress by Manufacturer</p>
              <div className="space-y-3">
                {ph.manufacturerProgress.map((m) => (
                  <div key={m.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs gap-2">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {m.completedPct}% · {m.packages} pkg
                      </span>
                    </div>
                    <Progress value={m.completedPct} className="h-1.5" />
                  </div>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
  critical,
  compliance,
  helpKey,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
  critical?: boolean;
  compliance?: boolean;
  helpKey?: HelpTextKey;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--flow-radius-card)] px-3.5 py-2.5 border border-border/50",
        "bg-muted/15",
        critical && "border-red-500/20 bg-red-500/5",
        compliance && !critical && "border-purple-500/20 bg-purple-500/5",
        warn && !critical && !compliance && "border-amber-500/20 bg-amber-500/5"
      )}
    >
      <p className="enterprise-label flex items-center gap-0.5">
        {label}
        <InfoTooltip helpKey={helpKey ?? PROJECT_HEALTH_STAT_HELP[label]} />
      </p>
      <p
        className={cn(
          "font-semibold tabular-nums mt-1",
          critical && "text-destructive",
          compliance && !critical && "text-[var(--qa)]",
          warn && !critical && !compliance && "text-warning"
        )}
      >
        {warn && <AlertTriangle className="inline h-3 w-3 mr-1 opacity-80" />}
        {value}
      </p>
    </div>
  );
}
