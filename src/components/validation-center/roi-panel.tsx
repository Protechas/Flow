"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
import type { RoiSettings, RoiSummary } from "@/lib/validation-center/roi";
import { DollarSign, Pencil } from "lucide-react";

const FIELDS: { key: keyof RoiSettings; label: string; hint: string }[] = [
  { key: "labor_rate", label: "Labor rate ($/hr)", hint: "Fully loaded hourly cost" },
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
];

/** Savings estimate: automation counts × the manual hours they replace. */
export function RoiPanel({ summary, canEdit }: { summary: RoiSummary; canEdit: boolean }) {
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
        ) as unknown as RoiSettings
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
    <section className="enterprise-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          Estimated savings
        </h2>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setOpen(true)}
          >
            <Pencil className="h-3 w-3" />
            Edit assumptions
          </Button>
        )}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Labor saved
          </p>
          <p className="text-2xl font-semibold text-emerald-400">
            ${summary.totalDollars.toLocaleString()}
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Production hours saved
          </p>
          <p className="text-2xl font-semibold">{summary.totalHours.toLocaleString()}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Labor rate
          </p>
          <p className="text-2xl font-semibold">${summary.settings.labor_rate}/hr</p>
        </div>
      </div>

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
            {summary.lines.map((line) => (
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
      <p className="mt-2 text-[11px] text-muted-foreground">
        Estimate = completed automated runs × the manual hours each one replaces × labor
        rate. Adjust the assumptions to match your real timings.{" "}
        <Link href="/roi" prefetch={false} className="text-primary hover:underline">
          Full company-wide ROI report →
        </Link>
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ROI assumptions</DialogTitle>
            <DialogDescription>
              How long each of these takes when done by hand. The savings math updates
              instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`roi-${f.key}`}>{f.label}</Label>
                <Input
                  id={`roi-${f.key}`}
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
    </section>
  );
}
