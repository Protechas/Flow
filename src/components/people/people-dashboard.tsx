import Link from "next/link";
import { EnterpriseDataTable, EnterpriseTableHead, EnterpriseTd, EnterpriseTh } from "@/components/enterprise/enterprise-data-table";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { ManagerScorecardOverview } from "@/components/scorecard/manager-scorecard-overview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmployeeScorecard, TeamScorecardSummary } from "@/types/flow";

export function PeopleDashboard({
  profiles,
  teamSummary,
}: {
  profiles: EmployeeScorecard[];
  teamSummary: TeamScorecardSummary;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" render={<Link href="/performance" />}>
          Analytics
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EnterpriseKpi
          label="Team Flow Score"
          value={
            profiles.length
              ? Math.round(profiles.reduce((s, p) => s + p.flowScore, 0) / profiles.length)
              : 0
          }
        />
        <EnterpriseKpi
          label="Avg Productivity"
          value={
            profiles.length
              ? Math.round(profiles.reduce((s, p) => s + p.productivityScore, 0) / profiles.length)
              : 0
          }
        />
        <EnterpriseKpi
          label="Avg Quality"
          value={
            profiles.length
              ? Math.round(profiles.reduce((s, p) => s + p.qualityScore, 0) / profiles.length)
              : 0
          }
        />
        <EnterpriseKpi label="Team Members" value={teamSummary.employeeCount} />
      </div>

      <ManagerScorecardOverview profiles={profiles} teamSummary={teamSummary} />

      <EnterpriseSection
        title="Employee Performance"
        description="Flow Score, workload, and QA metrics"
      >
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Employee</EnterpriseTh>
              <EnterpriseTh align="right">Flow Score</EnterpriseTh>
              <EnterpriseTh align="right">Productivity</EnterpriseTh>
              <EnterpriseTh align="right">Quality</EnterpriseTh>
              <EnterpriseTh align="right">On-Time</EnterpriseTh>
              <EnterpriseTh align="right">Active</EnterpriseTh>
              <EnterpriseTh align="right">QA Pass</EnterpriseTh>
              <EnterpriseTh align="right">Corrections</EnterpriseTh>
              <EnterpriseTh>Flags</EnterpriseTh>
            </tr>
          </EnterpriseTableHead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.user.id} className="enterprise-row-hover">
                <EnterpriseTd>
                  <Link href={`/people/${p.user.id}`} className="font-medium text-primary hover:underline">
                    {p.user.full_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">Rank #{p.rank}</p>
                </EnterpriseTd>
                <EnterpriseTd align="right">
                  <span className="font-semibold">{p.flowScore}</span>
                </EnterpriseTd>
                <EnterpriseTd align="right">{p.productivityScore}</EnterpriseTd>
                <EnterpriseTd align="right">{p.qualityScore}</EnterpriseTd>
                <EnterpriseTd align="right">{p.onTimeScore}</EnterpriseTd>
                <EnterpriseTd align="right">{p.metrics.activeWork}</EnterpriseTd>
                <EnterpriseTd align="right">{p.metrics.qaPassRate}%</EnterpriseTd>
                <EnterpriseTd align="right">{p.metrics.openCorrections}</EnterpriseTd>
                <EnterpriseTd>
                  <div className="flex flex-wrap gap-1">
                    {p.metrics.overdueWork > 0 && (
                      <span className="text-[10px] font-semibold uppercase text-red-700">
                        {p.metrics.overdueWork} overdue
                      </span>
                    )}
                    {p.stuckItems > 0 && (
                      <span className="text-[10px] font-semibold uppercase text-amber-700">
                        {p.stuckItems} blocked
                      </span>
                    )}
                    {p.trend.length >= 2 && p.trend[p.trend.length - 1].flowScore > p.trend[0].flowScore && (
                      <span className="text-[10px] font-semibold uppercase text-green-700">
                        Improving
                      </span>
                    )}
                  </div>
                </EnterpriseTd>
              </tr>
            ))}
          </tbody>
        </EnterpriseDataTable>
      </EnterpriseSection>
    </div>
  );
}
