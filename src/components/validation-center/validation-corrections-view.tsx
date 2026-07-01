"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  VALIDATION_FINDING_STATUS_LABELS,
  VALIDATION_QA_STATUS_LABELS,
  VALIDATION_SEVERITY_LABELS,
} from "@/lib/validation-center/types";
import type {
  ValidationCorrectionView,
  ValidationFindingQaStatus,
  ValidationFindingSeverity,
  ValidationFindingStatus,
} from "@/lib/validation-center/types";
import { validationPath } from "@/lib/validation-center/nav";
import { ExternalLink } from "lucide-react";

function severityVariant(severity: ValidationFindingSeverity) {
  switch (severity) {
    case "critical":
      return "destructive" as const;
    case "high":
      return "default" as const;
    case "medium":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function ValidationCorrectionsView({
  initialCorrections,
}: {
  initialCorrections: ValidationCorrectionView[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ValidationFindingStatus | "all">("all");
  const [qaStatus, setQaStatus] = useState<ValidationFindingQaStatus | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initialCorrections.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (qaStatus !== "all" && row.qa_status !== qaStatus) return false;
      if (!needle) return true;
      const hay = [
        row.title,
        row.manufacturer ?? "",
        row.task_title ?? "",
        row.task_assignee_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [initialCorrections, q, status, qaStatus]);

  if (initialCorrections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No linked correction tasks yet.{" "}
        <Link href={validationPath("/findings")} className="text-primary hover:underline">
          Review findings
        </Link>{" "}
        and create Flow tasks to track corrections here.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-1 md:col-span-1">
          <Label htmlFor="corrections-search">Search</Label>
          <Input
            id="corrections-search"
            placeholder="Finding, task, assignee…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Finding status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(VALIDATION_FINDING_STATUS_LABELS) as ValidationFindingStatus[]).map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {VALIDATION_FINDING_STATUS_LABELS[s]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>QA status</Label>
          <Select value={qaStatus} onValueChange={(v) => setQaStatus(v as typeof qaStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All QA statuses</SelectItem>
              {(Object.keys(VALIDATION_QA_STATUS_LABELS) as ValidationFindingQaStatus[]).map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {VALIDATION_QA_STATUS_LABELS[s]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2">
        {filtered.length} correction{filtered.length === 1 ? "" : "s"}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Finding</TableHead>
            <TableHead>Flow task</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Finding status</TableHead>
            <TableHead>QA</TableHead>
            <TableHead className="text-right">Task</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-xs">
                <p className="font-medium truncate">{row.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {row.manufacturer ?? "—"}
                </p>
              </TableCell>
              <TableCell className="max-w-xs">
                <p className="truncate">{row.task_title ?? "—"}</p>
                {row.task_status && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {row.task_status.replace(/_/g, " ")}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-sm">{row.task_assignee_name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={severityVariant(row.severity)} className="capitalize">
                  {VALIDATION_SEVERITY_LABELS[row.severity]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {VALIDATION_FINDING_STATUS_LABELS[row.status]}
              </TableCell>
              <TableCell className="text-sm">
                {row.qa_status ? VALIDATION_QA_STATUS_LABELS[row.qa_status] : "—"}
              </TableCell>
              <TableCell className="text-right">
                {row.work_item_id ? (
                  <Link
                    href={`/operations?package=${row.work_item_id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
