import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterDashboardView } from "@/components/qa-center/qa-center-dashboard-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { getQaCenterDashboardStats } from "@/lib/qa-center/dashboard";

export default async function QaCenterDashboardPage() {
  const user = await requirePageAccess("/qa-center");
  initFlowStore();
  const branchIds = getScopeMemberIds(user, getFlowStore().users, getFlowStore().teams);
  const stats = await getQaCenterDashboardStats(branchIds ?? null);

  return (
    <FlowPageShell
      title="QA Center"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[{ label: "QA Center" }]}
      description="Enterprise quality assurance for Service Information — validation, review, and continuous improvement."
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterDashboardView stats={stats} />
        </WorkspaceContainer>
      }
    />
  );
}
