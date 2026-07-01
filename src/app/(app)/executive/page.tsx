import { Suspense } from "react";
import { ExecutiveDashboardView } from "@/components/command-center/executive-dashboard-view";
import { CommandCenterSkeleton } from "@/components/enterprise/command-center-skeleton";
import { FlowPageShell, PLATFORM_EYEBROWS, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { getCommandCenterMetrics } from "@/lib/data/command-center";
import type { User } from "@/types/flow";

async function ExecutiveDashboardContent({ user }: { user: User }) {
  const data = await getCommandCenterMetrics(user);
  return <ExecutiveDashboardView data={data} role={user.role} />;
}

export default async function ExecutivePage() {
  const user = await requirePageAccess("/executive");

  return (
    <FlowPageShell
      title="Executive Dashboard"
      eyebrow={PLATFORM_EYEBROWS.executive}
      breadcrumbs={[{ label: "Executive" }]}
      description="One screen for how the company is performing — department health, workforce, delivery risk, quality, and management alerts."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <Suspense fallback={<CommandCenterSkeleton />}>
            <ExecutiveDashboardContent user={user} />
          </Suspense>
        </WorkspaceContainer>
      }
    />
  );
}
