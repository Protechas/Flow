"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteEmployeeIncidentAction,
  logEmployeeIncidentAction,
} from "@/app/actions/employee-evaluation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFlowToast } from "@/components/ui/flow-toast";
import {
  INCIDENT_CATEGORY_LABELS,
  type AutoIncident,
  type EmployeeIncident,
  type EvaluationSignals,
  type IncidentCategory,
  type IncidentSeverity,
} from "@/lib/people/employee-evaluation-types";
import { cn } from "@/lib/utils";
import { ClipboardList, Plus, Trash2, Zap } from "lucide-react";

const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  minor: "border-border/60 text-muted-foreground",
  moderate: "border-amber-500/40 text-amber-500",
  serious: "border-destructive/50 text-destructive",
};

function SignalTile({
  label,
  value,
  warnAt = 1,
}: {
  label: string;
  value: number;
  warnAt?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        value >= warnAt ? "border-amber-500/40" : "border-border/50"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-xl font-bold tabular-nums",
          value >= warnAt && "text-amber-500"
        )}
      >
        {value}
      </p>
    </div>
  );
}

type TimelineItem =
  | { kind: "auto"; incident: AutoIncident }
  | { kind: "manual"; incident: EmployeeIncident };

export function EmployeeEvaluationPanel({
  employeeId,
  signals,
  incidents,
  autoIncidents = [],
}: {
  employeeId: string;
  signals: EvaluationSignals;
  incidents: EmployeeIncident[];
  autoIncidents?: AutoIncident[];
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<IncidentCategory>("time_clock");
  const [severity, setSeverity] = useState<IncidentSeverity>("minor");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));

  function submit() {
    startTransition(async () => {
      const res = await logEmployeeIncidentAction({
        employeeId,
        category,
        severity,
        summary,
        notes: notes || undefined,
        occurredOn,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Could not log incident", description: res.message });
        return;
      }
      toast({ variant: "success", title: "Incident logged" });
      setOpen(false);
      setSummary("");
      setNotes("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteEmployeeIncidentAction(employeeId, id);
      if (!res.ok) {
        toast({ variant: "error", title: "Could not remove", description: res.message });
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="enterprise-panel p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          Evaluation — signals &amp; incident log
        </h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Log incident
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SignalTile label="Clock corrections (90d)" value={signals.clockCorrections} />
        <SignalTile label="Missed daily reports (30d)" value={signals.missedWrapUps} />
        <SignalTile label="QA corrections" value={signals.qaCorrections} />
        <SignalTile label="Auto-captured" value={autoIncidents.length} />
      </div>

      {(() => {
        const timeline: TimelineItem[] = [
          ...autoIncidents.map((incident) => ({ kind: "auto" as const, incident })),
          ...incidents.map((incident) => ({ kind: "manual" as const, incident })),
        ].sort((a, b) => b.incident.occurred_on.localeCompare(a.incident.occurred_on));

        if (timeline.length === 0) {
          return (
            <p className="text-sm text-muted-foreground">
              Nothing on record — no auto-captured events, no logged incidents. Clean slate.
            </p>
          );
        }
        return (
          <ul className="max-h-80 divide-y divide-border/40 overflow-y-auto">
            {timeline.map((item, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 py-2.5">
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", SEVERITY_STYLES[item.incident.severity])}
                >
                  {item.incident.severity}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {INCIDENT_CATEGORY_LABELS[item.incident.category]}
                </Badge>
                {item.kind === "auto" && (
                  <Badge
                    variant="outline"
                    className="gap-0.5 border-primary/40 text-[10px] text-primary"
                  >
                    <Zap className="h-2.5 w-2.5" />
                    auto
                  </Badge>
                )}
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium">{item.incident.summary}</p>
                  {item.kind === "auto" && item.incident.detail && (
                    <p className="text-xs text-muted-foreground">{item.incident.detail}</p>
                  )}
                  {item.kind === "manual" && item.incident.notes && (
                    <p className="text-xs text-muted-foreground">{item.incident.notes}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.incident.occurred_on}
                    {item.kind === "manual" &&
                      ` · logged by ${item.incident.created_by_name ?? "Unknown"}`}
                  </p>
                </div>
                {item.kind === "manual" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove incident"
                    disabled={pending}
                    onClick={() => remove(item.incident.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        );
      })()}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log an incident</DialogTitle>
            <DialogDescription>
              Recorded on this employee&apos;s evaluation history — visible to leads and managers
              only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => v && setCategory(v as IncidentCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCIDENT_CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select
                  value={severity}
                  onValueChange={(v) => v && setSeverity(v as IncidentSeverity)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="serious">Serious</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>When it happened</Label>
              <Input
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>What happened</Label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Forgot to clock in — punch added manually"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Context, follow-up agreed, coaching given…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !summary.trim()}>
              Log incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
