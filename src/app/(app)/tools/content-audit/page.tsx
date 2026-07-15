import {
  FlowPageShell,
  WorkspaceContainer,
} from "@/components/platform";
import { ContentAuditTool } from "@/components/tools/content-audit-tool";
import { requirePageAccess } from "@/lib/auth/guard";

export default async function ContentAuditPage() {
  await requirePageAccess("/tools");

  return (
    <FlowPageShell
      title="Content Audit"
      eyebrow="Utilities"
      breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "Content Audit" }]}
      description="Batch-check SI documents against the library SOPs — naming, size, orientation, highlights, and whether the content matches the label. Runs entirely in your browser."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6">
          <ContentAuditTool />
        </WorkspaceContainer>
      }
    />
  );
}
