import {
  FlowPageShell,
  WorkspaceContainer,
} from "@/components/platform";
import { ContentAuditTool } from "@/components/tools/content-audit-tool";
import { requirePageAccess } from "@/lib/auth/guard";
import { listAuditRuns, summarizeAuditHistory } from "@/lib/content-checks/audit-runs";
import { getReadyFlowStore } from "@/lib/data/app-hydrate";
import { isProductionRosterMember } from "@/lib/users/production-roster";

export default async function ContentAuditPage() {
  await requirePageAccess("/tools");
  const history = summarizeAuditHistory(await listAuditRuns().catch(() => []));

  // For the findings→tasks approval dialog: where tasks can land, and who
  // can take them. Names only — tiny payload.
  const store = await getReadyFlowStore();
  const projects = store.projects
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const assignees = store.users
    .filter((u) => u.is_active && isProductionRosterMember(u))
    .map((u) => ({ id: u.id, name: u.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <FlowPageShell
      title="Content Audit"
      eyebrow="Utilities"
      breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "Content Audit" }]}
      description="Batch-check SI documents against the library SOPs — naming, size, orientation, highlights, and whether the content matches the label. Runs entirely in your browser."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6">
          <ContentAuditTool history={history} projects={projects} assignees={assignees} />
        </WorkspaceContainer>
      }
    />
  );
}
