"use client";

import { useMemo, useState } from "react";
import { EnterpriseDataTable, EnterpriseTableHead, EnterpriseTh, EnterpriseTd } from "@/components/enterprise/enterprise-data-table";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMinutes } from "@/lib/production/metrics";
import type { ProductionReportSummary, User } from "@/types/flow";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ProductionReportsView({
  report,
  users,
  projects,
}: {
  report: ProductionReportSummary;
  users: User[];
  projects: { id: string; name: string }[];
}) {
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredRows = useMemo(() => {
    return report.rows.filter((r) => {
      if (employeeFilter !== "all" && r.employeeId !== employeeFilter) return false;
      if (statusFilter === "awaiting" && !r.awaitingQa) return false;
      if (statusFilter !== "all" && statusFilter !== "awaiting" && r.status !== statusFilter) return false;
      return true;
    });
  }, [report.rows, employeeFilter, statusFilter]);

  const filteredByProject = useMemo(() => {
    if (projectFilter === "all") return filteredRows;
    const project = projects.find((p) => p.id === projectFilter);
    if (!project) return filteredRows;
    return filteredRows.filter((r) => r.projectName === project.name);
  }, [filteredRows, projectFilter, projects]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <EnterpriseKpi label="Submissions" value={String(report.totalSubmissions)} />
        <EnterpriseKpi label="Awaiting QA" value={String(report.awaitingQa)} warn={report.awaitingQa > 0} />
        <EnterpriseKpi label="Avg min / doc" value={report.avgMinutesPerDocument > 0 ? `${report.avgMinutesPerDocument}m` : "—"} />
        <EnterpriseKpi label="Docs / hour" value={report.avgDocumentsPerHour > 0 ? String(report.avgDocumentsPerHour) : "—"} />
        <EnterpriseKpi label="Task hours" value={`${report.totalTaskHours}h`} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={employeeFilter} onValueChange={(v) => setEmployeeFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {users.filter((u) => u.role === "employee").map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={(v) => setProjectFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="awaiting">Awaiting QA</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="correction_requested">Correction requested</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {report.trends.length > 0 && (
        <EnterpriseSection title="Productivity trends">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="submissions" fill="var(--chart-1)" name="Submissions" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </EnterpriseSection>
      )}

      <EnterpriseSection title="By employee">
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Employee</EnterpriseTh>
              <EnterpriseTh align="right">Submissions</EnterpriseTh>
              <EnterpriseTh align="right">Task time</EnterpriseTh>
              <EnterpriseTh align="right">Files</EnterpriseTh>
              <EnterpriseTh align="right">Docs/hr</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {report.byEmployee.map((e) => (
              <tr key={e.userId} className="enterprise-row-hover">
                <EnterpriseTd>{e.name}</EnterpriseTd>
                <EnterpriseTd align="right">{e.submissions}</EnterpriseTd>
                <EnterpriseTd align="right">{formatMinutes(e.totalMinutes)}</EnterpriseTd>
                <EnterpriseTd align="right">{e.fileCount}</EnterpriseTd>
                <EnterpriseTd align="right">{e.docsPerHour}</EnterpriseTd>
              </tr>
            ))}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>

      <EnterpriseSection title="Task submissions" description="Time per task, documents, and productivity rates">
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Task</EnterpriseTh>
              <EnterpriseTh>Employee</EnterpriseTh>
              <EnterpriseTh>Project</EnterpriseTh>
              <EnterpriseTh>Manufacturer</EnterpriseTh>
              <EnterpriseTh align="right">Files</EnterpriseTh>
              <EnterpriseTh align="right">Task time</EnterpriseTh>
              <EnterpriseTh align="right">Min/doc</EnterpriseTh>
              <EnterpriseTh align="right">Docs/hr</EnterpriseTh>
              <EnterpriseTh>Status</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {filteredByProject.map((r) => (
              <tr key={`${r.taskId}-${r.submittedAt}`} className="enterprise-row-hover">
                <EnterpriseTd className="font-medium max-w-[200px] truncate">{r.taskTitle}</EnterpriseTd>
                <EnterpriseTd>{r.employeeName}</EnterpriseTd>
                <EnterpriseTd>{r.projectName}</EnterpriseTd>
                <EnterpriseTd>{r.manufacturerName}</EnterpriseTd>
                <EnterpriseTd align="right">{r.fileCount}</EnterpriseTd>
                <EnterpriseTd align="right">{formatMinutes(r.totalTaskMinutes)}</EnterpriseTd>
                <EnterpriseTd align="right">{r.averageMinutesPerDocument || "—"}</EnterpriseTd>
                <EnterpriseTd align="right">{r.documentsPerHour || "—"}</EnterpriseTd>
                <EnterpriseTd>
                  <span className="text-xs capitalize">{r.status.replace(/_/g, " ")}</span>
                </EnterpriseTd>
              </tr>
            ))}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>
    </div>
  );
}
