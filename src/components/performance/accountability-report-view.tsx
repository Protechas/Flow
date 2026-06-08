import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountabilityReport } from "@/types/flow";
import { AlertTriangle } from "lucide-react";

export function AccountabilityReportView({ report }: { report: AccountabilityReport }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="text-red-400 border-red-500/40">
          {report.criticalCount} critical
        </Badge>
        <Badge variant="outline" className="text-amber-400 border-amber-500/40">
          {report.warningCount} warnings
        </Badge>
        <span className="text-xs text-muted-foreground ml-auto">
          Generated {new Date(report.generatedAt).toLocaleString()}
        </span>
      </div>

      {report.entries.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-muted-foreground">
            No accountability flags — team is on track.
          </CardContent>
        </Card>
      ) : (
        report.entries.map((e) => (
          <Card
            key={e.userId}
            className="border-border/60 border-l-4 border-l-orange-500/50"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  <Link href={`/people/${e.userId}`} className="hover:text-violet-400">
                    {e.name}
                  </Link>
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  Flow Score <strong className="text-foreground">{e.flowScore}</strong>
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {e.flags.map((f) => (
                <div
                  key={f.code}
                  className="flex items-start gap-2 text-sm rounded-md bg-muted/30 px-3 py-2"
                >
                  <Badge
                    variant="outline"
                    className={
                      f.severity === "critical"
                        ? "text-red-400 border-red-500/30 shrink-0"
                        : f.severity === "warning"
                          ? "text-amber-400 border-amber-500/30 shrink-0"
                          : "shrink-0"
                    }
                  >
                    {f.severity}
                  </Badge>
                  <span>{f.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
