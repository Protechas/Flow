import {
  FlowPageShell,
  WorkspaceContainer,
} from "@/components/platform";
import { LaborCostTool } from "@/components/tools/labor-cost-tool";
import { requirePageAccess } from "@/lib/auth/guard";
import { getRoiSettings } from "@/lib/validation-center/roi";

export default async function LaborCostToolPage() {
  await requirePageAccess("/tools");
  const settings = await getRoiSettings();

  return (
    <FlowPageShell
      title="Labor Cost Calculator"
      eyebrow="Tools"
      breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "Labor Cost Calculator" }]}
      description="Hours × people × rate — with cost per document and required pace when you enter a document count."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-4">
          <LaborCostTool defaultRate={settings.labor_rate} />
        </WorkspaceContainer>
      }
    />
  );
}
