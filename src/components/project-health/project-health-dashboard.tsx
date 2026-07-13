import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ProjectMetricDisplay } from "@/components/projects/project-metric-display";
import { ProjectEarlyWarningPanel } from "@/components/project-health/project-early-warning-panel";
import { ProjectHealthIntelligenceRow } from "@/components/project-health/project-health-intelligence-row";
import { PROJECT_HEALTH_STAT_HELP } from "@/lib/help/help-text";
import type { HelpTextKey } from "@/lib/help/help-text";
import { FLOW_MATERIAL } from "@/components/platform";
import { operationsHref } from "@/lib/navigation/deep-links";
import { stripWorkspaceConfig } from "@/lib/projects/workspace-config";
import type { ProgramIntelligence } from "@/lib/projects/project-intelligence";
import type { ProjectEarlyWarning } from "@/lib/forecast/project-early-warning";
import type { ProjectHealth, ProjectHoldup, ProjectPersonPulse } from "@/types/flow";
import { AlertTriangle, Calendar, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProjectHealthDashboard({
  projects,
  highlightSearch,
  intelligenceByProject = {},
  earlyWarningByProject = {},
  highlightProjectId,
}: {
  projects: ProjectHealth[];
  highlightSearch?: string;
  intelligenceByProject?: Record<string, ProgramIntelligence>;
  earlyWarningByProject?: Record<string, ProjectEarlyWarning>;
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
        const earlyWarning = earlyWarningByProject[ph.project.id];

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
            {earlyWarning && <ProjectEarlyWarningPanel warning={earlyWarning} />}

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
                  {stripWorkspaceConfig(ph.project.description)}
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

            {ph.remaining.total > 0 && (
              <div>
                <p className="flow-section-title mb-2">What&apos;s left</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <RemainingChip label="Not started" count={ph.remaining.notStarted} />
                  <RemainingChip label="In motion" count={ph.remaining.inMotion} />
                  <RemainingChip label="Waiting / stuck" count={ph.remaining.waiting} warn />
                  <RemainingChip label="In QA" count={ph.remaining.inQa} />
                  <RemainingChip label="Corrections" count={ph.remaining.correction} warn />
                  <RemainingChip label="Done" count={ph.remaining.done} done />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {ph.rollup.manufacturerCount} manufacturers · {ph.rollup.yearCount} years ·{" "}
                  {ph.rollup.totalPackages} packages
                </p>
              </div>
            )}

            <div>
              <p className="flow-section-title mb-3 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Who&apos;s on it
              </p>
              {ph.people.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody is assigned yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {ph.people.map((person) => (
                    <PersonPulseTile key={person.userId} person={person} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="flow-section-title mb-3">What&apos;s the holdup</p>
              {ph.holdups.length === 0 ? (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Nothing is blocked — every open task is moving.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {ph.holdups.slice(0, 8).map((holdup) => (
                    <HoldupRow key={holdup.taskId} holdup={holdup} />
                  ))}
                  {ph.holdups.length > 8 && (
                    <p className="text-xs text-muted-foreground pl-1">
                      +{ph.holdups.length - 8} more — see the Operations board.
                    </p>
                  )}
                </div>
              )}
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

function RemainingChip({
  label,
  count,
  warn,
  done,
}: {
  label: string;
  count: number;
  warn?: boolean;
  done?: boolean;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1",
        warn && "border-amber-500/25 bg-amber-500/5 text-amber-600 dark:text-amber-400",
        done && "border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
      )}
    >
      <span className="font-semibold tabular-nums">{count}</span>
      {label}
    </span>
  );
}

function PersonPulseTile({ person }: { person: ProjectPersonPulse }) {
  const live = person.activeTaskIsLive;
  return (
    <div className="rounded-[var(--flow-radius-card)] border border-border/50 bg-muted/15 px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            live ? "bg-emerald-500 animate-pulse" : person.isClockedIn ? "bg-emerald-500/50" : "bg-muted-foreground/30"
          )}
          title={live ? "Timer running now" : person.isClockedIn ? "Clocked in" : "Not clocked in"}
        />
        <p className="text-sm font-medium truncate">{person.name}</p>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
          {person.doneCount}/{person.totalCount} done
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 truncate">
        {person.activeTaskTitle ? (
          <>
            {live ? "Now: " : "Working on: "}
            <Link
              href={operationsHref({ package: person.activeTaskId ?? undefined })}
              prefetch={false}
              className="text-foreground hover:underline"
            >
              {person.activeTaskTitle}
            </Link>
          </>
        ) : person.openCount > 0 ? (
          "No active task"
        ) : (
          "All assigned work done"
        )}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
        {person.openCount} open · {person.hoursLogged}h logged
      </p>
    </div>
  );
}

const HOLDUP_BADGE_STYLES: Record<ProjectHoldup["kind"], string> = {
  stuck: "border-red-500/30 text-red-500",
  correction: "border-purple-500/30 text-[var(--qa)]",
  overdue: "border-amber-500/30 text-amber-500",
  waiting: "border-border text-muted-foreground",
};

const HOLDUP_KIND_LABELS: Record<ProjectHoldup["kind"], string> = {
  stuck: "Stuck",
  correction: "Correction",
  overdue: "Overdue",
  waiting: "Waiting",
};

function HoldupRow({ holdup }: { holdup: ProjectHoldup }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/50 bg-muted/10 px-3 py-2 text-sm">
      <Badge variant="outline" className={cn("shrink-0", HOLDUP_BADGE_STYLES[holdup.kind])}>
        {HOLDUP_KIND_LABELS[holdup.kind]}
      </Badge>
      <Link
        href={operationsHref({ package: holdup.taskId })}
        prefetch={false}
        className="font-medium hover:underline truncate max-w-full"
      >
        {holdup.title}
      </Link>
      {holdup.manufacturer && (
        <span className="text-xs text-muted-foreground truncate">{holdup.manufacturer}</span>
      )}
      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground shrink-0">
        <span>{holdup.assigneeName ?? "Unassigned"}</span>
        <span className="tabular-nums">{holdup.detail}</span>
      </span>
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
