import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { ValidationCorrectionsView } from "@/components/validation-center/validation-corrections-view";
import { ValidationSubnav } from "@/components/validation-center/validation-subnav";
import { requirePageAccess } from "@/lib/auth/guard";
import { listValidationCorrections } from "@/lib/validation-center/findings";

export default async function QaCenterValidationCorrectionsPage() {
  await requirePageAccess("/qa-center/validation/corrections");
  const corrections = await listValidationCorrections();

  const pendingQa = corrections.filter((c) => c.qa_status === "pending").length;
  const resolved = corrections.filter((c) => c.status === "resolved").length;
  const open = corrections.filter((c) => c.status !== "resolved" && c.status !== "dismissed").length;

  return (
    <FlowPageShell
      title="Corrections"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Validation Queue", href: "/qa-center/validation" },
        { label: "Corrections" },
      ]}
      description="Track correction tasks linked to validation findings."
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { label: "Linked Tasks", value: corrections.length },
            { label: "Open Corrections", value: open, warn: open > 0 },
            { label: "QA Pending", value: pendingQa, warn: pendingQa > 0 },
            { label: "Resolved", value: resolved },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false}>
          <QaCenterSubnav />
          <ValidationSubnav />
          <ValidationCorrectionsView initialCorrections={corrections} />
        </WorkspaceContainer>
      }
    />
  );
}
