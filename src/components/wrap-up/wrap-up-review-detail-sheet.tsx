"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DepartmentBadge } from "@/components/departments/department-badge";
import { WrapUpStatusBadge } from "@/components/enterprise/wrap-up-status-badge";
import { formatMinutes } from "@/lib/production/metrics";
import { wrapUpSectionLabel } from "@/lib/wrap-up/sections";
import type { WrapUpReviewDetail } from "@/types/flow";
import { AlertTriangle, CheckCircle2, ExternalLink, Moon } from "lucide-react";

export function WrapUpReviewDetailSheet({
  detail,
  open,
  onOpenChange,
  canReview,
  pending,
  onMarkReviewed,
  onSaveNotes,
  onFlagFollowUp,
}: {
  detail: WrapUpReviewDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canReview: boolean;
  pending: boolean;
  onMarkReviewed: (notes: string) => void;
  onSaveNotes: (notes: string) => void;
  onFlagFollowUp: (needed: boolean, notes: string) => void;
}) {
  const [pendingLocal, startTransition] = useTransition();

  if (!detail) return null;

  const { wrapUp } = detail;
  const isReviewed = !!wrapUp.reviewed_at;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 mb-1">
            <Moon className="h-4 w-4 text-primary" />
            <SheetTitle className="text-left pr-8">Daily wrap-up review</SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground text-left">
            {detail.employeeName} · {wrapUp.wrap_date}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <DepartmentBadge departmentId={wrapUp.department_id} name={detail.departmentName} />
            {detail.teamName && (
              <span className="text-[11px] text-muted-foreground border rounded-sm px-2 py-0.5">
                {detail.teamName}
              </span>
            )}
            <WrapUpStatusBadge status={detail.wrapUpStatus} />
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="enterprise-panel p-4 space-y-3">
            <p className="enterprise-label">Employee responses</p>
            <div>
              <p className="text-xs text-muted-foreground mb-1">What they completed</p>
              <p className="text-sm">{wrapUp.completed_summary || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Blockers</p>
              <p className="text-sm">{wrapUp.blockers || "None reported"}</p>
            </div>
            {wrapUp.sections &&
              Object.entries(wrapUp.sections).map(([id, value]) => (
                <div key={id}>
                  <p className="text-xs text-muted-foreground mb-1">{wrapUpSectionLabel(id)}</p>
                  <p className="text-sm whitespace-pre-wrap">{value}</p>
                </div>
              ))}
            {wrapUp.needs_support && (
              <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Manager support requested
                </p>
                <p className="text-sm mt-1">{wrapUp.needs_support_note || "—"}</p>
              </div>
            )}
            <p className="flow-meta">
              Submitted {new Date(wrapUp.created_at).toLocaleString()}
            </p>
          </section>

          <section className="space-y-2">
            <p className="enterprise-label">Timeclock summary</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="enterprise-panel px-3 py-2">
                <p className="text-xs text-muted-foreground">Shift time</p>
                <p className="font-semibold">{formatMinutes(detail.shiftMinutesToday)}</p>
              </div>
              <div className="enterprise-panel px-3 py-2">
                <p className="text-xs text-muted-foreground">Clock out</p>
                <p className="font-semibold capitalize">{detail.clockOutStatus.replace("_", " ")}</p>
              </div>
            </div>
            {detail.clockEntries.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {detail.clockEntries.map((e) => (
                  <li key={e.id}>
                    {new Date(e.clock_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {e.clock_out_at && (
                      <> → {new Date(e.clock_out_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</>
                    )}
                    {e.clock_out_type && ` (${e.clock_out_type})`}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <p className="enterprise-label">Tasks completed that day</p>
            {detail.tasksCompleted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks marked complete on this date.</p>
            ) : (
              <ul className="space-y-1">
                {detail.tasksCompleted.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/operations?package=${t.id}`}
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {t.title}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canReview && (
            <section className="space-y-3 border-t border-border pt-4">
              <p className="enterprise-label">Leader review</p>
              {isReviewed && (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Reviewed by {detail.reviewedByName}{" "}
                  {wrapUp.reviewed_at && new Date(wrapUp.reviewed_at).toLocaleString()}
                </p>
              )}
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const notes = String(fd.get("internal_notes") ?? "");
                  startTransition(() => onSaveNotes(notes));
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="internal_notes">Internal notes</Label>
                  <Textarea
                    id="internal_notes"
                    name="internal_notes"
                    rows={3}
                    defaultValue={wrapUp.internal_notes ?? ""}
                    placeholder="Private notes for managers and team leads…"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" variant="outline" disabled={pending || pendingLocal}>
                    Save notes
                  </Button>
                  {!isReviewed && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || pendingLocal}
                      onClick={() => {
                        const notes = (
                          document.getElementById("internal_notes") as HTMLTextAreaElement | null
                        )?.value;
                        startTransition(() => onMarkReviewed(notes ?? ""));
                      }}
                    >
                      Mark as reviewed
                    </Button>
                  )}
                </div>
              </form>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    defaultChecked={wrapUp.follow_up_needed}
                    onCheckedChange={(v) => {
                      const notes = (
                        document.getElementById("follow_up_notes") as HTMLTextAreaElement | null
                      )?.value;
                      startTransition(() => onFlagFollowUp(!!v, notes ?? ""));
                    }}
                  />
                  Flag follow-up needed
                </label>
                <Textarea
                  id="follow_up_notes"
                  rows={2}
                  defaultValue={wrapUp.follow_up_notes ?? ""}
                  placeholder="Follow-up details for the team…"
                />
              </div>
              {wrapUp.follow_up_needed && (
                <Button size="sm" variant="outline" render={<Link href="/operations" />}>
                  Assign follow-up in Operations
                </Button>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
