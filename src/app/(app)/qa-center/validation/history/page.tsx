import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { ValidationCompareView } from "@/components/validation-center/validation-compare-view";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { listValidationFindings } from "@/lib/validation-center/findings";
import { getValidationCenterKpis, listValidationRuns } from "@/lib/validation-center/runs";

export default async function QaCenterValidationHistoryPage() {
  await requirePageAccess("/qa-center/validation/history");
  const [runs, findings, kpis] = await Promise.all([
    listValidationRuns(),
    listValidationFindings(),
    getValidationCenterKpis(),
  ]);

  return (
    <FlowPageShell
      title="Validation History"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Validation Queue", href: "/qa-center/validation" },
        { label: "Validation History" },
      ]}
      description="Compare runs and track revalidation improvement."
      kpis={
        <KpiStrip
          columns={3}
          items={[
            {
              label: "Revalidation Improvement",
              value:
                kpis.revalidationImprovementPct != null
                  ? `${kpis.revalidationImprovementPct >= 0 ? "+" : ""}${kpis.revalidationImprovementPct}%`
                  : "—",
            },
            { label: "Completed Runs", value: kpis.completedRuns },
            { label: "Resolved Findings", value: kpis.resolvedFindings },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterSubnav />
          <ValidationSubnav />
          <ValidationCompareView initialRuns={runs} initialFindings={findings} />
        </WorkspaceContainer>
      }
    />
  );
}
