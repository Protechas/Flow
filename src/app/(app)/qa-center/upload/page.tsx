import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { UploadQueueView } from "@/components/qa-center/upload-queue-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { listDocumentValidations } from "@/lib/qa-center/validations/db";
import { processPendingDocumentValidations } from "@/lib/qa-center/validations/processor";

export default async function QaCenterUploadPage() {
  await requirePageAccess("/qa-center/upload");
  await processPendingDocumentValidations(25);
  const user = await getCurrentUser();
  const validations = await listDocumentValidations(50);
  const canSubmit = user ? hasPermission(user.role, "validation:create") : false;

  return (
    <FlowPageShell
      title="Upload Queue"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Upload Queue" },
      ]}
      description="Submit documents for Knowledge Library-backed validation before human QA review."
      workspace={
        <WorkspaceContainer elevated={false}>
          <UploadQueueView validations={validations} canSubmit={canSubmit} />
        </WorkspaceContainer>
      }
    />
  );
}
