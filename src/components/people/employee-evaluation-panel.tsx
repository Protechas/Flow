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
  type EmployeeIncident,
  type EvaluationSignals,
  type IncidentCategory,
  type IncidentSeverity,
} from "@/lib/people/employee-evaluation-types";
import { cn } from "@/lib/utils";
import { AlertTriangle, ClipboardList, Plus, Trash2 } from "lucide-react";

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

export function EmployeeEvaluationPanel({
  employeeId,
  signals,
  incidents,
}: {
  employeeId: string;
  signals: EvaluationSignals;
  incidents: EmployeeIncident[];
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
        <SignalTile label="Incidents logged" value={incidents.length} />
      </div>

      {signals.clockCorrectionDetails.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Recent clock corrections
          </p>
          <ul className="space-y-0.5 text-muted-foreground">
            {signals.clockCorrectionDetails.map((c, i) => (
              <li key={i}>
                {c.date} — {c.editor}: “{c.reason}”
              </li>
            ))}
          </ul>
        </div>
      )}

      {incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No incidents logged. Automatic signals above still count clock corrections, missed
          reports, and QA returns.
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {incidents.map((incident) => (
            <li key={incident.id} className="flex flex-wrap items-start gap-2 py-2.5">
              <Badge
                variant="outline"
                className={cn("text-[10px]", SEVERITY_STYLES[incident.severity])}
              >
                {incident.severity}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {INCIDENT_CATEGORY_LABELS[incident.category]}
              </Badge>
              <div className="min-w-48 flex-1">
                <p className="text-sm font-medium">{incident.summary}</p>
                {incident.notes && (
                  <p className="text-xs text-muted-foreground">{incident.notes}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {incident.occurred_on} · logged by {incident.created_by_name ?? "Unknown"}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove incident"
                disabled={pending}
                onClick={() => remove(incident.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

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
