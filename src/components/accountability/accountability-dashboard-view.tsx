import Link from "next/link";
import { RankingsTable } from "@/components/performance/rankings-table";
import { PerformanceTrendChart } from "@/components/performance/performance-trend-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountabilityDashboard } from "@/types/flow";
import { AlertTriangle, Award, TrendingUp, Users, Zap } from "lucide-react";

export function AccountabilityDashboardView({
  dashboard,
}: {
  dashboard: AccountabilityDashboard;
}) {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Department avg Flow Score"
          value={dashboard.departmentAvgFlowScore}
          icon={Zap}
          highlight
        />
        <MetricCard title="Team productivity" value={dashboard.teamProductivity} icon={TrendingUp} />
        <MetricCard title="Team QA rate" value={`${dashboard.teamQaRate}%`} />
        <MetricCard
          title="Needs attention"
          value={dashboard.needsAttention.length}
          icon={AlertTriangle}
          highlight={dashboard.needsAttention.length > 0}
        />
      </div>

      {dashboard.trends30.length > 0 && (
        <PerformanceTrendChart
          data={dashboard.trends30}
          title="Department trends"
          description="30-day average Flow Score across employees"
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <HighlightList
          title="Top performers"
          icon={Award}
          items={dashboard.topPerformers.map((r) => ({
            id: r.userId,
            label: r.name,
            value: String(r.flowScore),
            href: `/people/${r.userId}`,
          }))}
        />
        <HighlightList
          title="Most improved"
          icon={TrendingUp}
          items={dashboard.mostImproved.map((r) => ({
            id: r.userId,
            label: r.name,
            value: `+${r.trendDelta}`,
            href: `/people/${r.userId}`,
          }))}
        />
        <HighlightList
          title="Most consistent"
          icon={Users}
          items={dashboard.mostConsistent.map((r) => ({
            id: r.userId,
            label: r.name,
            value: String(r.flowScore),
            href: `/people/${r.userId}`,
          }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-orange-500/25">
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.needsAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground">No critical flags</p>
            ) : (
              dashboard.needsAttention.map((e) => (
                <div key={e.userId} className="flex justify-between text-sm">
                  <Link href={`/people/${e.userId}`} className="font-medium hover:text-primary">
                    {e.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {e.reason} · {e.flowScore}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Highest correction rate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.highestCorrectionRate.map((e) => (
              <div key={e.userId} className="flex justify-between text-sm">
                <Link href={`/people/${e.userId}`} className="hover:text-primary">
                  {e.name}
                </Link>
                <span className="text-muted-foreground">
                  {e.rate}% · {e.count} corrections
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Most overdue work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.mostOverdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue assignments</p>
            ) : (
              dashboard.mostOverdue.map((e) => (
                <div key={e.userId} className="flex justify-between text-sm">
                  <Link href={`/people/${e.userId}`} className="hover:text-primary">
                    {e.name}
                  </Link>
                  <span className="text-red-400">{e.count} overdue</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Workload distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.workloadDistribution.map((e) => (
              <div key={e.userId} className="flex justify-between text-sm">
                <Link href={`/people/${e.userId}`} className="hover:text-primary">
                  {e.name}
                </Link>
                <span className="text-muted-foreground tabular-nums">
                  {e.active} active · {e.hours}h · score {e.flowScore}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Employee rankings</h2>
        <RankingsTable rankings={dashboard.rankings} />
      </section>
    </div>
  );
}

function HighlightList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { id: string; label: string; value: string; href: string }[];
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, i) => (
          <div key={item.id} className="flex justify-between text-sm">
            <Link href={item.href} className="hover:text-primary">
              <span className="text-primary font-bold mr-2">#{i + 1}</span>
              {item.label}
            </Link>
            <span className="font-semibold tabular-nums">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
