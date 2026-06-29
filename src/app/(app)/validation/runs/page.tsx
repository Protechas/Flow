import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { ValidationRunsTable } from "@/components/validation-center/validation-runs-table";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { listValidationRuns } from "@/lib/validation-center/runs";

export default async function ValidationRunsPage() {
  await requirePageAccess("/validation/runs");
  const runs = await listValidationRuns();

  return (
    <FlowPageShell
      title="Audit Runs"
      eyebrow={PLATFORM_EYEBROWS.validation}
      breadcrumbs={[
        { label: "Validation Center", href: "/validation" },
        { label: "Audit Runs" },
      ]}
      description="View past and in-progress validation runs."
      workspace={
        <WorkspaceContainer elevated={false}>
          <ValidationSubnav />
          <ValidationRunsTable runs={runs} />
        </WorkspaceContainer>
      }
    />
  );
}
