"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRoiSettingsAction } from "@/app/actions/roi";
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
import { useFlowToast } from "@/components/ui/flow-toast";
import type { FlowRoiSummary, RoiLine, RoiSettings } from "@/lib/validation-center/roi";
import { Bot, CircleDollarSign, CreditCard, Pencil } from "lucide-react";

const FIELDS: { key: keyof RoiSettings; label: string; hint: string }[] = [
  { key: "labor_rate", label: "Labor rate ($/hr)", hint: "Average hourly wage for the team" },
  {
    key: "monday_seat_cost",
    label: "Replaced subscription ($/seat/month)",
    hint: "What a Monday.com seat would cost per user per month",
  },
  {
    key: "manual_audit_hours",
    label: "Hours per manual library audit",
    hint: "Chart vs OneDrive cross-check by hand",
  },
  {
    key: "manual_validation_hours",
    label: "Hours per manual validation",
    hint: "External report or ID³ rules comparison by hand",
  },
  {
    key: "manual_scan_hours",
    label: "Hours per manual QA scan",
    hint: "Spot-checking workbooks for blanks, dups, conflicts",
  },
  {
    key: "batch_review_minutes_saved",
    label: "Minutes saved per batch review",
    hint: "Rework avoided vs end-of-package review",
  },
  {
    key: "timesheet_minutes_per_day",
    label: "Minutes saved per tracked workday",
    hint: "Timesheet entry + reconciliation the clock does automatically",
  },
  {
    key: "wrapup_minutes_saved",
    label: "Minutes saved per daily report",
    hint: "Status chasing and compiling a wrap-up replaces",
  },
  {
    key: "clock_correction_minutes",
    label: "Minutes saved per clock correction",
    hint: "In-app punch fix vs the manual back-and-forth",
  },
  {
    key: "submission_routing_minutes",
    label: "Minutes saved per routed submission",
    hint: "Coordination avoided when work routes itself to QA",
  },
];

function LinesTable({ lines }: { lines: RoiLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="py-1.5 pr-3">Automated work</th>
            <th className="py-1.5 pr-3 text-right">Count</th>
            <th className="py-1.5 pr-3 text-right">Hrs each</th>
            <th className="py-1.5 pr-3 text-right">Hours saved</th>
            <th className="py-1.5 text-right">Dollars</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.label} className="border-b border-border/50">
              <td className="py-1.5 pr-3">
                <p>{line.label}</p>
                <p className="text-[11px] text-muted-foreground">{line.basis}</p>
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{line.count}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{line.hoursEach}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{line.hoursSaved}</td>
              <td className="py-1.5 text-right tabular-nums text-emerald-400">
                ${line.dollars.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Company-wide savings: subscription + workflow + engines, all receipted. */
export function FlowRoiView({
  summary,
  canEdit,
}: {
  summary: FlowRoiSummary;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<keyof RoiSettings, string>>(() =>
    Object.fromEntries(
      FIELDS.map((f) => [f.key, String(summary.settings[f.key])])
    ) as Record<keyof RoiSettings, string>
  );

  function save() {
    startTransition(async () => {
      const res = await updateRoiSettingsAction(
        Object.fromEntries(
          FIELDS.map((f) => [f.key, Number(draft[f.key])])
        ) as Partial<RoiSettings>
      );
      if (!res.ok) {
        toast({ variant: "error", title: "Could not save", description: res.message });
        return;
      }
      toast({ variant: "success", title: "ROI assumptions saved" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit assumptions
          </Button>
        </div>
      )}

      <section className="enterprise-panel p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5 text-primary" />
          Subscription replaced — hard dollars
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Per year
            </p>
            <p className="text-2xl font-semibold text-emerald-400">
              ${summary.subscription.annual.toLocaleString()}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Per month
            </p>
            <p className="text-2xl font-semibold">
              ${summary.subscription.monthly.toLocaleString()}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Seats
            </p>
            <p className="text-2xl font-semibold">
              {summary.subscription.seats}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                × ${summary.subscription.seatCost}/mo
              </span>
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Flow replaces the per-seat project tool ({summary.subscription.seats} active
          accounts). This is recurring cash, independent of the labor math below.
        </p>
      </section>

      <section className="enterprise-panel p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
          Workflow automation — counted events
        </h2>
        <LinesTable lines={summary.workflowLines} />
      </section>

      <section className="enterprise-panel p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Bot className="h-3.5 w-3.5 text-primary" />
          Audit &amp; validation engines — counted runs
        </h2>
        <LinesTable lines={summary.engineLines} />
      </section>

      <p className="text-[11px] text-muted-foreground">
        Every line is a count Flow recorded × an editable assumption about the manual work
        it replaced × the ${summary.settings.labor_rate}/hr labor rate. No line is
        estimated from thin air — adjust the assumptions to match real timings and the
        totals follow.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ROI assumptions</DialogTitle>
            <DialogDescription>
              How long each of these takes when done by hand, and what the replaced
              subscription would cost. Totals update instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`flow-roi-${f.key}`}>{f.label}</Label>
                <Input
                  id={`flow-roi-${f.key}`}
                  type="number"
                  min={0}
                  step="0.25"
                  value={draft[f.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
