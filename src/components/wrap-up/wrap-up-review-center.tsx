"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  flagWrapUpFollowUpAction,
  markWrapUpReviewedAction,
  updateWrapUpReviewNotesAction,
} from "@/app/actions/wrap-up-review";
import { DepartmentBadge } from "@/components/departments/department-badge";
import {
  EnterpriseDataTable,
  EnterpriseTableHead,
  EnterpriseTd,
  EnterpriseTh,
} from "@/components/enterprise/enterprise-data-table";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { WrapUpStatusBadge } from "@/components/enterprise/wrap-up-status-badge";
import { WrapUpReviewDetailSheet } from "@/components/wrap-up/wrap-up-review-detail-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportWrapUpRowsCsv } from "@/lib/wrap-up/export-csv";
import type {
  Department,
  Team,
  User,
  WrapUpReviewDashboardStats,
  WrapUpReviewDetail,
  WrapUpReviewRow,
} from "@/types/flow";
import { Download } from "lucide-react";

const CLOCK_LABELS = {
  clocked_out: "Clocked out",
  on_shift: "On shift",
  not_clocked: "Not clocked",
} as const;

export function WrapUpReviewCenter({
  rows,
  stats,
  departments,
  teams,
  employees,
  detail,
  canReview,
  selectedId,
}: {
  rows: WrapUpReviewRow[];
  stats: WrapUpReviewDashboardStats;
  departments: Department[];
  teams: Team[];
  employees: User[];
  detail: WrapUpReviewDetail | null;
  canReview: boolean;
  selectedId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewedFilter, setReviewedFilter] = useState("all");
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (dateFrom && r.wrapDate < dateFrom) return false;
      if (dateTo && r.wrapDate > dateTo) return false;
      if (employeeFilter !== "all" && r.userId !== employeeFilter) return false;
      if (deptFilter !== "all" && r.departmentId !== deptFilter) return false;
      if (teamFilter !== "all" && r.teamId !== teamFilter) return false;
      if (statusFilter !== "all" && r.wrapUpStatus !== statusFilter) return false;
      if (reviewedFilter === "reviewed" && !r.reviewed) return false;
      if (reviewedFilter === "unreviewed" && (r.reviewed || r.wrapUpStatus !== "submitted")) return false;
      if (followUpOnly && !r.followUpNeeded) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo, employeeFilter, deptFilter, teamFilter, statusFilter, reviewedFilter, followUpOnly]);

  function openRow(row: WrapUpReviewRow) {
    if (row.wrapUpStatus === "submitted" && !row.id.startsWith("missing-")) {
      router.push(`/wrap-ups?id=${row.id}`);
    }
  }

  function downloadCsv() {
    const csv = exportWrapUpRowsCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wrap-ups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <EnterpriseKpi label="Submitted today" value={stats.submittedToday} />
        <EnterpriseKpi label="Missing today" value={stats.missingToday} warn={stats.missingToday > 0} />
        <EnterpriseKpi label="Unreviewed" value={stats.unreviewed} warn={stats.unreviewed > 0} />
        <EnterpriseKpi label="With blockers" value={stats.withBlockers} warn={stats.withBlockers > 0} />
        <EnterpriseKpi label="Follow-ups needed" value={stats.followUpsNeeded} warn={stats.followUpsNeeded > 0} />
      </div>

      <EnterpriseSection title="Filters" description="Narrow by date, employee, department, team, or review status">
        <div className="flex flex-wrap gap-2 mb-4">
          <Input type="date" className="w-[150px] h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" className="w-[150px] h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Select value={employeeFilter} onValueChange={(v) => setEmployeeFilter(v ?? "all")}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v ?? "all")}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v ?? "all")}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
              <SelectItem value="overridden">Overridden</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reviewedFilter} onValueChange={(v) => setReviewedFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Reviewed" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="unreviewed">Not reviewed</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant={followUpOnly ? "default" : "outline"} onClick={() => setFollowUpOnly((v) => !v)}>
            Follow-up
          </Button>
          <Button size="sm" variant="outline" onClick={downloadCsv}>
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
        </div>
      </EnterpriseSection>

      <EnterpriseSection
        title="End-of-day wrap-ups"
        description={`${filtered.length} record${filtered.length === 1 ? "" : "s"} — click a submitted row to review`}
      >
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Employee</EnterpriseTh>
              <EnterpriseTh>Department</EnterpriseTh>
              <EnterpriseTh>Team</EnterpriseTh>
              <EnterpriseTh>Date</EnterpriseTh>
              <EnterpriseTh>Submitted</EnterpriseTh>
              <EnterpriseTh>Clock out</EnterpriseTh>
              <EnterpriseTh>Status</EnterpriseTh>
              <EnterpriseTh>Blockers</EnterpriseTh>
              <EnterpriseTh>Preview</EnterpriseTh>
              <EnterpriseTh>Reviewed</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-muted-foreground py-8 text-sm">
                  No wrap-ups match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={`${row.id}-${row.wrapDate}`}
                  className={`enterprise-row-hover ${row.wrapUpStatus === "submitted" ? "cursor-pointer" : ""}`}
                  onClick={() => openRow(row)}
                >
                  <EnterpriseTd className="font-medium">{row.employeeName}</EnterpriseTd>
                  <EnterpriseTd>
                    <DepartmentBadge departmentId={row.departmentId} name={row.departmentName} />
                  </EnterpriseTd>
                  <EnterpriseTd className="text-xs text-muted-foreground">{row.teamName ?? "—"}</EnterpriseTd>
                  <EnterpriseTd>{row.wrapDate}</EnterpriseTd>
                  <EnterpriseTd className="text-xs text-muted-foreground">
                    {row.submittedAt
                      ? new Date(row.submittedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                      : "—"}
                  </EnterpriseTd>
                  <EnterpriseTd className="text-xs">{CLOCK_LABELS[row.clockOutStatus]}</EnterpriseTd>
                  <EnterpriseTd><WrapUpStatusBadge status={row.wrapUpStatus} /></EnterpriseTd>
                  <EnterpriseTd className="text-xs text-muted-foreground max-w-[120px] truncate">
                    {row.hasBlockers ? row.blockersPreview ?? "Support requested" : "—"}
                  </EnterpriseTd>
                  <EnterpriseTd className="text-xs text-muted-foreground max-w-[140px] truncate">
                    {row.notesPreview ?? "—"}
                  </EnterpriseTd>
                  <EnterpriseTd className="text-xs">
                    {row.reviewed ? (
                      <span className="text-emerald-400">{row.reviewedByName}</span>
                    ) : row.wrapUpStatus === "submitted" ? (
                      <span className="text-amber-400">Pending</span>
                    ) : (
                      "—"
                    )}
                  </EnterpriseTd>
                </tr>
              ))
            )}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>

      <WrapUpReviewDetailSheet
        detail={detail}
        open={!!selectedId && !!detail}
        onOpenChange={(open) => {
          if (!open) router.push("/wrap-ups");
        }}
        canReview={canReview}
        pending={pending}
        onMarkReviewed={(notes) => {
          if (!detail) return;
          startTransition(async () => {
            await markWrapUpReviewedAction(detail.wrapUp.id, notes);
            router.refresh();
          });
        }}
        onSaveNotes={(notes) => {
          if (!detail) return;
          startTransition(async () => {
            await updateWrapUpReviewNotesAction(detail.wrapUp.id, notes);
            router.refresh();
          });
        }}
        onFlagFollowUp={(needed, notes) => {
          if (!detail) return;
          startTransition(async () => {
            await flagWrapUpFollowUpAction(detail.wrapUp.id, needed, notes);
            router.refresh();
          });
        }}
      />
    </div>
  );
}
