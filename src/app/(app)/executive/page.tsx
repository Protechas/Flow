import { Suspense } from "react";
import { ExecutiveDashboardView } from "@/components/command-center/executive-dashboard-view";
import { CommandCenterSkeleton } from "@/components/enterprise/command-center-skeleton";
import { FlowPageShell, PLATFORM_EYEBROWS, WorkspaceContainer } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { appGreeting } from "@/lib/datetime/timezone";
import { getCommandCenterMetrics } from "@/lib/data/command-center";
import type { User } from "@/types/flow";

async function ExecutiveDashboardContent({ user }: { user: User }) {
  const data = await getCommandCenterMetrics(user);
  return <ExecutiveDashboardView data={data} role={user.role} />;
}

export default async function ExecutivePage() {
  const user = await requirePageAccess("/executive");
  const firstName = user.first_name?.trim() || user.full_name?.split(" ")[0] || "there";

  return (
    <FlowPageShell
      title={`${appGreeting()}, ${firstName}.`}
      eyebrow={PLATFORM_EYEBROWS.executive}
      breadcrumbs={[{ label: "Executive" }]}
      description="Here's how the company is performing right now — department health, workforce, delivery risk, and quality."
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
