import {
  FlowScoreExplainDialog,
  ScoreExplainDialog,
} from "@/components/accountability/score-explain-dialog";
import { FlowScoreRing } from "@/components/performance/flow-score-ring";
import { PerformanceTrendChart } from "@/components/performance/performance-trend-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmployeeDailySummaryBar } from "@/components/employee/employee-daily-summary";
import type { EmployeeDailySummary, EmployeeScorecard } from "@/types/flow";
import { Activity, Target, ThumbsUp, Award } from "lucide-react";

export function EmployeeProfileView({
  scorecard,
  dailySummary,
}: {
  scorecard: EmployeeScorecard;
  dailySummary?: EmployeeDailySummary;
}) {
  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="flow-page-title text-2xl">My performance</h1>
        <p className="flow-helper mt-1">
          Your personal progress — focused on growth, not comparison.
        </p>
      </div>

      {dailySummary && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Today&apos;s summary
          </p>
          <EmployeeDailySummaryBar summary={dailySummary} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-6 enterprise-panel-elevated p-6">
        <FlowScoreExplainDialog breakdown={scorecard.scoreBreakdown}>
          <div className="cursor-pointer hover:opacity-90 transition-opacity">
            <FlowScoreRing score={scorecard.flowScore} size="lg" />
          </div>
        </FlowScoreExplainDialog>
        <div className="text-center sm:text-left flex-1">
          <p className="text-sm text-muted-foreground">Your Flow Score</p>
          <p className="text-3xl font-bold tabular-nums">{scorecard.flowScore}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {scorecard.completedThisWeek} completed this week · {scorecard.actionPointsToday} pts today
          </p>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ScoreExplainDialog
          title="Productivity"
          score={scorecard.productivityScore}
          breakdown={scorecard.scoreBreakdown.productivity}
        >
          <MetricCard
            title="Productivity"
            value={scorecard.productivityScore}
            icon={Target}
            subtitle="Tap for breakdown"
          />
        </ScoreExplainDialog>
        <ScoreExplainDialog
          title="Quality"
          score={scorecard.qualityScore}
          breakdown={scorecard.scoreBreakdown.quality}
        >
          <MetricCard
            title="Quality"
            value={scorecard.qualityScore}
            icon={ThumbsUp}
            subtitle="Tap for breakdown"
          />
        </ScoreExplainDialog>
        <ScoreExplainDialog
          title="On-Time"
          score={scorecard.onTimeScore}
          breakdown={scorecard.scoreBreakdown.onTime}
        >
          <MetricCard
            title="On-Time"
            value={scorecard.onTimeScore}
            icon={Award}
            subtitle="Tap for breakdown"
          />
        </ScoreExplainDialog>
        <ScoreExplainDialog
          title="Activity"
          score={scorecard.activityScore}
          breakdown={scorecard.scoreBreakdown.activity}
        >
          <MetricCard
            title="Activity"
            value={scorecard.activityScore}
            icon={Activity}
            subtitle="Tap for breakdown"
          />
        </ScoreExplainDialog>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Score components</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Productivity (40%)", value: scorecard.productivityScore },
            { label: "Quality (30%)", value: scorecard.qualityScore },
            { label: "On-Time (20%)", value: scorecard.onTimeScore },
            { label: "Activity (10%)", value: scorecard.activityScore },
          ].map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{s.label}</span>
                <span className="tabular-nums font-medium">{s.value}</span>
              </div>
              <Progress value={s.value} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {scorecard.trend30.length > 0 && (
        <PerformanceTrendChart
          data={scorecard.trend30}
          title="Your 30-day trend"
          description="Daily Flow Score from your real work activity"
        />
      )}

      {scorecard.coachingInsights.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Coaching tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scorecard.coachingInsights.slice(0, 4).map((ins, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium">{ins.title}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{ins.recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
