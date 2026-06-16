"use client";

import { EnterpriseDataTable, EnterpriseTableHead, EnterpriseTd, EnterpriseTh } from "@/components/enterprise/enterprise-data-table";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { DepartmentBadge } from "@/components/departments/department-badge";
import type { DepartmentReportMetrics } from "@/lib/departments/reports";

export function DepartmentReportsPanel({
  reports,
}: {
  reports: DepartmentReportMetrics[];
}) {
  if (reports.length === 0) return null;

  const totalDocs = reports.reduce((s, r) => s + r.documentsCompleted, 0);
  const totalHours = reports.reduce((s, r) => s + r.hoursWorked, 0);

  return (
    <EnterpriseSection
      title="Department performance"
      description="Documents, hours, QA, and wrap-up compliance by department"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <EnterpriseKpi label="Departments" value={reports.length} />
        <EnterpriseKpi label="Documents completed" value={totalDocs} />
        <EnterpriseKpi label="Hours worked" value={Math.round(totalHours * 10) / 10} />
        <EnterpriseKpi
          label="Overdue tasks"
          value={reports.reduce((s, r) => s + r.overdueTasks, 0)}
          warn={reports.some((r) => r.overdueTasks > 0)}
        />
      </div>

      <EnterpriseDataTable compact>
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTh>Department</EnterpriseTh>
            <EnterpriseTh align="right">Completed</EnterpriseTh>
            <EnterpriseTh align="right">Hours</EnterpriseTh>
            <EnterpriseTh align="right">Avg min/doc</EnterpriseTh>
            <EnterpriseTh align="right">QA pass</EnterpriseTh>
            <EnterpriseTh align="right">QA fail</EnterpriseTh>
            <EnterpriseTh align="right">Overdue</EnterpriseTh>
            <EnterpriseTh align="right">Wrap-ups</EnterpriseTh>
          </tr>
        </EnterpriseTableHead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.departmentId} className="enterprise-row-hover">
              <EnterpriseTd>
                <DepartmentBadge departmentId={r.departmentId} name={r.departmentName} />
              </EnterpriseTd>
              <EnterpriseTd align="right">{r.documentsCompleted}</EnterpriseTd>
              <EnterpriseTd align="right">{r.hoursWorked}</EnterpriseTd>
              <EnterpriseTd align="right">{r.avgMinutesPerDocument}</EnterpriseTd>
              <EnterpriseTd align="right">{r.qaPassCount}</EnterpriseTd>
              <EnterpriseTd align="right">{r.qaFailCount}</EnterpriseTd>
              <EnterpriseTd align="right">{r.overdueTasks}</EnterpriseTd>
              <EnterpriseTd align="right" className="text-xs text-muted-foreground">
                {r.wrapUpSubmitted} / {r.wrapUpMissing} missing
                {r.wrapUpOverridden > 0 && ` · ${r.wrapUpOverridden} overridden`}
              </EnterpriseTd>
            </tr>
          ))}
        </tbody>
      </EnterpriseDataTable>
    </EnterpriseSection>
  );
}
