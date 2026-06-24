import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import type {
  DailyWrapUpComplianceRow,
  Department,
  DepartmentUser,
  ProductionReportFilters,
  Team,
  User,
  WorkPackage,
} from "@/types/flow";
import { format } from "date-fns";
import { getDepartmentName } from "@/lib/departments/resolve";
import { getProductionReport } from "@/lib/data/production-tracking";
import { isWrapUpMissingForReporting } from "@/lib/wrap-up/eligibility";

export interface DepartmentReportMetrics {
  departmentId: string;
  departmentName: string;
  documentsCompleted: number;
  hoursWorked: number;
  avgMinutesPerDocument: number;
  qaPassCount: number;
  qaFailCount: number;
  overdueTasks: number;
  activeEmployees: number;
  wrapUpSubmitted: number;
  wrapUpMissing: number;
  wrapUpOverridden: number;
}

export function buildDepartmentReportMetrics(
  departmentId: string,
  filters?: ProductionReportFilters
): DepartmentReportMetrics {
  initFlowStore();
  const store = getFlowStore();
  const deptPackages = store.workPackages.filter(
    (p) => (p.department_id ?? store.projects.find((pr) => pr.id === p.project_id)?.department_id) === departmentId
  );
  const production = getProductionReport({ ...filters, departmentId });
  const compliance = store.dailyWrapUps;
  const overrides = store.dailyWrapUpOverrides;
  const today = format(new Date(), "yyyy-MM-dd");

  const deptUserIds = new Set(
    store.departmentUsers
      .filter((du) => du.department_id === departmentId)
      .map((du) => du.user_id)
  );
  for (const u of store.users) {
    const team = store.teams.find((t) => t.id === u.team_id);
    if (team?.department_id === departmentId) deptUserIds.add(u.id);
  }

  const completed = deptPackages.filter((p) => p.status === "done");
  const overdue = deptPackages.filter(
    (p) => p.due_date && p.due_date < today && p.status !== "done"
  );
  const qaPass = deptPackages.filter((p) => p.qa_status === "passed").length;
  const qaFail = deptPackages.filter(
    (p) => p.qa_status === "minor_correction" || p.qa_status === "major_correction" || p.qa_status === "rejected"
  ).length;

  const wrapUpSubmitted = compliance.filter(
    (w) => w.department_id === departmentId && w.wrap_date === today
  ).length;
  const wrapUpOverridden = overrides.filter((o) => o.wrap_date === today).filter((o) =>
    deptUserIds.has(o.user_id)
  ).length;
  const wrapUpMissing = [...deptUserIds].filter((uid) => {
    const user = store.users.find((u) => u.id === uid);
    if (!user) return false;
    return isWrapUpMissingForReporting(user, today);
  }).length;

  const deptProd = production.byDepartment.find((d) => d.departmentId === departmentId);

  return {
    departmentId,
    departmentName: getDepartmentName(departmentId),
    documentsCompleted: completed.length,
    hoursWorked: deptProd?.hoursWorked ?? production.totalTaskHours,
    avgMinutesPerDocument: production.avgMinutesPerDocument,
    qaPassCount: qaPass,
    qaFailCount: qaFail,
    overdueTasks: overdue.length,
    activeEmployees: [...deptUserIds].filter((id) => {
      const u = store.users.find((x) => x.id === id);
      return u?.is_active && u.role === "employee";
    }).length,
    wrapUpSubmitted,
    wrapUpMissing,
    wrapUpOverridden,
  };
}

export function buildAllDepartmentReports(
  departments: Department[],
  filters?: ProductionReportFilters
): DepartmentReportMetrics[] {
  return departments
    .filter((d) => d.status === "active")
    .map((d) => buildDepartmentReportMetrics(d.id, filters));
}
