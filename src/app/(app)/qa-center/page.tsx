import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { QaCenterWingDoors } from "@/components/qa-center/qa-center-wing-doors";
import { requirePageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { initFlowStore, getFlowStore } from "@/lib/data/flow-store";
import { getBatchReviewQueue } from "@/lib/data/qa";
import { getQaCenterDashboardStats } from "@/lib/qa-center/dashboard";
import { getAuditWorkerStatus } from "@/lib/validation-center/worker-status";

export default async function QaCenterDashboardPage() {
  const user = await requirePageAccess("/qa-center");
  initFlowStore();
  const branchIds = getScopeMemberIds(user, getFlowStore().users, getFlowStore().teams);
  const [stats, batchQueue, workerStatus] = await Promise.all([
    getQaCenterDashboardStats(branchIds ?? null),
    getBatchReviewQueue(branchIds ?? undefined),
    getAuditWorkerStatus(),
  ]);

  return (
    <FlowPageShell
      title="QA Center"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[{ label: "QA Center" }]}
      description="Quality assurance for Service Information — human review on one side, the automated audit engine on the other."
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterSubnav />
          <QaCenterWingDoors
            stats={stats}
            openBatchCount={batchQueue.length}
            workerStatus={workerStatus}
          />
        </WorkspaceContainer>
      }
    />
  );
}
