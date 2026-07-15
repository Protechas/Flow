import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/files/document-editor";
import { EddyReviewPanel } from "@/components/files/eddy-review-panel";
import { isAiEnabled } from "@/lib/ai/client";
import {
  FlowPageShell,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { Button } from "@/components/ui/button";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getCompanyDocumentById } from "@/lib/files/company-documents";
import {
  getEditableDocumentHtml,
  isDocumentEditable,
} from "@/lib/files/document-editing";
import { getAcknowledgmentStatus } from "@/lib/files/document-revisions";
import { AcknowledgmentReceipts } from "@/components/files/acknowledgment-receipts";
import { Download } from "lucide-react";

export default async function DocumentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess("/files");
  const canManage = hasPermission(user.role, "company_documents:manage");
  const { id } = await params;
  const doc = await getCompanyDocumentById(id);
  if (!doc) notFound();

  const editable = canManage && isDocumentEditable(doc);
  const content = editable ? await getEditableDocumentHtml(doc).catch(() => null) : null;
  const ackStatus = canManage ? await getAcknowledgmentStatus(doc.id).catch(() => null) : null;

  return (
    <FlowPageShell
      title={doc.title}
      eyebrow={PLATFORM_EYEBROWS.files}
      breadcrumbs={[{ label: "Files", href: "/files" }, { label: doc.title }]}
      description="Edit this document inside Flow — the uploaded original is never modified."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6">
          {ackStatus && <AcknowledgmentReceipts status={ackStatus} />}
          {content ? (
            <>
              <DocumentEditor
                documentId={doc.id}
                title={doc.title}
                fileName={doc.file_name}
                initialHtml={content.html}
                fromOriginal={content.fromOriginal}
                lastSavedAt={doc.content_updated_at ?? null}
              />
              {/* Hidden until ANTHROPIC_API_KEY exists (AI security rule: no dead AI UI). */}
              {isAiEnabled() && <EddyReviewPanel documentId={doc.id} />}
            </>
          ) : (
            <div className="enterprise-panel border-dashed p-10 text-center text-muted-foreground space-y-3">
              <p className="text-sm">
                {canManage
                  ? "This file type can't be edited in Flow. Word (.docx) and text files are editable; everything else is view and download only."
                  : "You don't have permission to edit company documents."}
              </p>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link
                    href={`/api/documents/${doc.id}?download=1`}
                    download={doc.file_name}
                    prefetch={false}
                  />
                }
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download original
              </Button>
            </div>
          )}
        </WorkspaceContainer>
      }
    />
  );
}
