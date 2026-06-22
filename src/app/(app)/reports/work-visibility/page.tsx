import { WorkVisibilityReportView } from "@/components/work-visibility/work-visibility-report-view";
import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { hydrateWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";
import { buildScopedWorkVisibility } from "@/lib/work-visibility/engine";
import { buildWorkVisibilityTrend } from "@/lib/work-visibility/calculator";

export default async function WorkVisibilityReportPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const user = await requirePageAccess("/reports/work-visibility");
  const { userId } = await searchParams;
  const settings = await hydrateWorkVisibilitySettings();
  initFlowStore();
  const store = getFlowStore();
  const packages = await getWorkPackages();
  const { summary, employees, activityGaps } = buildScopedWorkVisibility(
    user,
    store.users,
    packages
  );
  const trend7 = buildWorkVisibilityTrend(store.users, packages, 7);
  const trend30 = buildWorkVisibilityTrend(store.users, packages, 30);
  const trend90 = buildWorkVisibilityTrend(store.users, packages, 90);

  return (
    <FlowPageShell
      title="Work Visibility"
      eyebrow={PLATFORM_EYEBROWS.reports}
      breadcrumbs={[
        { label: "Reports", href: "/reports" },
        { label: "Work Visibility" },
      ]}
      description="Task tracking compliance, activity documentation, and workload coverage — drill down for supporting records."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <WorkVisibilityReportView
            summary={summary}
            employees={employees}
            activityGaps={activityGaps}
            trend7={trend7}
            trend30={trend30}
            trend90={trend90}
            highlightUserId={userId}
            complianceTargetPct={settings.task_tracking_compliance_target_pct}
          />
        </WorkspaceContainer>
      }
    />
  );
}
