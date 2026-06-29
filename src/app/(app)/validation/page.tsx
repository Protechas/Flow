import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { ValidationDashboard } from "@/components/validation-center/validation-dashboard";
import { requirePageAccess } from "@/lib/auth/guard";
import {
  getValidationCenterKpis,
  getValidationDashboardStats,
  listValidationRuns,
} from "@/lib/validation-center/runs";

export default async function ValidationCenterPage() {
  await requirePageAccess("/validation");
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
      title="Validation Center"
      eyebrow={PLATFORM_EYEBROWS.validation}
      breadcrumbs={[{ label: "Validation Center" }]}
      description="Run validation engines, review findings, and track corrections across your programs."
      workspace={
        <WorkspaceContainer elevated={false}>
          <ValidationDashboard runs={runs} stats={stats} />
        </WorkspaceContainer>
      }
    />
  );
}
