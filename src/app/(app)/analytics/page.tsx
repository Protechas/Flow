import { Suspense } from "react";
import { FlowAnalyticsView } from "@/components/analytics/flow-analytics-view";
import { CommandCenterSkeleton } from "@/components/enterprise/command-center-skeleton";
import { FlowPageShell, PLATFORM_EYEBROWS, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { getVisibleUserIds, isHierarchyOrgWide } from "@/lib/hierarchy/resolver";
import { buildFlowAnalyticsSnapshot } from "@/lib/analytics";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";

async function AnalyticsContent({ user }: { user: Awaited<ReturnType<typeof requirePageAccess>> }) {
  initFlowStore();
  const teamMemberIds = isHierarchyOrgWide(user)
    ? undefined
    : getVisibleUserIds(user, getFlowStore().users, getFlowStore().teams);

  const data = await buildFlowAnalyticsSnapshot(user, { periodDays: 30, teamMemberIds });
  return <FlowAnalyticsView data={data} />;
}

export default async function AnalyticsPage() {
  const user = await requirePageAccess("/analytics");

  return (
    <FlowPageShell
      title="Flow Analytics"
      eyebrow={PLATFORM_EYEBROWS.analytics}
      breadcrumbs={[{ label: "Analytics" }]}
      description="Executive analytics across tasks, forecasting, timeclock, file uploads, QA, wrap-ups, workload alerts, and help flags — all from live Flow data."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <Suspense fallback={<CommandCenterSkeleton />}>
            <AnalyticsContent user={user} />
          </Suspense>
        </WorkspaceContainer>
      }
    />
  );
}
