import {
  FlowPageShell,
  KpiStrip,
  WorkspaceContainer,
} from "@/components/platform";
import { FlowRoiView } from "@/components/roi/flow-roi-view";
import { ThenVsNowPanel } from "@/components/roi/then-vs-now-panel";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import {
  getAllTaskFileUploads,
  getAllTaskSubmissions,
} from "@/lib/data/production-tracking";
import { listLegacyMetrics } from "@/lib/legacy/monday-baseline";
import { buildThenVsNow } from "@/lib/legacy/then-vs-now";
import { computeFlowRoiSummary } from "@/lib/validation-center/roi";

/** First Monday the team clocked real work in Flow. */
const FLOW_ERA_START = "2026-06-29";

export default async function FlowRoiPage() {
  const user = await requirePageAccess("/roi");
  const roi = await computeFlowRoiSummary();
  await ensureAppDataLoaded();
  const thenVsNow = buildThenVsNow({
    legacy: await listLegacyMetrics(),
    uploads: getAllTaskFileUploads(),
    submissions: getAllTaskSubmissions(),
    wagePerHour: roi.settings.labor_rate || 22,
    flowStartDate: FLOW_ERA_START,
  });

  return (
    <FlowPageShell
      title="Flow ROI"
      eyebrow="Return on investment"
      breadcrumbs={[{ label: "Flow ROI" }]}
      description="What Flow saves in labor and subscriptions — every line is a count the system recorded times an editable assumption about the manual work it replaced."
      kpis={
        <KpiStrip
          columns={4}
          items={[
            {
              id: "labor",
              label: "Labor saved to date",
              value: `$${roi.totalDollars.toLocaleString()}`,
              helpKey: "roiLaborSaved",
            },
            {
              id: "hours",
              label: "Production hours saved",
              value: roi.totalHours,
              helpKey: "roiHoursSaved",
            },
            {
              id: "subscription",
              label: "Subscription saved / yr",
              value: `$${roi.subscription.annual.toLocaleString()}`,
              helpKey: "roiSubscription",
            },
            {
              id: "rate",
              label: "Labor rate",
              value: `$${roi.settings.labor_rate}/hr`,
              helpKey: "roiLaborRate",
            },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6">
          <section className="space-y-2">
            <div>
              <h2 className="text-base font-semibold">Then vs now</h2>
              <p className="text-xs text-muted-foreground">
                Monday.com era baseline (imported from the account export) against live Flow
                production — updates as the team works.
              </p>
            </div>
            <ThenVsNowPanel data={thenVsNow} />
          </section>
          <FlowRoiView
            summary={roi}
            canEdit={hasPermission(
              getEffectivePermissionRole(user),
              "validation:manage_settings"
            )}
          />
        </WorkspaceContainer>
      }
    />
  );
}
