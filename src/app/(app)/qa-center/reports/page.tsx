import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { ValidationReportsView } from "@/components/validation-center/validation-reports-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { getValidationCenterKpis, listValidationRuns } from "@/lib/validation-center/runs";

export default async function QaCenterReportsPage() {
  await requirePageAccess("/qa-center/reports");
  const [runs, kpis] = await Promise.all([listValidationRuns(), getValidationCenterKpis()]);

  return (
    <FlowPageShell
      title="Reports"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Reports" },
      ]}
      description="Executive summaries, QA trends, and exportable validation reports."
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
          <QaCenterSubnav />
          <ValidationReportsView kpis={kpis} runs={runs} />
        </WorkspaceContainer>
      }
    />
  );
}
