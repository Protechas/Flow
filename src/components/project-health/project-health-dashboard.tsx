import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ProjectHealth } from "@/types/flow";
import { AlertTriangle, Calendar, Users } from "lucide-react";

export function ProjectHealthDashboard({ projects }: { projects: ProjectHealth[] }) {
  return (
    <div className="space-y-8">
      {projects.map((ph) => (
        <Card key={ph.project.id} className="border-border/60">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{ph.project.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{ph.project.description}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-3xl font-bold tabular-nums text-primary">{ph.overallProgress}%</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Overall</p>
                </div>
                {ph.projectedCompletion && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    Est. {ph.projectedCompletion}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-sm">
              <Stat label="Hours Logged" value={`${ph.hoursLogged}h`} />
              <Stat label="Est. Remaining" value={`${ph.estimatedRemaining}h`} />
              <Stat label="QA Issues" value={ph.qaIssues} warn={ph.qaIssues > 0} />
              <Stat label="Blocked/Stuck" value={ph.blockedCount} warn={ph.blockedCount > 0} />
              <Stat label="Overdue" value={ph.overdueCount} warn={ph.overdueCount > 0} />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Assigned: {ph.assignedAnalysts.join(", ") || "None"}
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                {ph.rollup.manufacturerCount} manufacturers · {ph.rollup.yearCount} years · {ph.rollup.totalPackages} packages
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Progress by Manufacturer</p>
              <div className="space-y-3">
                {ph.manufacturerProgress.map((m) => (
                  <div key={m.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{m.name}</span>
                      <span className="text-muted-foreground tabular-nums">{m.completedPct}% · {m.packages} pkg</span>
                    </div>
                    <Progress value={m.completedPct} className="h-1.5" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/25 px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className={`font-semibold tabular-nums ${warn ? "text-amber-400" : ""}`}>
        {warn && <AlertTriangle className="inline h-3 w-3 mr-1" />}
        {value}
      </p>
    </div>
  );
}
