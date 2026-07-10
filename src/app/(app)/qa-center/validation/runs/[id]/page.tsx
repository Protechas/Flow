import { notFound } from "next/navigation";
import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { ValidationRunDetail } from "@/components/validation-center/validation-run-detail";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { isAiEnabled } from "@/lib/ai/client";
import { getTriageForRun } from "@/lib/ai/triage-db";
import { getValidationRun } from "@/lib/validation-center/runs";
import { listFindingsForRun } from "@/lib/validation-center/findings";
import { validationPath } from "@/lib/validation-center/nav";

export default async function QaCenterValidationRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("/qa-center/validation/runs");
  const { id } = await params;
  const run = await getValidationRun(id);
  if (!run) notFound();
  const findings = await listFindingsForRun(id);
  const aiEnabled = isAiEnabled();
  // Scoped single-row read — the only AI-related work on page load (no API calls).
  const triage = aiEnabled ? await getTriageForRun(id) : null;

  return (
    <FlowPageShell
      title={run.title ?? "Run Detail"}
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Validation Queue", href: "/qa-center/validation" },
        { label: "Audit Runs", href: validationPath("/runs") },
        { label: run.manufacturer ?? id.slice(0, 8) },
      ]}
      description="Run summary, findings, artifacts, and downloads."
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterSubnav />
          <ValidationSubnav />
          <ValidationRunDetail
            initialRun={run}
            initialFindings={findings}
            aiEnabled={aiEnabled}
            initialTriage={triage}
          />
        </WorkspaceContainer>
      }
    />
  );
}
