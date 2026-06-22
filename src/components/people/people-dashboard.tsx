"use client";

import { OPS_COPY } from "@/lib/copy/executive-terminology";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EnterpriseDataTable, EnterpriseTableHead, EnterpriseTd, EnterpriseTh } from "@/components/enterprise/enterprise-data-table";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { ManagerScorecardOverview } from "@/components/scorecard/manager-scorecard-overview";
import { Button } from "@/components/ui/button";
import { PayTypeBadge } from "@/components/enterprise/pay-type-badge";
import { operationsHref, peopleHref } from "@/lib/navigation/deep-links";
import { normalizePayType } from "@/lib/users/pay-type";
import type { EmployeeScorecard, TeamScorecardSummary } from "@/types/flow";

export function PeopleDashboard({
  profiles,
  teamSummary,
  analyticsHref,
}: {
  profiles: EmployeeScorecard[];
  teamSummary: TeamScorecardSummary;
  analyticsHref?: string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {analyticsHref && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" render={<Link href={analyticsHref} />}>
            Analytics
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EnterpriseKpi
          label={`Team ${OPS_COPY.operationsScore}`}
          value={
            profiles.length
              ? Math.round(profiles.reduce((s, p) => s + p.flowScore, 0) / profiles.length)
              : 0
          }
          href="/performance"
          title="View performance trends"
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
        <EnterpriseKpi label="Team Members" value={teamSummary.employeeCount} href="/people" title="Team roster" />
      </div>

      <ManagerScorecardOverview profiles={profiles} teamSummary={teamSummary} />

      <EnterpriseSection
        title="Employee Performance"
        description={`${OPS_COPY.operationsScore}, workload, and QA metrics`}
      >
        <EnterpriseDataTable>
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTh>Employee</EnterpriseTh>
              <EnterpriseTh>Pay</EnterpriseTh>
              <EnterpriseTh align="right">{OPS_COPY.operationsScore}</EnterpriseTh>
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
              <tr
                key={p.user.id}
                className="enterprise-row-hover cursor-pointer"
                onClick={() => router.push(peopleHref(p.user.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(peopleHref(p.user.id));
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Open profile for ${p.user.full_name}`}
              >
                <EnterpriseTd>
                  <Link
                    href={peopleHref(p.user.id)}
                    className="font-medium text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p.user.full_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">Rank #{p.rank}</p>
                </EnterpriseTd>
                <EnterpriseTd>
                  {p.user.role === "employee" ? (
                    <PayTypeBadge payType={normalizePayType(p.user.pay_type, p.user.role)} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
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
                      <Link
                        href={operationsHref({ search: p.user.full_name, view: "overdue" })}
                        className="text-[10px] font-semibold uppercase text-red-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                        title={`View overdue work for ${p.user.full_name}`}
                      >
                        {p.metrics.overdueWork} overdue
                      </Link>
                    )}
                    {p.stuckItems > 0 && (
                      <Link
                        href={operationsHref({ search: p.user.full_name, view: "stuck" })}
                        className="text-[10px] font-semibold uppercase text-amber-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                        title={`View stuck work for ${p.user.full_name}`}
                      >
                        {p.stuckItems} blocked
                      </Link>
                    )}
                    {p.trend.length >= 2 && p.trend[p.trend.length - 1].flowScore > p.trend[0].flowScore && (
                      <span className="text-[10px] font-semibold uppercase text-green-400">
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
