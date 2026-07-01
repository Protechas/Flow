"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { linkValidationRevalidationAction } from "@/app/actions/validation-center";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useFlowToast } from "@/components/ui/flow-toast";
import { compareValidationRuns, listComparableRunPairs } from "@/lib/validation-center/revalidation";
import type {
  ValidationFinding,
  ValidationRunView,
} from "@/lib/validation-center/types";
import { validationPath } from "@/lib/validation-center/nav";
import { ArrowRight, GitCompare } from "lucide-react";

export function ValidationCompareView({
  initialRuns,
  initialFindings,
}: {
  initialRuns: ValidationRunView[];
  initialFindings: ValidationFinding[];
}) {
  const completed = useMemo(
    () => initialRuns.filter((r) => r.status === "completed"),
    [initialRuns]
  );
  const [baselineId, setBaselineId] = useState("");
  const [followUpId, setFollowUpId] = useState("");
  const [linkedPairs, setLinkedPairs] = useState(() => listComparableRunPairs(initialRuns));
  const [pending, startTransition] = useTransition();
  const { toast } = useFlowToast();

  const comparison = useMemo(() => {
    if (!baselineId || !followUpId || baselineId === followUpId) return null;
    return compareValidationRuns(baselineId, followUpId, initialRuns, initialFindings);
  }, [baselineId, followUpId, initialRuns, initialFindings]);

  const effectiveComparison = comparison;

  function linkRevalidation() {
    if (!followUpId || !baselineId) return;
    startTransition(async () => {
      const result = await linkValidationRevalidationAction(followUpId, baselineId);
      if (!result.ok) {
        toast({ variant: "error", title: "Could not link runs", description: result.message });
        return;
      }
      toast({ variant: "success", title: "Revalidation linked" });
      setLinkedPairs((prev) => [
        {
          baselineId,
          followUpId,
          manufacturer: result.run?.manufacturer ?? null,
          improvementPct: effectiveComparison?.improvementPct ?? null,
        },
        ...prev.filter((p) => p.followUpId !== followUpId),
      ]);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
        <div className="space-y-2">
          <Label>Baseline run</Label>
          <Select value={baselineId} onValueChange={(v) => v && setBaselineId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select baseline" />
            </SelectTrigger>
            <SelectContent>
              {completed.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.manufacturer ?? r.title ?? r.id.slice(0, 8)} ·{" "}
                  {r.compliance_rate != null ? `${r.compliance_rate}%` : "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Follow-up run</Label>
          <Select value={followUpId} onValueChange={(v) => v && setFollowUpId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select follow-up" />
            </SelectTrigger>
            <SelectContent>
              {completed.map((r) => (
                <SelectItem key={r.id} value={r.id} disabled={r.id === baselineId}>
                  {r.manufacturer ?? r.title ?? r.id.slice(0, 8)} ·{" "}
                  {r.compliance_rate != null ? `${r.compliance_rate}%` : "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!baselineId || !followUpId || baselineId === followUpId || pending}
            onClick={linkRevalidation}
          >
            <GitCompare className="h-3.5 w-3.5 mr-1.5" />
            Save as revalidation
          </Button>
        </div>
      </div>

      {effectiveComparison && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href={validationPath(`/runs/${effectiveComparison.baseline.id}`)}
              className="font-medium text-primary hover:underline"
            >
              {effectiveComparison.baseline.manufacturer ?? "Baseline"}
            </Link>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Link
              href={validationPath(`/runs/${effectiveComparison.followUp.id}`)}
              className="font-medium text-primary hover:underline"
            >
              {effectiveComparison.followUp.manufacturer ?? "Follow-up"}
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <Stat
              label="Compliance change"
              value={
                effectiveComparison.complianceDelta != null
                  ? `${effectiveComparison.complianceDelta >= 0 ? "+" : ""}${effectiveComparison.complianceDelta}%`
                  : "—"
              }
              positive={(effectiveComparison.complianceDelta ?? 0) >= 0}
            />
            <Stat
              label="Improvement"
              value={
                effectiveComparison.improvementPct != null
                  ? `${effectiveComparison.improvementPct >= 0 ? "+" : ""}${effectiveComparison.improvementPct}%`
                  : "—"
              }
              positive={(effectiveComparison.improvementPct ?? 0) >= 0}
            />
            <Stat label="Resolved issues" value={effectiveComparison.resolvedCount} positive />
            <Stat label="Still open" value={effectiveComparison.stillOpenCount} warn />
            <Stat label="New issues" value={effectiveComparison.newIssuesCount} warn />
          </div>

          <CompareList title="Resolved since baseline" items={effectiveComparison.resolved} tone="good" />
          <CompareList title="Still open" items={effectiveComparison.stillOpen} tone="warn" />
          <CompareList title="New in follow-up" items={effectiveComparison.newIssues} tone="new" />
        </div>
      )}

      {linkedPairs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Linked revalidations</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Improvement</TableHead>
                <TableHead className="text-right">Compare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkedPairs.map((pair) => (
                <TableRow key={pair.followUpId}>
                  <TableCell>{pair.manufacturer ?? "—"}</TableCell>
                  <TableCell>
                    {pair.improvementPct != null ? (
                      <Badge variant={pair.improvementPct >= 0 ? "secondary" : "destructive"}>
                        {pair.improvementPct >= 0 ? "+" : ""}
                        {pair.improvementPct}%
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => {
                        setBaselineId(pair.baselineId);
                        setFollowUpId(pair.followUpId);
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  positive,
  warn,
}: {
  label: string;
  value: string | number;
  positive?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          positive ? "text-lg font-semibold text-emerald-600 dark:text-emerald-400" : warn ? "text-lg font-semibold text-amber-600 dark:text-amber-400" : "text-lg font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}

function CompareList({
  title,
  items,
  tone,
}: {
  title: string;
  items: { id: string; title: string; manufacturer: string | null }[];
  tone: "good" | "warn" | "new";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">
        {title} ({items.length})
      </p>
      <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
        {items.slice(0, 20).map((item) => (
          <li key={item.id} className="flex gap-2">
            <span
              className={
                tone === "good"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : tone === "warn"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
              }
            >
              ·
            </span>
            <span className="truncate">
              {item.title}
              {item.manufacturer ? ` · ${item.manufacturer}` : ""}
            </span>
          </li>
        ))}
        {items.length > 20 && (
          <li className="text-xs text-muted-foreground">+ {items.length - 20} more</li>
        )}
      </ul>
    </div>
  );
}
