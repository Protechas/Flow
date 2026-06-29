import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { ValidationReportsView } from "@/components/validation-center/validation-reports-view";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { getValidationCenterKpis, listValidationRuns } from "@/lib/validation-center/runs";

export default async function ValidationReportsPage() {
  await requirePageAccess("/validation/reports");
  const [runs, kpis] = await Promise.all([listValidationRuns(), getValidationCenterKpis()]);

  return (
    <FlowPageShell
      title="Reports"
      eyebrow={PLATFORM_EYEBROWS.validation}
      breadcrumbs={[
        { label: "Validation Center", href: "/validation" },
        { label: "Reports" },
      ]}
      description="Export validation reports and trend summaries."
      kpis={
        <KpiStrip
          columns={4}
          items={[
            {
              label: "Avg Compliance",
              value: kpis.libraryAccuracyPct != null ? `${kpis.libraryAccuracyPct}%` : "—",
            },
            {
              label: "Audit Pass Rate",
              value: kpis.auditPassRate != null ? `${kpis.auditPassRate}%` : "—",
            },
            { label: "Trend Points", value: kpis.trendPoints.length || "—" },
            { label: "Completed Runs", value: kpis.completedRuns },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false}>
          <ValidationSubnav />
          <ValidationReportsView kpis={kpis} runs={runs} />
        </WorkspaceContainer>
      }
    />
  );
}
