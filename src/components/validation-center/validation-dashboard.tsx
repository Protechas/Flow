import Link from "next/link";
import { ClipboardCheck, FileSearch, ListChecks } from "lucide-react";
import { KpiStrip } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationEnginePicker } from "@/components/validation-center/validation-engine-picker";
import { ValidationRunsTable } from "@/components/validation-center/validation-runs-table";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import type { ValidationRunView } from "@/lib/validation-center/types";
import { validationPath } from "@/lib/validation-center/nav";

export function ValidationDashboard({
  runs,
  stats,
}: {
  runs: ValidationRunView[];
  stats: {
    libraryAccuracy: number | null;
    openFindings: number;
    criticalFindings: number;
    completedRuns: number;
    totalFindings?: number;
    revalidationImprovementPct?: number | null;
    correctionsInProgress?: number;
  };
}) {
  const recentRuns = runs.slice(0, 5);

  return (
    <>
      <ValidationSubnav />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Run validation engines, review findings, and turn audit results into tracked corrections —
          all inside Flow.
        </p>
        <Button render={<Link href={validationPath("/new")} />}>New Validation</Button>
      </div>

      <KpiStrip
        columns={4}
        items={[
          {
            label: "Library Accuracy",
            value: stats.libraryAccuracy != null ? `${stats.libraryAccuracy}%` : "—",
            sublabel: stats.completedRuns > 0 ? `${stats.completedRuns} runs` : "No runs yet",
          },
          {
            label: "Open Findings",
            value: stats.openFindings > 0 ? stats.openFindings : "—",
            sublabel: stats.totalFindings ? `${stats.totalFindings} total` : undefined,
            href: validationPath("/findings"),
          },
          {
            label: "Critical / High",
            value: stats.criticalFindings > 0 ? stats.criticalFindings : "—",
            sublabel: "Open findings",
            critical: stats.criticalFindings > 0,
            href: validationPath("/findings"),
          },
          {
            label: "Completed Runs",
            value: stats.completedRuns,
            href: validationPath("/runs"),
          },
        ]}
      />

      {(stats.revalidationImprovementPct != null || (stats.correctionsInProgress ?? 0) > 0) && (
        <KpiStrip
          className="mt-3"
          columns={2}
          items={[
            {
              label: "Revalidation Improvement",
              value:
                stats.revalidationImprovementPct != null
                  ? `${stats.revalidationImprovementPct >= 0 ? "+" : ""}${stats.revalidationImprovementPct}%`
                  : "—",
              sublabel: "Linked rerun compliance delta",
              href: validationPath("/history"),
            },
            {
              label: "Active Corrections",
              value: stats.correctionsInProgress ?? 0,
              sublabel: "Findings with open tasks",
              href: validationPath("/corrections"),
              warn: (stats.correctionsInProgress ?? 0) > 0,
            },
          ]}
        />
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              New Audit
            </CardTitle>
            <CardDescription>Upload files and run SI Library Audit</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href={validationPath("/new")} />}>
              Start validation
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-primary" />
              Review Findings
            </CardTitle>
            <CardDescription>Search, filter, and classify issues</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href={validationPath("/findings")} />}>
              Open findings
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Track Corrections
            </CardTitle>
            <CardDescription>Monitor linked Flow tasks and QA</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" render={<Link href={validationPath("/corrections")} />}>
              View corrections
            </Button>
            <Button size="sm" variant="ghost" render={<Link href={validationPath("/history")} />}>
              Compare runs
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent runs</h2>
          <Link href={validationPath("/runs")} className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <ValidationRunsTable runs={recentRuns} />
      </div>

      <div className="mt-8">
        <ValidationEnginePicker />
      </div>
    </>
  );
}
