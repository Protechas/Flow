import {
  FlowPageShell,
  KpiStrip,
  WorkspaceContainer,
} from "@/components/platform";
import { FlowRoiView } from "@/components/roi/flow-roi-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { computeFlowRoiSummary } from "@/lib/validation-center/roi";

export default async function FlowRoiPage() {
  const user = await requirePageAccess("/roi");
  const roi = await computeFlowRoiSummary();

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
            },
            { id: "hours", label: "Production hours saved", value: roi.totalHours },
            {
              id: "subscription",
              label: "Subscription saved / yr",
              value: `$${roi.subscription.annual.toLocaleString()}`,
            },
            { id: "rate", label: "Labor rate", value: `$${roi.settings.labor_rate}/hr` },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6">
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
