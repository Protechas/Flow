import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { NewAuditWizard } from "@/components/validation-center/new-audit-wizard";
import { ValidationEnginePicker } from "@/components/validation-center/validation-engine-picker";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { getValidationEngine } from "@/lib/validation-center/engines/registry";
import type { ValidationEngineId } from "@/lib/validation-center/types";

export default async function NewValidationPage({
  searchParams,
}: {
  searchParams: Promise<{ engine?: string }>;
}) {
  await requirePageAccess("/validation/new");
  const { engine: engineId } = await searchParams;
  const engine = engineId ? getValidationEngine(engineId as ValidationEngineId) : undefined;

  return (
    <FlowPageShell
      title="New Validation"
      eyebrow={PLATFORM_EYEBROWS.validation}
      breadcrumbs={[
        { label: "Validation Center", href: "/validation" },
        { label: "New Validation" },
      ]}
      description="Choose a validation engine — drag & drop single files or import audits in batch."
      workspace={
        <WorkspaceContainer elevated={false}>
          <ValidationSubnav />
          {engine?.status === "active" ? (
            <NewAuditWizard engineId={engine.id} />
          ) : (
            <ValidationEnginePicker />
          )}
        </WorkspaceContainer>
      }
    />
  );
}
