import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ReportMetricsView } from "@/components/reports/report-metrics";
import { AccountabilityReportView } from "@/components/performance/accountability-report-view";
import { CoachingReportView } from "@/components/performance/coaching-report-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getAccountabilityReport, getCoachingReport } from "@/lib/data/performance";
import { getReportMetrics } from "@/lib/data/reports";
import { getCurrentUser } from "@/lib/auth/session";
import { getEmployeeScorecard } from "@/lib/data/performance";
import { Button } from "@/components/ui/button";

export default async function ReportsPage() {
  const user = await requirePageAccess("/reports");
  const canViewTeam = hasPermission(user.role, "reports:view_all");

  let metrics = await getReportMetrics();

  if (hasPermission(user.role, "reports:view_own") && !canViewTeam) {
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

  const accountability = canViewTeam ? await getAccountabilityReport() : null;
  const coaching = canViewTeam ? await getCoachingReport() : null;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Operational reporting — trends, workload analysis, and drill-down metrics"
      />
      {canViewTeam && (
        <div className="flex justify-end mb-6">
          <Button variant="outline" size="sm" render={<Link href="/performance" />}>
            Open Performance OS
          </Button>
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
