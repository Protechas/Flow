import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CoachingReport } from "@/types/flow";
import { Lightbulb } from "lucide-react";

export function CoachingReportView({ report }: { report: CoachingReport }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Team average Flow Score:{" "}
        <strong className="text-violet-400">{report.teamAverageScore}</strong>
        {" · "}
        {report.entries.length} employees
      </p>

      {report.entries.map((e) => (
        <Card key={e.userId} className="border-border/60">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                <Link href={`/people/${e.userId}`} className="hover:text-violet-400">
                  #{e.rank} {e.name}
                </Link>
              </CardTitle>
              <span className="text-2xl font-bold text-violet-400 tabular-nums">{e.flowScore}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {e.strengths.map((s) => (
                <Badge key={s} variant="secondary" className="text-emerald-400/90">
                  {s}
                </Badge>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Weaknesses</p>
                <ul className="text-sm space-y-1">
                  {e.weaknesses.map((w) => (
                    <li key={w} className="text-red-400/90">• {w}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Opportunities</p>
                <ul className="text-sm space-y-1">
                  {e.opportunities.map((o) => (
                    <li key={o} className="text-blue-400/90">• {o}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Focus areas</p>
              <ul className="text-sm space-y-1">
                {e.focusAreas.map((f) => (
                  <li key={f} className="text-amber-400/90">• {f}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              {e.insights.map((ins, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-3.5 w-3.5 text-violet-400" />
                    <span className="font-medium text-sm">{ins.title}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto capitalize">
                      {ins.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{ins.recommendation}</p>
                  {ins.metric && (
                    <p className="text-xs text-muted-foreground">{ins.metric}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
