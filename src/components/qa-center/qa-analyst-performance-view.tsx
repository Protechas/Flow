import type { QaAnalystPerformanceRow } from "@/lib/qa-center/analytics/analyst-performance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function QaAnalystPerformanceView({ rows }: { rows: QaAnalystPerformanceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="enterprise-panel p-6 text-sm text-muted-foreground">
        Analyst performance metrics appear after document validations and validation findings are
        linked to assignees.
      </div>
    );
  }

  return (
    <div className="enterprise-panel overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold">Analyst performance</h3>
        <p className="text-xs text-muted-foreground">
          Pre-QA validation scores and SI library audit findings by assignee
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Analyst</TableHead>
            <TableHead className="text-right">Docs validated</TableHead>
            <TableHead className="text-right">Avg QA score</TableHead>
            <TableHead className="text-right">Pass rate</TableHead>
            <TableHead className="text-right">Open issues</TableHead>
            <TableHead className="text-right">Audit findings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.analystId}>
              <TableCell className="font-medium">{row.analystName}</TableCell>
              <TableCell className="text-right">{row.documentsValidated}</TableCell>
              <TableCell className="text-right">
                {row.avgQaScore != null ? `${row.avgQaScore}%` : "—"}
              </TableCell>
              <TableCell className="text-right">
                {row.passRate != null ? `${row.passRate}%` : "—"}
              </TableCell>
              <TableCell className="text-right">{row.openIssues || "—"}</TableCell>
              <TableCell className="text-right">{row.validationFindings || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
