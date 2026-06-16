"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { overrideWrapUpRequirementAction } from "@/app/actions/wrap-up";
import {
  EnterpriseDataTable,
  EnterpriseTableHead,
  EnterpriseTd,
  EnterpriseTh,
} from "@/components/enterprise/enterprise-data-table";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { WrapUpStatusBadge } from "@/components/enterprise/wrap-up-status-badge";
import { DepartmentBadge } from "@/components/departments/department-badge";
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
import type { DailyWrapUpComplianceRow } from "@/types/flow";
import { ShieldCheck, Moon } from "lucide-react";

export function WrapUpCompliancePanel({
  rows,
  canOverride,
}: {
  rows: DailyWrapUpComplianceRow[];
  canOverride: boolean;
}) {
  const [overrideUserId, setOverrideUserId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) return null;

  const submitted = rows.filter((r) => r.wrapUpStatus === "submitted").length;
  const missing = rows.filter((r) => r.wrapUpStatus === "missing").length;
  const overridden = rows.filter((r) => r.wrapUpStatus === "overridden").length;
  const clockedOut = rows.filter((r) => r.clockedOutToday).length;
  const blocked = rows.filter((r) => r.blockedAttemptAt).length;

  const overrideTarget = rows.find((r) => r.userId === overrideUserId);

  return (
    <>
      <EnterpriseSection
        title="End-of-day wrap-up compliance"
        description="Hourly employees must submit today's wrap-up before clocking out for the day"
        actions={
          <Button size="sm" variant="outline" render={<Link href="/wrap-ups" />}>
            <Moon className="h-4 w-4 mr-1.5" />
            Review wrap-ups
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
          <EnterpriseKpi label="Submitted" value={submitted} />
          <EnterpriseKpi label="Missing" value={missing} warn={missing > 0} />
          <EnterpriseKpi label="Overridden" value={overridden} />
          <EnterpriseKpi label="Clocked out today" value={clockedOut} />
          <EnterpriseKpi label="Blocked attempts" value={blocked} warn={blocked > 0} />
        </div>

        <EnterpriseDataTable compact>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Employee</EnterpriseTh>
              <EnterpriseTh>Department</EnterpriseTh>
              <EnterpriseTh>Wrap-up</EnterpriseTh>
              <EnterpriseTh>Shift</EnterpriseTh>
              <EnterpriseTh>Clock out</EnterpriseTh>
              <EnterpriseTh>Override</EnterpriseTh>
              <EnterpriseTh>Actions</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="enterprise-row-hover">
                <EnterpriseTd className="font-medium">{row.userName}</EnterpriseTd>
                <EnterpriseTd>
                  <DepartmentBadge departmentId={row.departmentId} name={row.departmentName} />
                </EnterpriseTd>
                <EnterpriseTd>
                  <WrapUpStatusBadge status={row.wrapUpStatus} />
                  {row.blockedAttemptAt && row.wrapUpStatus === "missing" && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      Blocked{" "}
                      {new Date(row.blockedAttemptAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </EnterpriseTd>
                <EnterpriseTd className="text-xs text-muted-foreground">
                  {row.clockedIn ? "On shift" : "Off shift"}
                </EnterpriseTd>
                <EnterpriseTd className="text-xs text-muted-foreground">
                  {row.clockedOutToday && row.clockOutAt
                    ? new Date(row.clockOutAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </EnterpriseTd>
                <EnterpriseTd className="text-xs text-muted-foreground max-w-[160px]">
                  {row.wrapUpStatus === "overridden" ? (
                    <span title={row.overrideReason ?? undefined}>
                      {row.overriddenByName ?? "Manager"}
                      {row.overrideReason && (
                        <span className="block truncate">{row.overrideReason}</span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </EnterpriseTd>
                <EnterpriseTd>
                  {canOverride && row.wrapUpStatus === "missing" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setError(null);
                        setReason("");
                        setOverrideUserId(row.userId);
                      }}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                      Override
                    </Button>
                  )}
                </EnterpriseTd>
              </tr>
            ))}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>

      <Dialog
        open={!!overrideUserId}
        onOpenChange={(open) => {
          if (!open) {
            setOverrideUserId(null);
            setReason("");
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Override wrap-up requirement</DialogTitle>
            <DialogDescription>
              Allow {overrideTarget?.userName ?? "this employee"} to clock out without today&apos;s
              wrap-up. A reason is required and will be recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="override-reason">Override reason</Label>
            <Input
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Left early for appointment — wrap-up deferred"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideUserId(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !reason.trim()}
              onClick={() => {
                if (!overrideUserId) return;
                setError(null);
                startTransition(async () => {
                  try {
                    await overrideWrapUpRequirementAction(overrideUserId, reason);
                    setOverrideUserId(null);
                    setReason("");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Override failed");
                  }
                });
              }}
            >
              {pending ? "Saving…" : "Confirm override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
