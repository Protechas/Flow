import { Suspense } from "react";

import { ExecutiveDashboardView } from "@/components/command-center/executive-dashboard-view";
import { CommandCenterSkeleton } from "@/components/enterprise/command-center-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { runWorkflowChecksAction } from "@/app/actions/notifications";
import { requirePageAccess } from "@/lib/auth/guard";
import { getCommandCenterMetrics } from "@/lib/data/command-center";
import type { User } from "@/types/flow";

async function ExecutiveDashboardContent({ user }: { user: User }) {
  await runWorkflowChecksAction();
  const data = await getCommandCenterMetrics(user);

  return <ExecutiveDashboardView data={data} role={user.role} />;
}

export default async function ExecutivePage() {
  const user = await requirePageAccess("/executive");

  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        eyebrow="Flow Executive"
        breadcrumbs={[{ label: "Executive" }]}
        description="One screen for how the company is performing right now — department health, workforce, delivery risk, quality, and operational signals."
      />
      <Suspense fallback={<CommandCenterSkeleton />}>
        <ExecutiveDashboardContent user={user} />
      </Suspense>
    </>
  );
}
