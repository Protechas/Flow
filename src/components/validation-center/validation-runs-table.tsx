import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ValidationRunView } from "@/lib/validation-center/types";

function statusVariant(status: ValidationRunView["status"]) {
  switch (status) {
    case "completed":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    case "processing":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

export function ValidationRunsTable({ runs }: { runs: ValidationRunView[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No validation runs yet.{" "}
        <Link href="/validation/new" className="text-primary underline-offset-4 hover:underline">
          Start your first audit
        </Link>
        .
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Run</TableHead>
          <TableHead>Manufacturer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Compliance</TableHead>
          <TableHead className="text-right">Findings</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <Link
                href={`/validation/runs/${run.id}`}
                className="font-medium text-primary hover:underline"
              >
                {run.title ?? run.id.slice(0, 8)}
              </Link>
            </TableCell>
            <TableCell>{run.manufacturer ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={statusVariant(run.status)} className="capitalize">
                {run.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {run.compliance_rate != null ? `${run.compliance_rate}%` : "—"}
            </TableCell>
            <TableCell className="text-right">{run.findings_count ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {new Date(run.created_at).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
