import { Suspense } from "react";

import { FlowAnalyticsView } from "@/components/analytics/flow-analytics-view";
import { CommandCenterSkeleton } from "@/components/enterprise/command-center-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { getVisibleUserIds, isOrgWideRole } from "@/lib/hierarchy/resolver";
import { buildFlowAnalyticsSnapshot } from "@/lib/analytics";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";

async function AnalyticsContent({ user }: { user: Awaited<ReturnType<typeof requirePageAccess>> }) {
  initFlowStore();
  const teamMemberIds = isOrgWideRole(user.role)
    ? undefined
    : getVisibleUserIds(user, getFlowStore().users, getFlowStore().teams);

  const data = await buildFlowAnalyticsSnapshot(user, { periodDays: 30, teamMemberIds });

  return <FlowAnalyticsView data={data} />;
}

export default async function AnalyticsPage() {
  const user = await requirePageAccess("/analytics");

  return (
    <>
      <PageHeader
        title="Flow Analytics"
        eyebrow="Flow Intelligence"
        breadcrumbs={[{ label: "Analytics" }]}
        description="Executive analytics across tasks, forecasting, timeclock, file uploads, QA, wrap-ups, workload alerts, and help flags — all from live Flow data."
      />
      <Suspense fallback={<CommandCenterSkeleton />}>
        <AnalyticsContent user={user} />
      </Suspense>
    </>
  );
}
