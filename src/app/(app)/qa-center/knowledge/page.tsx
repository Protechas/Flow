import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { KnowledgeLibraryView } from "@/components/qa-center/knowledge-library-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { listMcChartManufacturers } from "@/lib/qa-center/knowledge/files";
import { ensureReferenceDocumentsLoaded, listKnowledgeEntries } from "@/lib/qa-center/knowledge/store";
import { getKnowledgeLibraryStatus } from "@/lib/qa-center/knowledge/status";

export default async function QaCenterKnowledgePage() {
  await requirePageAccess("/qa-center/knowledge");
  await ensureReferenceDocumentsLoaded();
  const user = await getCurrentUser();
  const [entries, mcManufacturers, libraryStatus] = await Promise.all([
    listKnowledgeEntries(),
    listMcChartManufacturers(),
    getKnowledgeLibraryStatus(),
  ]);
  const canManage = user ? hasPermission(user.role, "validation:manage_settings") : false;

  return (
    <FlowPageShell
      title="Knowledge Library"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Knowledge Library" },
      ]}
      description="Authoritative reference source for QA validation — SOPs, charts, workbooks, and gold standards."
      workspace={
        <WorkspaceContainer elevated={false}>
          <KnowledgeLibraryView
            entries={entries}
            mcManufacturers={mcManufacturers}
            canManage={canManage}
            libraryStatus={libraryStatus}
          />
        </WorkspaceContainer>
      }
    />
  );
}
