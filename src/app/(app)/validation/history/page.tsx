import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { ValidationCompareView } from "@/components/validation-center/validation-compare-view";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { listValidationFindings } from "@/lib/validation-center/findings";
import { getValidationCenterKpis, listValidationRuns } from "@/lib/validation-center/runs";

export default async function ValidationHistoryPage() {
  await requirePageAccess("/validation/history");
  const [runs, findings, kpis] = await Promise.all([
    listValidationRuns(),
    listValidationFindings(),
    getValidationCenterKpis(),
  ]);

  return (
    <FlowPageShell
      title="Validation History"
      eyebrow={PLATFORM_EYEBROWS.validation}
      breadcrumbs={[
        { label: "Validation Center", href: "/validation" },
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
          <ValidationSubnav />
          <ValidationCompareView initialRuns={runs} initialFindings={findings} />
        </WorkspaceContainer>
      }
    />
  );
}
