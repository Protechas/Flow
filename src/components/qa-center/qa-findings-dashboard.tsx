"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setQaFindingStatusAction } from "@/app/actions/qa-engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useFlowToast } from "@/components/ui/flow-toast";
import type {
  QaEngineFinding,
  QaEngineFindingStatus,
} from "@/lib/validation-center/qa-engine-findings";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight, ClipboardPlus, EyeOff } from "lucide-react";

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-destructive/50 text-destructive",
  medium: "border-amber-500/40 text-amber-500",
  low: "border-border/60 text-muted-foreground",
};

const STATUS_LABELS: Record<QaEngineFindingStatus, string> = {
  open: "Open",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  ready_for_task: "Ready for task",
};

const STATUS_STYLES: Record<QaEngineFindingStatus, string> = {
  open: "border-blue-500/40 text-blue-400",
  reviewed: "border-emerald-500/40 text-emerald-500",
  dismissed: "border-border/60 text-muted-foreground",
  ready_for_task: "border-primary/40 text-primary",
};

const ALL = "__all__";

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="h-8 w-40 text-xs">
        <span className="truncate">
          {value === ALL ? `${label}: all` : `${label}: ${value}`}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function QaFindingsDashboard({ findings }: { findings: QaEngineFinding[] }) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [severity, setSeverity] = useState(ALL);
  const [file, setFile] = useState(ALL);
  const [sheet, setSheet] = useState(ALL);
  const [issueType, setIssueType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [expanded, setExpanded] = useState<string | null>(null);

  const uniq = (get: (f: QaEngineFinding) => string | null) =>
    [...new Set(findings.map(get).filter(Boolean) as string[])].sort();

  const filtered = useMemo(
    () =>
      findings.filter(
        (f) =>
          (severity === ALL || f.severity === severity) &&
          (file === ALL || f.source_file === file) &&
          (sheet === ALL || f.sheet_name === sheet) &&
          (issueType === ALL || f.issue_type === issueType) &&
          (status === ALL || f.status === status)
      ),
    [findings, severity, file, sheet, issueType, status]
  );

  function setFindingStatus(id: string, next: QaEngineFindingStatus) {
    startTransition(async () => {
      const res = await setQaFindingStatusAction(id, next);
      if (!res.ok) {
        toast({ variant: "error", title: "Could not update", description: res.message });
        return;
      }
      router.refresh();
    });
  }

  if (findings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No findings yet — run a scan above and results will land here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect label="Severity" value={severity} options={uniq((f) => f.severity)} onChange={setSeverity} />
        <FilterSelect label="File" value={file} options={uniq((f) => f.source_file)} onChange={setFile} />
        <FilterSelect label="Sheet" value={sheet} options={uniq((f) => f.sheet_name)} onChange={setSheet} />
        <FilterSelect label="Issue" value={issueType} options={uniq((f) => f.issue_type)} onChange={setIssueType} />
        <FilterSelect label="Status" value={status} options={uniq((f) => f.status)} onChange={setStatus} />
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {findings.length} findings
        </span>
      </div>

      <ul className="divide-y divide-border/40 rounded-xl border border-border/60">
        {filtered.map((f) => {
          const open = expanded === f.id;
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : f.id)}
                className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <Badge variant="outline" className={cn("text-[10px]", SEVERITY_STYLES[f.severity])}>
                  {f.severity}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {f.issue_type.replace(/_/g, " ")}
                </Badge>
                <span className="min-w-40 flex-1 text-sm font-medium">{f.title}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {f.source_file}
                  {f.sheet_name ? ` · ${f.sheet_name}` : ""}
                  {f.row_number ? ` · row ${f.row_number}` : ""}
                </span>
                <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLES[f.status])}>
                  {STATUS_LABELS[f.status]}
                </Badge>
              </button>
              {open && (
                <div className="space-y-2 border-t border-border/30 bg-muted/10 px-9 py-3 text-sm">
                  <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <p><span className="text-muted-foreground">Expected:</span> {f.expected ?? "—"}</p>
                    <p><span className="text-muted-foreground">Found:</span> {f.found ?? "—"}</p>
                    {f.column_name && (
                      <p><span className="text-muted-foreground">Column:</span> {f.column_name}</p>
                    )}
                    <p><span className="text-muted-foreground">Suggested assignee:</span> {f.suggested_assignee ?? "—"}</p>
                  </div>
                  {f.explanation && <p className="text-xs text-muted-foreground">{f.explanation}</p>}
                  {f.suggested_task_title && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Suggested task ({f.suggested_priority}):</span>{" "}
                      <span className="font-medium">{f.suggested_task_title}</span>
                      {f.suggested_task_description ? ` — ${f.suggested_task_description}` : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending || f.status === "reviewed"} onClick={() => setFindingStatus(f.id, "reviewed")}>
                      <Check className="h-3 w-3" />
                      Mark reviewed
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending || f.status === "ready_for_task"} onClick={() => setFindingStatus(f.id, "ready_for_task")}>
                      <ClipboardPlus className="h-3 w-3" />
                      Ready for task
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pending || f.status === "dismissed"} onClick={() => setFindingStatus(f.id, "dismissed")}>
                      <EyeOff className="h-3 w-3" />
                      Dismiss
                    </Button>
                    {f.status !== "open" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pending} onClick={() => setFindingStatus(f.id, "open")}>
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
