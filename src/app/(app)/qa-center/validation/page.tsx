import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { ValidationDashboard } from "@/components/validation-center/validation-dashboard";
import { requirePageAccess } from "@/lib/auth/guard";
import {
  getValidationCenterKpis,
  getValidationDashboardStats,
  listValidationRuns,
} from "@/lib/validation-center/runs";

export default async function QaCenterValidationPage() {
  await requirePageAccess("/qa-center/validation");
  const runs = await listValidationRuns();
  const [baseStats, kpis] = await Promise.all([
    getValidationDashboardStats(runs),
    getValidationCenterKpis(),
  ]);
  const stats = {
    ...baseStats,
    revalidationImprovementPct: kpis.revalidationImprovementPct,
    correctionsInProgress: kpis.correctionsInProgress,
  };

  return (
    <FlowPageShell
      title="Validation Queue"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Validation Queue" },
      ]}
      description="Run validation engines, review findings, and track corrections across your programs."
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterSubnav />
          <ValidationDashboard runs={runs} stats={stats} />
        </WorkspaceContainer>
      }
    />
  );
}
