import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectValidationMetrics } from "@/lib/validation-center/types";
import { ClipboardCheck } from "lucide-react";

export function ProjectValidationPanel({
  metrics,
  canViewValidation,
}: {
  metrics: ProjectValidationMetrics;
  canViewValidation: boolean;
}) {
  if (!canViewValidation) return null;

  const hasActivity =
    metrics.linkedRuns > 0 ||
    metrics.openFindings > 0 ||
    metrics.correctionsInProgress > 0;

  if (!hasActivity) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Validation
          </CardTitle>
          <CardDescription>
            No validation findings linked to this project yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" render={<Link href="/validation" />}>
            Open Validation Center
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Validation
            </CardTitle>
            <CardDescription>
              Findings and corrections linked through Flow tasks on this project.
            </CardDescription>
          </div>
          {metrics.avgCompliance != null && (
            <Badge variant="secondary" className="tabular-nums shrink-0">
              {metrics.avgCompliance}% avg compliance
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Metric label="Linked runs" value={metrics.linkedRuns} />
          <Metric label="Open findings" value={metrics.openFindings} warn={metrics.openFindings > 0} />
          <Metric label="Corrections active" value={metrics.correctionsInProgress} warn={metrics.correctionsInProgress > 0} />
          <Metric label="QA pending" value={metrics.qaPending} warn={metrics.qaPending > 0} />
        </div>
        {metrics.lastRunDate && (
          <p className="text-xs text-muted-foreground">
            Last related run: {new Date(metrics.lastRunDate).toLocaleString()}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" render={<Link href="/validation/findings" />}>
            View findings
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/validation/corrections" />}>
            Corrections
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${warn ? "text-amber-600 dark:text-amber-400" : ""}`}>
        {value}
      </p>
    </div>
  );
}
