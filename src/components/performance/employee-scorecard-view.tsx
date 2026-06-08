import Link from "next/link";
import {
  FlowScoreExplainDialog,
  ScoreExplainDialog,
} from "@/components/accountability/score-explain-dialog";
import { ActionContributions } from "@/components/performance/action-contributions";
import { FlowScoreRing } from "@/components/performance/flow-score-ring";
import { PerformanceTrendChart } from "@/components/performance/performance-trend-chart";
import { ManagerDrillDownPanel } from "@/components/scorecard/manager-drill-down-panel";
import { ScorecardMetricsGrid } from "@/components/scorecard/scorecard-metrics-grid";
import { ScorecardPeriodTrends } from "@/components/scorecard/scorecard-period-trends";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EmployeeScorecard, TeamScorecardSummary } from "@/types/flow";
import { Activity, Award, Target, ThumbsUp, Zap } from "lucide-react";

export function EmployeeScorecardView({
  scorecard,
  teamSummary,
  showManagerDrillDown = false,
  backHref,
}: {
  scorecard: EmployeeScorecard;
  teamSummary?: TeamScorecardSummary;
  showManagerDrillDown?: boolean;
  backHref?: string;
}) {
  const { user } = scorecard;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-6">
        <FlowScoreExplainDialog breakdown={scorecard.scoreBreakdown}>
          <div className="cursor-pointer hover:opacity-90 transition-opacity" title="Click to see how Flow Score is calculated">
            <FlowScoreRing score={scorecard.flowScore} size="lg" />
          </div>
        </FlowScoreExplainDialog>
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-2xl font-semibold">{user.full_name}</h2>
          <p className="text-sm text-muted-foreground capitalize">
            {user.role}
            {scorecard.managerName && ` · Manager: ${scorecard.managerName}`}
            {" · "}Rank #{scorecard.rank} of {scorecard.totalRanked}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary">{scorecard.actionPoints} action pts (7d)</Badge>
            <Badge variant="outline">{scorecard.actionPointsToday} pts today</Badge>
            <Badge variant="outline">{scorecard.velocityPerWeek} done/week</Badge>
          </div>
        </div>
        {backHref && (
          <Button variant="outline" size="sm" render={<Link href={backHref} />}>
            ← Team scorecards
          </Button>
        )}
      </div>

      <ScorecardMetricsGrid
        metrics={scorecard.metrics}
        subtitle="All-time and current-period totals from packages, time logs, and QA"
      />

      {showManagerDrillDown && teamSummary && (
        <ManagerDrillDownPanel scorecard={scorecard} teamSummary={teamSummary} />
      )}

      <ScorecardPeriodTrends
        monthly={scorecard.monthlyTrends}
        quarterly={scorecard.quarterlyTrends}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Completed Today" value={scorecard.completedToday} icon={Zap} />
        <MetricCard title="This Week" value={scorecard.completedThisWeek} />
        <MetricCard title="This Month" value={scorecard.completedThisMonth} />
        <MetricCard title="Submitted to QA" value={scorecard.submissionsToQa} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ScoreExplainDialog
          title="Productivity Score"
          score={scorecard.productivityScore}
          breakdown={scorecard.scoreBreakdown.productivity}
        >
          <MetricCard title="Productivity" value={scorecard.productivityScore} icon={Target} subtitle="40% · click for breakdown" />
        </ScoreExplainDialog>
        <ScoreExplainDialog
          title="Quality Score"
          score={scorecard.qualityScore}
          breakdown={scorecard.scoreBreakdown.quality}
        >
          <MetricCard title="Quality" value={scorecard.qualityScore} icon={ThumbsUp} subtitle="30% · click for breakdown" />
        </ScoreExplainDialog>
        <ScoreExplainDialog
          title="On-Time Score"
          score={scorecard.onTimeScore}
          breakdown={scorecard.scoreBreakdown.onTime}
        >
          <MetricCard title="On-Time" value={scorecard.onTimeScore} icon={Award} subtitle="20% · click for breakdown" />
        </ScoreExplainDialog>
        <ScoreExplainDialog
          title="Activity Score"
          score={scorecard.activityScore}
          breakdown={scorecard.scoreBreakdown.activity}
        >
          <MetricCard title="Activity" value={scorecard.activityScore} icon={Activity} subtitle="10% · click for breakdown" />
        </ScoreExplainDialog>
      </div>

      {scorecard.badges.length > 0 && (
        <Card className="border-violet-500/20">
          <CardHeader>
            <CardTitle className="text-base">Badges & achievements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {scorecard.badges.map((b) => (
              <Badge
                key={b.id}
                variant="outline"
                className={b.earned ? "border-violet-500/40 text-violet-300" : "opacity-40"}
                title={b.earned ? b.earnedReason : b.description}
              >
                {b.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PerformanceTrendChart
          data={scorecard.trend30}
          title="Last 30 days"
          description="Daily Flow Score from system activity"
        />
        <PerformanceTrendChart
          data={scorecard.trend90}
          title="Last 90 days"
          description="Quarterly performance trajectory"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActionContributions
          breakdown={scorecard.actionBreakdown}
          totalPoints={scorecard.actionPoints}
        />

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Score breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Productivity (40%)", value: scorecard.productivityScore },
              { label: "Quality (30%)", value: scorecard.qualityScore },
              { label: "On-Time (20%)", value: scorecard.onTimeScore },
              { label: "Activity (10%)", value: scorecard.activityScore },
            ].map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{s.label}</span>
                  <span className="tabular-nums">{s.value}</span>
                </div>
                <Progress value={s.value} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {scorecard.accountabilityFlags.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-base">Accountability flags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scorecard.accountabilityFlags.map((f) => (
              <div key={f.code} className="text-sm flex gap-2 items-center">
                <Badge variant="outline" className="capitalize shrink-0">
                  {f.severity}
                </Badge>
                {f.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardHeader>
          <CardTitle className="text-base">Coaching insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scorecard.coachingInsights.map((ins, i) => (
            <div key={i} className="text-sm">
              <p className="font-medium">{ins.title}</p>
              <p className="text-muted-foreground">{ins.recommendation}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Active work ({scorecard.metrics.activeWork})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scorecard.currentWork.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active packages</p>
            ) : (
              scorecard.currentWork.map((w) => (
                <div
                  key={w.id}
                  className="flex justify-between items-center py-2 border-b border-border/30 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{w.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.manufacturer?.name} · {w.year}
                    </p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {scorecard.recentActivity.map((a) => (
              <div key={a.id} className="text-sm py-2 border-b border-border/20 last:border-0">
                <p>{a.summary}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {a.type.replace("_", " ")} · {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
