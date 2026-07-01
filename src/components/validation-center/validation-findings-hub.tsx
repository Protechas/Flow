"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { updateValidationFindingAction } from "@/app/actions/validation-center";
import { CreateTasksFromFindingsDialog } from "@/components/validation-center/create-tasks-from-findings-dialog";
import { DetailDrawer } from "@/components/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  filterFindings,
  isFindingEligibleForTask,
  listManufacturersFromFindings,
} from "@/lib/validation-center/findings-utils";
import {
  VALIDATION_FINDING_STATUS_LABELS,
  VALIDATION_ROOT_CAUSE_LABELS,
  VALIDATION_SEVERITY_LABELS,
} from "@/lib/validation-center/types";
import type {
  ValidationFinding,
  ValidationFindingSeverity,
  ValidationFindingStatus,
  ValidationRootCause,
} from "@/lib/validation-center/types";
import { validationPath } from "@/lib/validation-center/nav";
import type { Project, User } from "@/types/flow";
import { ListTodo } from "lucide-react";

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

export function ValidationFindingsHub({
  initialFindings,
  compact = false,
  runId,
  projects = [],
  analysts = [],
  canCreateTasks = false,
}: {
  initialFindings: ValidationFinding[];
  compact?: boolean;
  runId?: string;
  projects?: Project[];
  analysts?: User[];
  canCreateTasks?: boolean;
}) {
  const [findings, setFindings] = useState(initialFindings);
  const [selected, setSelected] = useState<ValidationFinding | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState<ValidationFindingSeverity | "all">("all");
  const [status, setStatus] = useState<ValidationFindingStatus | "all">("all");
  const [rootCause, setRootCause] = useState<ValidationRootCause | "all">("all");
  const [manufacturer, setManufacturer] = useState<string>("all");
  const [pending, startTransition] = useTransition();

  const manufacturers = useMemo(
    () => listManufacturersFromFindings(initialFindings),
    [initialFindings]
  );

  const filtered = useMemo(
    () =>
      filterFindings(findings, {
        q,
        severity,
        status,
        root_cause: rootCause,
        manufacturer: manufacturer === "all" ? undefined : manufacturer,
        validation_run_id: runId,
      }),
    [findings, q, severity, status, rootCause, manufacturer, runId]
  );

  const eligibleFiltered = useMemo(
    () => filtered.filter(isFindingEligibleForTask),
    [filtered]
  );

  const selectedFindings = useMemo(
    () => findings.filter((f) => selectedIds.has(f.id)),
    [findings, selectedIds]
  );

  const allEligibleSelected =
    eligibleFiltered.length > 0 &&
    eligibleFiltered.every((f) => selectedIds.has(f.id));

  function toggleFinding(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllEligible() {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(eligibleFiltered.map((f) => f.id)));
  }

  function onTasksCreated(updated: ValidationFinding[]) {
    const byId = new Map(updated.map((f) => [f.id, f]));
    setFindings((prev) => prev.map((f) => byId.get(f.id) ?? f));
    setSelectedIds(new Set());
  }

  function saveFinding(
    id: string,
    patch: Partial<Pick<ValidationFinding, "status" | "root_cause">>
  ) {
    startTransition(async () => {
      const result = await updateValidationFindingAction(id, patch);
      if (result.ok && result.finding) {
        setFindings((prev) => prev.map((f) => (f.id === id ? result.finding! : f)));
        setSelected((prev) => (prev?.id === id ? result.finding! : prev));
      }
    });
  }

  if (initialFindings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No findings yet.{" "}
        <Link href={validationPath("/new")} className="text-primary hover:underline">
          Run a validation
        </Link>{" "}
        to generate findings.
      </p>
    );
  }

  return (
    <>
      {!compact && (
        <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1 lg:col-span-2">
            <Label htmlFor="findings-search">Search</Label>
            <Input
              id="findings-search"
              placeholder="Title, manufacturer, notes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                {(Object.keys(VALIDATION_SEVERITY_LABELS) as ValidationFindingSeverity[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {VALIDATION_SEVERITY_LABELS[s]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
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
            <Label>Root cause</Label>
            <Select value={rootCause} onValueChange={(v) => setRootCause(v as typeof rootCause)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All causes</SelectItem>
                {(Object.keys(VALIDATION_ROOT_CAUSE_LABELS) as ValidationRootCause[]).map((rc) => (
                  <SelectItem key={rc} value={rc}>
                    {VALIDATION_ROOT_CAUSE_LABELS[rc]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {manufacturers.length > 0 && (
            <div className="space-y-1 md:col-span-2 lg:col-span-1">
              <Label>Manufacturer</Label>
              <Select value={manufacturer} onValueChange={(v) => setManufacturer(v ?? "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All manufacturers</SelectItem>
                  {manufacturers.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {canCreateTasks && !compact && selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} finding{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <Button size="sm" className="h-8" onClick={() => setCreateDialogOpen(true)}>
            <ListTodo className="h-3.5 w-3.5 mr-1.5" />
            Create Flow tasks
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-2">
        {filtered.length} finding{filtered.length === 1 ? "" : "s"}
        {compact ? "" : " — click a row for details"}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            {canCreateTasks && !compact && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allEligibleSelected}
                  onCheckedChange={toggleAllEligible}
                  aria-label="Select all eligible findings"
                  disabled={eligibleFiltered.length === 0}
                />
              </TableHead>
            )}
            <TableHead>Finding</TableHead>
            <TableHead>Manufacturer</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Root cause</TableHead>
            <TableHead>Status</TableHead>
            {!compact && <TableHead className="text-right">Confidence</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((finding) => (
            <TableRow
              key={finding.id}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => setSelected(finding)}
            >
              {canCreateTasks && !compact && (
                <TableCell
                  onClick={(e) => e.stopPropagation()}
                  className="w-10"
                >
                  <Checkbox
                    checked={selectedIds.has(finding.id)}
                    disabled={!isFindingEligibleForTask(finding)}
                    onCheckedChange={() => toggleFinding(finding.id)}
                    aria-label={`Select ${finding.title}`}
                  />
                </TableCell>
              )}
              <TableCell className="max-w-xs">
                <p className="font-medium truncate">{finding.title}</p>
                {finding.match_status && (
                  <p className="text-xs text-muted-foreground truncate">{finding.match_status}</p>
                )}
              </TableCell>
              <TableCell>{finding.manufacturer ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={severityVariant(finding.severity)} className="capitalize">
                  {finding.severity}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {VALIDATION_ROOT_CAUSE_LABELS[finding.root_cause]}
              </TableCell>
              <TableCell className="text-sm">
                {VALIDATION_FINDING_STATUS_LABELS[finding.status]}
              </TableCell>
              {!compact && (
                <TableCell className="text-right text-muted-foreground">
                  {finding.confidence_score}%
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DetailDrawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.title ?? "Finding"}
        description={selected?.match_status ?? undefined}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={severityVariant(selected.severity)} className="capitalize">
                {selected.severity}
              </Badge>
              <Badge variant="outline">{selected.manufacturer ?? "Unknown OEM"}</Badge>
              <Badge variant="outline">{selected.confidence_score}% confidence</Badge>
            </div>

            <div className="space-y-2">
              <Label>Root cause</Label>
              <Select
                value={selected.root_cause}
                disabled={pending}
                onValueChange={(v) =>
                  saveFinding(selected.id, { root_cause: v as ValidationRootCause })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VALIDATION_ROOT_CAUSE_LABELS) as ValidationRootCause[]).map(
                    (rc) => (
                      <SelectItem key={rc} value={rc}>
                        {VALIDATION_ROOT_CAUSE_LABELS[rc]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={selected.status}
                disabled={pending}
                onValueChange={(v) =>
                  saveFinding(selected.id, { status: v as ValidationFindingStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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

            {selected.suggested_correction && (
              <div>
                <Label className="text-muted-foreground">Suggested correction</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selected.suggested_correction}</p>
              </div>
            )}

            {Object.keys(selected.affected_record_ref).length > 0 && (
              <div>
                <Label className="text-muted-foreground">Affected record</Label>
                <dl className="mt-1 space-y-1 text-sm">
                  {Object.entries(selected.affected_record_ref).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-muted-foreground min-w-20">{key}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {selected.work_item_id && (
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link href={`/operations?package=${selected.work_item_id}`} />
                }
              >
                Open correction task
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              render={<Link href={validationPath(`/runs/${selected.validation_run_id}`)} />}
            >
              View source run
            </Button>
          </div>
        )}
      </DetailDrawer>

      {canCreateTasks && (
        <CreateTasksFromFindingsDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          findings={selectedFindings}
          projects={projects}
          analysts={analysts}
          onCreated={onTasksCreated}
        />
      )}
    </>
  );
}
