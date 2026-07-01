"use client";

import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  VALIDATION_ROOT_CAUSE_LABELS,
} from "@/lib/validation-center/types";
import type { ValidationCenterKpis } from "@/lib/validation-center/types";
import { validationPath } from "@/lib/validation-center/nav";

export function ValidationAnalyticsView({ kpis }: { kpis: ValidationCenterKpis }) {
  const maxRootCause = Math.max(1, ...kpis.rootCauseBreakdown.map((r) => r.count));
  const maxMfgRuns = Math.max(1, ...kpis.manufacturerAccuracy.map((m) => m.runCount));

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold mb-3">Root cause breakdown</h3>
        {kpis.rootCauseBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No findings to analyze yet.</p>
        ) : (
          <div className="space-y-3">
            {kpis.rootCauseBreakdown.map((row) => (
              <div key={row.root_cause} className="space-y-1">
                <div className="flex justify-between text-sm gap-4">
                  <span>{VALIDATION_ROOT_CAUSE_LABELS[row.root_cause]}</span>
                  <span className="text-muted-foreground tabular-nums">{row.count}</span>
                </div>
                <Progress value={(row.count / maxRootCause) * 100} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Manufacturer accuracy</h3>
        {kpis.manufacturerAccuracy.length === 0 ? (
          <p className="text-sm text-muted-foreground">Complete a validation run to see OEM accuracy.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manufacturer</TableHead>
                <TableHead className="text-right">Avg compliance</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Open findings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.manufacturerAccuracy.map((row) => (
                <TableRow key={row.manufacturer}>
                  <TableCell className="font-medium">{row.manufacturer}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.avgCompliance > 0 ? `${row.avgCompliance}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.runCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.openFindings > 0 ? (
                      <Link
                        href={`${validationPath("/findings")}?manufacturer=${encodeURIComponent(row.manufacturer)}`}
                        className="text-primary hover:underline"
                      >
                        {row.openFindings}
                      </Link>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Run volume by manufacturer</h3>
        {kpis.manufacturerAccuracy.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed runs yet.</p>
        ) : (
          <div className="space-y-3">
            {kpis.manufacturerAccuracy
              .filter((m) => m.runCount > 0)
              .map((row) => (
                <div key={`vol-${row.manufacturer}`} className="space-y-1">
                  <div className="flex justify-between text-sm gap-4">
                    <span>{row.manufacturer}</span>
                    <span className="text-muted-foreground tabular-nums">{row.runCount} runs</span>
                  </div>
                  <Progress value={(row.runCount / maxMfgRuns) * 100} className="h-2" />
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3 text-sm">
        <MetricCard label="Repeat findings rate" value={kpis.repeatFindingsRate != null ? `${kpis.repeatFindingsRate}%` : "—"} />
        <MetricCard label="Revalidation improvement" value={kpis.revalidationImprovementPct != null ? `${kpis.revalidationImprovementPct >= 0 ? "+" : ""}${kpis.revalidationImprovementPct}%` : "—"} />
        <MetricCard label="QA pending on corrections" value={kpis.qaPending} />
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
    </div>
  );
}
