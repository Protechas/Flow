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
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CircleDashed, Download } from "lucide-react";

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
          {ackStatus && (
            <div className="enterprise-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  Revision {ackStatus.revision.revision_number}
                </p>
                <Badge
                  variant="outline"
                  className={
                    ackStatus.pending.length === 0 ? "text-emerald-500 border-emerald-500/30" : ""
                  }
                >
                  {ackStatus.acknowledged.length}/
                  {ackStatus.acknowledged.length + ackStatus.pending.length} accepted
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Published {new Date(ackStatus.revision.published_at).toLocaleString()} ·{" "}
                  {ackStatus.revision.change_summary}
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Accepted</p>
                  {ackStatus.acknowledged.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nobody yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {ackStatus.acknowledged.map((a) => (
                        <li key={a.userId} className="flex items-center gap-1.5 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          {a.name}
                          <span className="text-muted-foreground">
                            · {new Date(a.at).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Still pending
                  </p>
                  {ackStatus.pending.length === 0 ? (
                    <p className="text-xs text-emerald-500">Everyone has accepted.</p>
                  ) : (
                    <ul className="space-y-1">
                      {ackStatus.pending.map((p) => (
                        <li key={p.userId} className="flex items-center gap-1.5 text-xs">
                          <CircleDashed className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
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
