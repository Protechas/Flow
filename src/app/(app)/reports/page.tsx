import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";

import { ReportMetricsView } from "@/components/reports/report-metrics";
import { DepartmentReportsPanel } from "@/components/departments/department-reports-panel";
import { DepartmentFilterBar } from "@/components/departments/department-filter-bar";
import { AccountabilityReportView } from "@/components/performance/accountability-report-view";

import { CoachingReportView } from "@/components/performance/coaching-report-view";

import { requirePageAccess } from "@/lib/auth/guard";

import { getTeamMemberIds } from "@/lib/auth/team-scope";
import { getVisibleUserIds, isOrgWideRole } from "@/lib/hierarchy/resolver";

import { hasPermission, isTeamLeadRole } from "@/lib/auth/permissions";

import { getAccountabilityReport, getCoachingReport } from "@/lib/data/performance";

import { getReportMetrics } from "@/lib/data/reports";

import { getEmployeeScorecard } from "@/lib/data/performance";

import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { parseDepartmentFilter } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getActiveDepartments } from "@/lib/departments/filters";
import { buildAllDepartmentReports } from "@/lib/departments/reports";

import { Button } from "@/components/ui/button";



export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {

  const user = await requirePageAccess("/reports");
  const { department: deptParam } = await searchParams;
  const departmentFilter = parseDepartmentFilter({ department: deptParam });

  const canViewOrg = hasPermission(user.role, "reports:view_all");

  const canViewTeam = hasPermission(user.role, "reports:view_team");



  initFlowStore();
  const departments = getActiveDepartments(
    filterDepartmentsForViewer(listDepartments(), user)
  );

  const teamMemberIds = isOrgWideRole(user.role)
    ? undefined
    : getVisibleUserIds(user, getFlowStore().users, getFlowStore().teams);

  let metrics = await getReportMetrics(teamMemberIds);
  const deptReports = canViewOrg
    ? buildAllDepartmentReports(
        departmentFilter
          ? departments.filter((d) => d.id === departmentFilter)
          : departments
      )
    : [];



  if (hasPermission(user.role, "reports:view_own") && !canViewOrg && !canViewTeam) {

    const profile = await getEmployeeScorecard(user.id);

    if (profile) {

      metrics = {

        ...metrics,

        productivityByAnalyst: [

          { name: profile.user.full_name, completed: profile.completedThisMonth, hours: profile.hoursLogged },

        ],

        workloadByAnalyst: [

          { name: profile.user.full_name, active: profile.currentWork.length, hours: profile.hoursLogged },

        ],

        performanceTrends: profile.trend.map((t) => ({ date: t.label, flowScore: t.flowScore })),

      };

    }

  }



  const accountability = canViewOrg ? await getAccountabilityReport() : null;

  const coaching = canViewOrg ? await getCoachingReport() : null;



  return (

    <>

      <PageHeader

        title={isTeamLeadRole(user.role) ? "Team Reports" : "Executive Reports"}
        eyebrow="Flow Intelligence"

        description={

          isTeamLeadRole(user.role)

            ? "Team operational reporting — workload, productivity, and QA trends for your direct reports"

            : "Operational reporting — trends, workload analysis, and drill-down metrics"

        }

      >
        {canViewOrg && <DepartmentFilterBar departments={departments} />}
      </PageHeader>

      {canViewOrg && (
        <div className="flex justify-end gap-2 mb-6">

          <Button variant="outline" size="sm" render={<Link href="/production" />}>

            Production tracking

          </Button>

          <Button variant="outline" size="sm" render={<Link href="/performance" />}>

            Open Performance OS

          </Button>

        </div>

      )}

      {isTeamLeadRole(user.role) && (

        <div className="flex justify-end gap-2 mb-6">

          <Button variant="outline" size="sm" render={<Link href="/production" />}>

            Production tracking

          </Button>

          <Button variant="outline" size="sm" render={<Link href="/time-clock" />}>

            Team time clock

          </Button>

        </div>
      )}

      {canViewOrg && deptReports.length > 0 && (
        <div className="mb-8">
          <DepartmentReportsPanel reports={deptReports} />
        </div>
      )}

      <ReportMetricsView metrics={metrics} />

      {accountability && (

        <section className="mt-12 space-y-4">

          <h2 className="text-lg font-semibold">Accountability</h2>

          <AccountabilityReportView report={accountability} />

        </section>

      )}

      {coaching && (

        <section className="mt-12 space-y-4">

          <h2 className="text-lg font-semibold">Coaching</h2>

          <CoachingReportView report={coaching} />

        </section>

      )}

    </>

  );

}

