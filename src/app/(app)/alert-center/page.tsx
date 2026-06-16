import { PageHeader } from "@/components/layout/page-header";
import { HelpFlagsPanel } from "@/components/help-flags/help-flags-panel";
import { WorkloadAlertsPanel } from "@/components/workload-alerts/workload-alerts-panel";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
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
import { getWrapUpDashboardStats } from "@/lib/wrap-up/review";
import { getVisibleUserIds, isOrgWideRole } from "@/lib/hierarchy/resolver";
import { isOverdue } from "@/lib/scoring/flow-score";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AlertCenterPage() {
  const user = await requirePageAccess("/alert-center");
  await hydrateWorkloadAlertSettings();
  await hydrateHelpFlagSettings();
  initFlowStore();
  const store = getFlowStore();
  const teams = listTeamsStore();
  const packages = await getWorkPackages();

  const workloadAlerts = listWorkloadAlertsForViewer(user, packages, store.users);
  const helpFlags = listHelpFlagsForViewer(user, packages, store.users);

  const visibleIds = isOrgWideRole(user.role)
    ? null
    : new Set(getVisibleUserIds(user, store.users, teams));

  const scopedPackages = visibleIds
    ? packages.filter((p) => p.assigned_to && visibleIds.has(p.assigned_to))
    : packages;

  const overdueCount = scopedPackages.filter(isOverdue).length;
  const wrapUpStats = getWrapUpDashboardStats(user);

  return (
    <>
      <PageHeader
        title="Hierarchy Alert Center"
        eyebrow="Operational Signals"
        breadcrumbs={[{ label: "Alert Center" }]}
        description="Workload, help requests, wrap-ups, and overdue work — scoped to your reporting branch."
      >
        <Button variant="outline" size="sm" render={<Link href="/org-chart" />}>
          View org chart
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <EnterpriseKpi
          label="Workload alerts"
          value={workloadAlerts.length}
          warn={workloadAlerts.length > 0}
          href={alertCenterHref({ type: "workload" })}
          title="Jump to workload alerts"
        />
        <EnterpriseKpi
          label="Help requests"
          value={helpFlags.length}
          warn={helpFlags.length > 0}
          href={alertCenterHref({ type: "help" })}
          title="Jump to help requests"
        />
        <EnterpriseKpi
          label="Missing wrap-ups"
          value={wrapUpStats.missingToday}
          warn={wrapUpStats.missingToday > 0}
          href={wrapUpsHref({ status: "missing" })}
          title="Review missing wrap-ups"
        />
        <EnterpriseKpi
          label="Overdue tasks"
          value={overdueCount}
          warn={overdueCount > 0}
          href={operationsHref({ view: "overdue" })}
          title="View overdue tasks in operations"
        />
      </div>

      {helpFlags.length > 0 && (
        <div id="help-flags" className="mb-8 scroll-mt-24">
          <HelpFlagsPanel flags={helpFlags} role={user.role} />
        </div>
      )}

      {workloadAlerts.length > 0 && (
        <div id="workload-alerts" className="scroll-mt-24">
          <WorkloadAlertsPanel alerts={workloadAlerts} role={user.role} />
        </div>
      )}

      {helpFlags.length === 0 && workloadAlerts.length === 0 && (
        <div className="flow-alert-strip flow-alert-strip-healthy">
          <p className="text-sm text-muted-foreground">
            No open hierarchy alerts in your branch. Team capacity looks healthy.
          </p>
        </div>
      )}
    </>
  );
}
