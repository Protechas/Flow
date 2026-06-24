import Link from "next/link";
import { HelpFlagsPanel } from "@/components/help-flags/help-flags-panel";
import { WorkloadAlertsPanel } from "@/components/workload-alerts/workload-alerts-panel";
import {
  FlowPageShell,
  GlobalAlertBar,
  KpiStrip,
  LiveActivityStream,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import {
  alertCenterHref,
  operationsHref,
  wrapUpsHref,
} from "@/lib/navigation/deep-links";
import { getFlowStore, initFlowStore, listTeamsStore } from "@/lib/data/flow-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { listHelpFlagsForViewer } from "@/lib/help-flags/engine";
import { hydrateWorkloadAlertSettings } from "@/lib/workload-alerts/hydrate";
import { listWorkloadAlertsForViewer } from "@/lib/workload-alerts/engine";
import { hydrateWorkVisibilitySettings } from "@/lib/work-visibility/hydrate";
import { listActivityGapsForViewer, syncActivityGaps } from "@/lib/work-visibility/engine";
import { ActivityGapsPanel } from "@/components/work-visibility/activity-gaps-panel";
import { getWrapUpDashboardStats } from "@/lib/wrap-up/review";
import { getVisibleUserIds, isHierarchyOrgWide } from "@/lib/hierarchy/resolver";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
import { isOverdue } from "@/lib/scoring/flow-score";
import { Button } from "@/components/ui/button";

export default async function AlertCenterPage() {
  const user = await requirePageAccess("/alert-center");
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  await hydrateWorkVisibilitySettings();
  initFlowStore();
  const store = getFlowStore();
  const teams = listTeamsStore();
  const packages = await getWorkPackages();

  const workloadAlerts = listWorkloadAlertsForViewer(user, packages, store.users);
  const helpFlags = listHelpFlagsForViewer(user, packages, store.users);
  const activityGaps = listActivityGapsForViewer(user, store.users);
  syncActivityGaps(store.users);

  const visibleIds = isHierarchyOrgWide(user)
    ? null
    : new Set(getVisibleUserIds(user, store.users, teams));

  const scopedPackages = visibleIds
    ? packages.filter((p) => p.assigned_to && visibleIds.has(p.assigned_to))
    : packages;

  const overdueCount = scopedPackages.filter(isOverdue).length;
  const wrapUpStats = getWrapUpDashboardStats(user);

  const hasAlerts = helpFlags.length > 0 || workloadAlerts.length > 0 || activityGaps.length > 0;
  const hasCritical =
    helpFlags.some((f) => f.severity === "critical") ||
    workloadAlerts.some((a) => a.severity === "critical");
  const recentActivity = [...store.activity]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);

  return (
    <FlowPageShell
      title="Alert Center"
      eyebrow={PLATFORM_EYEBROWS.alerts}
      breadcrumbs={[{ label: "Alert Center" }]}
      description="Escalations, capacity alerts, daily reports, and overdue work — scoped to your reporting branch."
      pulse={
        <OperationalPostureStrip
          signals={[
            {
              id: "help",
              label: OPS_COPY.openEscalations,
              value: helpFlags.length,
              status: helpFlags.length > 0 ? "critical" : "healthy",
              href: alertCenterHref({ type: "help" }),
              helpKey: "openEscalations",
            },
            {
              id: "workload",
              label: OPS_COPY.availableCapacity,
              value: workloadAlerts.length,
              status: workloadAlerts.length > 0 ? "attention" : "healthy",
              href: alertCenterHref({ type: "workload" }),
              helpKey: "availableCapacity",
            },
            {
              id: "activity_gaps",
              label: OPS_COPY.activityGap,
              value: activityGaps.length,
              status: activityGaps.length > 0 ? "attention" : "healthy",
              href: alertCenterHref({ type: "activity_gaps" }),
              helpKey: "activityGaps",
            },
            {
              id: "wrapup",
              label: OPS_COPY.outstandingDailyReports,
              value: wrapUpStats.missingToday,
              status: wrapUpStats.missingToday > 0 ? "attention" : "healthy",
              href: wrapUpsHref({ status: "missing" }),
              helpKey: "outstandingDailyReports",
            },
            {
              id: "overdue",
              label: OPS_COPY.overdueTasks,
              value: overdueCount,
              status: overdueCount > 0 ? "attention" : "healthy",
              href: operationsHref({ view: "overdue" }),
              helpKey: "overdueTasks",
            },
          ]}
        />
      }
      headerActions={
        <Button variant="outline" size="sm" render={<Link href="/org-chart" />}>
          View org chart
        </Button>
      }
      kpis={
        <KpiStrip
          columns={4}
          items={[
            {
              id: "workload",
              label: OPS_COPY.availableCapacity,
              value: workloadAlerts.length,
              warn: workloadAlerts.length > 0,
              critical: workloadAlerts.some((a) => a.severity === "critical"),
              href: alertCenterHref({ type: "workload" }),
              helpKey: "availableCapacity",
            },
            {
              id: "help",
              label: OPS_COPY.openEscalations,
              value: helpFlags.length,
              warn: helpFlags.length > 0,
              critical: helpFlags.some((f) => f.severity === "critical"),
              href: alertCenterHref({ type: "help" }),
              helpKey: "openEscalations",
            },
            {
              id: "activity_gaps",
              label: OPS_COPY.activityGap,
              value: activityGaps.length,
              warn: activityGaps.length > 0,
              href: alertCenterHref({ type: "activity_gaps" }),
              helpKey: "activityGaps",
            },
            {
              id: "wrapup",
              label: OPS_COPY.outstandingDailyReports,
              value: wrapUpStats.missingToday,
              warn: wrapUpStats.missingToday > 0,
              href: wrapUpsHref({ status: "missing" }),
              helpKey: "outstandingDailyReports",
            },
            {
              id: "overdue",
              label: OPS_COPY.overdueTasks,
              value: overdueCount,
              warn: overdueCount > 0,
              href: operationsHref({ view: "overdue" }),
              helpKey: "overdueTasks",
            },
          ]}
        />
      }
      alerts={
        !hasAlerts ? (
          <GlobalAlertBar variant="healthy">
            No open alerts in your branch. Team capacity looks healthy.
          </GlobalAlertBar>
        ) : (
          <GlobalAlertBar variant={hasCritical ? "danger" : "warn"} pulse={hasCritical}>
            {hasCritical
              ? "Critical alerts require immediate attention in your branch."
              : "Open alerts in your branch — review escalations and capacity signals below."}
          </GlobalAlertBar>
        )
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-8 p-0">
          {helpFlags.length > 0 && (
            <div id="help-flags" className="scroll-mt-24">
              <HelpFlagsPanel flags={helpFlags} role={user.role} />
            </div>
          )}
          {workloadAlerts.length > 0 && (
            <div id="workload-alerts" className="scroll-mt-24">
              <WorkloadAlertsPanel alerts={workloadAlerts} role={user.role} />
            </div>
          )}
          {activityGaps.length > 0 && (
            <div id="activity-gaps" className="scroll-mt-24">
              <ActivityGapsPanel gaps={activityGaps} />
            </div>
          )}
          <LiveActivityStream
            events={recentActivity}
            title="Alert Activity"
            description="Recent help, workload, and status events in your branch"
            maxItems={8}
            pulseStatus={hasCritical ? "critical" : hasAlerts ? "attention" : "nominal"}
          />
        </WorkspaceContainer>
      }
    />
  );
}
