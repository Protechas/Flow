import { notFound } from "next/navigation";
import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { ValidationRunDetail } from "@/components/validation-center/validation-run-detail";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { getValidationRun } from "@/lib/validation-center/runs";
import { listFindingsForRun } from "@/lib/validation-center/findings";

export default async function ValidationRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("/validation/runs/[id]");
  const { id } = await params;
  const run = await getValidationRun(id);
  if (!run) notFound();
  const findings = await listFindingsForRun(id);

  return (
    <FlowPageShell
      title={run.title ?? "Run Detail"}
      eyebrow={PLATFORM_EYEBROWS.validation}
      breadcrumbs={[
        { label: "Validation Center", href: "/validation" },
        { label: "Audit Runs", href: "/validation/runs" },
        { label: run.manufacturer ?? id.slice(0, 8) },
      ]}
      description="Run summary, findings, artifacts, and downloads."
      workspace={
        <WorkspaceContainer elevated={false}>
          <ValidationSubnav />
          <ValidationRunDetail initialRun={run} initialFindings={findings} />
        </WorkspaceContainer>
      }
    />
  );
}
