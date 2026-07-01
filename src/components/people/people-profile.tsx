import Link from "next/link";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/work-tracker/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PeopleProfile } from "@/types/flow";
import { ArrowLeft, Award, Clock, Target, ThumbsUp, Activity } from "lucide-react";

export function PeopleProfileView({ profile }: { profile: PeopleProfile }) {
  const { user } = profile;

  return (
    <div className="space-y-8">
      <Link
        href="/people"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to People
      </Link>

      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-sm bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground">
          {user.full_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-2xl font-semibold">{user.full_name}</h2>
          <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Flow Score</p>
          <p className="text-4xl font-bold text-primary tabular-nums">{profile.flowScore}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Completed Today" value={profile.completedToday} />
        <MetricCard title="This Week" value={profile.completedThisWeek} />
        <MetricCard title="This Month" value={profile.completedThisMonth} />
        <MetricCard title="Hours Logged" value={profile.hoursLogged} icon={Clock} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Productivity" value={profile.productivityScore} icon={Target} subtitle="40% weight" />
        <MetricCard title="Quality" value={profile.qualityScore} icon={ThumbsUp} subtitle="30% weight" />
        <MetricCard title="On-Time" value={profile.onTimeScore} icon={Award} subtitle="20% weight" />
        <MetricCard title="Activity" value={profile.activityScore} icon={Activity} subtitle="10% weight" />
        <MetricCard title="Avg Hrs/Package" value={profile.avgHoursPerPackage} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="QA Pass Rate" value={`${profile.qaPassRate}%`} />
        <MetricCard title="Corrections" value={profile.corrections} />
        <MetricCard title="Overdue" value={profile.overdueItems} />
        <MetricCard title="Stuck" value={profile.stuckItems} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              Current Assigned Work
              {profile.currentWork.length > 0 ? ` (${profile.currentWork.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {profile.currentWork.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active packages</p>
            ) : (
              profile.currentWork.map((w) => (
                <div key={w.id} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{w.title}</p>
                    <p className="text-xs text-muted-foreground">{w.manufacturer?.name} · {w.year}</p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Productivity (40%)", value: profile.productivityScore },
              { label: "Quality (30%)", value: profile.qualityScore },
              { label: "On-Time (20%)", value: profile.onTimeScore },
              { label: "Activity (10%)", value: profile.activityScore },
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.recentActivity.map((a) => (
              <div key={a.id} className="text-sm py-2 border-b border-border/20 last:border-0">
                <p>{a.summary}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Recent QA Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.recentQaFeedback.length === 0 ? (
              <p className="text-sm text-muted-foreground">No QA reviews yet</p>
            ) : (
              profile.recentQaFeedback.map((r) => (
                <div key={r.id} className="text-sm py-2 border-b border-border/20 last:border-0">
                  <p className="capitalize font-medium">{r.result.replace("_", " ")}</p>
                  {r.notes && <p className="text-muted-foreground">{r.notes}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
