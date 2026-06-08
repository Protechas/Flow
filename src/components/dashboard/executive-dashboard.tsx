import { MetricCard } from "@/components/dashboard/metric-card";
import { PerformanceTrendChart } from "@/components/performance/performance-trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ExecutiveMetrics } from "@/types/flow";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  TrendingUp,
  Users,
  Zap,
  Timer,
  Award,
} from "lucide-react";

export function ExecutiveDashboard({ metrics }: { metrics: ExecutiveMetrics }) {
  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" render={<Link href="/performance" />}>
          Accountability Engine
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Team Flow Score"
          value={metrics.teamFlowScore}
          icon={Zap}
          highlight
          subtitle="40% prod · 30% quality · 20% on-time · 10% activity"
        />
        <MetricCard title="Team productivity" value={metrics.teamProductivity} icon={TrendingUp} />
        <MetricCard title="Team QA rate" value={`${metrics.teamQaRate}%`} icon={Shield} />
        <MetricCard title="Overdue" value={metrics.overduePackages} icon={Clock} highlight={metrics.overduePackages > 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CommandWidget
          title="Top performer"
          icon={Award}
          name={metrics.topPerformer?.name}
          detail={metrics.topPerformer ? `Flow Score ${metrics.topPerformer.flowScore}` : "—"}
          href={metrics.topPerformer ? `/people/${metrics.topPerformer.userId}` : undefined}
        />
        <CommandWidget
          title="Most improved"
          icon={TrendingUp}
          name={metrics.mostImproved?.name}
          detail={
            metrics.mostImproved
              ? `+${metrics.mostImproved.trendDelta} trend · ${metrics.mostImproved.flowScore} score`
              : "—"
          }
          href={metrics.mostImproved ? `/people/${metrics.mostImproved.userId}` : undefined}
        />
        <CommandWidget
          title="Most at risk"
          icon={AlertTriangle}
          name={metrics.mostAtRisk?.name}
          detail={metrics.mostAtRisk?.reason ?? "—"}
          href={metrics.mostAtRisk ? `/people/${metrics.mostAtRisk.userId}` : undefined}
          warn
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active Packages" value={metrics.activePackages} icon={Timer} />
        <MetricCard title="Stuck" value={metrics.stuckPackages} icon={AlertTriangle} />
        <MetricCard title="Completed Today" value={metrics.completedToday} icon={CheckCircle2} />
        <MetricCard title="QA Pass Rate" value={`${metrics.qaPassRate}%`} icon={Shield} />
      </div>

      {metrics.departmentTrends.length > 0 && (
        <PerformanceTrendChart
          data={metrics.departmentTrends}
          title="Department trends"
          description="30-day team average Flow Score"
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Project Health Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.projectHealth.map((p) => (
              <div key={p.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground tabular-nums text-xs">
                    {p.completedPct}% · {p.overdue} overdue · {p.stuck} stuck
                  </span>
                </div>
                <Progress value={p.completedPct} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Top performers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.topPerformers.map((p, i) => (
              <div key={p.userId} className="flex justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm">
                <Link href={`/people/${p.userId}`} className="hover:text-violet-400">
                  <span className="text-violet-400 font-bold mr-2">#{i + 1}</span>
                  {p.name}
                </Link>
                <span className="font-semibold tabular-nums">{p.flowScore}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {metrics.needsAttention.length > 0 && (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-orange-400">
              <Users className="h-4 w-4" />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {metrics.needsAttention.map((e) => (
                <li key={e.userId} className="flex justify-between text-sm">
                  <Link href={`/people/${e.userId}`} className="font-medium hover:text-violet-400">
                    {e.name}
                  </Link>
                  <span className="text-muted-foreground">{e.reason}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CommandWidget({
  title,
  icon: Icon,
  name,
  detail,
  href,
  warn,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  name?: string;
  detail: string;
  href?: string;
  warn?: boolean;
}) {
  const inner = (
    <Card className={warn ? "border-orange-500/30 bg-orange-500/5" : "border-violet-500/20 bg-violet-500/5"}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-2">
          <Icon className={`h-4 w-4 ${warn ? "text-orange-400" : "text-violet-400"}`} />
          {title}
        </div>
        <p className="font-semibold text-lg">{name ?? "—"}</p>
        <p className="text-sm text-muted-foreground mt-1">{detail}</p>
      </CardContent>
    </Card>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}
