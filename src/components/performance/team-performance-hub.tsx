"use client";

import Link from "next/link";
import { AccountabilityDashboardView } from "@/components/accountability/accountability-dashboard-view";
import { GamificationPanel } from "@/components/accountability/gamification-panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AccountabilityReportView } from "@/components/performance/accountability-report-view";
import { CoachingReportView } from "@/components/performance/coaching-report-view";
import { PerformanceTrendChart } from "@/components/performance/performance-trend-chart";
import { RankingsTable } from "@/components/performance/rankings-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { EmployeeScorecard, TeamPerformanceDashboard } from "@/types/flow";
import { Target, Users, Zap, Activity, Shield } from "lucide-react";

export function TeamPerformanceHub({
  dashboard,
  scorecards,
}: {
  dashboard: TeamPerformanceDashboard;
  scorecards: EmployeeScorecard[];
}) {
  return (
    <Tabs defaultValue="accountability">
      <TabsList className="mb-6 flex-wrap h-auto">
        <TabsTrigger value="accountability">Accountability</TabsTrigger>
        <TabsTrigger value="coaching">Coaching</TabsTrigger>
        <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        <TabsTrigger value="overview">Overview</TabsTrigger>
      </TabsList>

      <TabsContent value="accountability">
        <AccountabilityDashboardView dashboard={dashboard.accountabilityDashboard} />
      </TabsContent>

      <TabsContent value="coaching">
        <CoachingReportView report={dashboard.coaching} />
      </TabsContent>

      <TabsContent value="leaderboard">
        <GamificationPanel scorecards={scorecards} />
      </TabsContent>

      <TabsContent value="overview">
        <OverviewTab dashboard={dashboard} />
      </TabsContent>
    </Tabs>
  );
}

function OverviewTab({ dashboard }: { dashboard: TeamPerformanceDashboard }) {
  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" render={<Link href="/people" />}>
          Employee scorecards
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Team Flow Score"
          value={dashboard.teamFlowScore}
          icon={Zap}
          highlight
          subtitle="40% prod · 30% quality · 20% on-time · 10% activity"
        />
        <MetricCard title="Team action points" value={dashboard.teamActionPoints} icon={Activity} subtitle="Last 7 days" />
        <MetricCard title="Avg QA pass" value={`${dashboard.avgQaPassRate}%`} icon={Shield} />
        <MetricCard title="Avg on-time" value={`${dashboard.avgOnTimeRate}%`} icon={Target} />
      </div>

      <PerformanceTrendChart
        data={dashboard.trends}
        title="Team performance trend"
        description="Daily average Flow Score across all employees"
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Employee rankings</h2>
        <RankingsTable rankings={dashboard.rankings} />
      </section>

      {dashboard.needsAttention.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-400" />
            Needs attention
          </h2>
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-2">
            {dashboard.needsAttention.map((e) => (
              <div key={e.userId} className="flex justify-between text-sm">
                <Link href={`/people/${e.userId}`} className="font-medium hover:text-primary">
                  {e.name}
                </Link>
                <span className="text-muted-foreground">
                  {e.reason} · Score {e.flowScore}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Accountability flags</h2>
        <AccountabilityReportView report={dashboard.accountability} />
      </section>
    </div>
  );
}
