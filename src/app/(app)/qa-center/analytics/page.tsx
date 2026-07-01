import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { ValidationAnalyticsView } from "@/components/validation-center/validation-analytics-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { QaAnalystPerformanceView } from "@/components/qa-center/qa-analyst-performance-view";
import { computeAnalystPerformance } from "@/lib/qa-center/analytics/analyst-performance";
import { getValidationCenterKpis } from "@/lib/validation-center/runs";

export default async function QaCenterAnalyticsPage() {
  await requirePageAccess("/qa-center/analytics");
  const [kpis, analystRows] = await Promise.all([
    getValidationCenterKpis(),
    computeAnalystPerformance(),
  ]);

  return (
    <FlowPageShell
      title="Analytics"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Analytics" },
      ]}
      description="Analyst performance, error trends, manufacturer insights, and root cause breakdown."
      kpis={
        <KpiStrip
          columns={4}
          items={[
            {
              label: "Library Accuracy",
              value: kpis.libraryAccuracyPct != null ? `${kpis.libraryAccuracyPct}%` : "—",
            },
            { label: "Open Findings", value: kpis.openFindings, warn: kpis.openFindings > 0 },
            {
              label: "Critical Open",
              value: kpis.criticalFindingsOpen,
              critical: kpis.criticalFindingsOpen > 0,
            },
            {
              label: "Root Cause Types",
              value: kpis.rootCauseBreakdown.length || "—",
            },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterSubnav />
          <ValidationAnalyticsView kpis={kpis} />
          <div className="mt-8">
            <QaAnalystPerformanceView rows={analystRows} />
          </div>
        </WorkspaceContainer>
      }
    />
  );
}
