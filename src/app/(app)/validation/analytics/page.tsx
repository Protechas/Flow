import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { ValidationAnalyticsView } from "@/components/validation-center/validation-analytics-view";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { getValidationCenterKpis } from "@/lib/validation-center/runs";

export default async function ValidationAnalyticsPage() {
  await requirePageAccess("/validation/analytics");
  const kpis = await getValidationCenterKpis();

  return (
    <FlowPageShell
      title="Analytics"
      eyebrow={PLATFORM_EYEBROWS.validation}
      breadcrumbs={[
        { label: "Validation Center", href: "/validation" },
        { label: "Analytics" },
      ]}
      description="Root cause breakdown, manufacturer accuracy, and validation trends."
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
          <ValidationSubnav />
          <ValidationAnalyticsView kpis={kpis} />
        </WorkspaceContainer>
      }
    />
  );
}
