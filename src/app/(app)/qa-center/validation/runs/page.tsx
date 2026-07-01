import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { ValidationRunsTable } from "@/components/validation-center/validation-runs-table";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { listValidationRuns } from "@/lib/validation-center/runs";

export default async function QaCenterValidationRunsPage() {
  await requirePageAccess("/qa-center/validation/runs");
  const runs = await listValidationRuns();

  return (
    <FlowPageShell
      title="Audit Runs"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Validation Queue", href: "/qa-center/validation" },
        { label: "Audit Runs" },
      ]}
      description="View past and in-progress validation runs."
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterSubnav />
          <ValidationSubnav />
          <ValidationRunsTable runs={runs} />
        </WorkspaceContainer>
      }
    />
  );
}
