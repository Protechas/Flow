import { DocumentViewer } from "@/components/files/document-viewer";
import { FlowDocumentContentView } from "@/components/files/flow-document-content";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser, assertCanViewTaskFile } from "@/lib/auth/session";
import {
  getCompanyDocumentById,
  getCompanyDocumentContent,
} from "@/lib/files/company-documents";
import { getTaskFileById, initProductionTracking } from "@/lib/data/production-tracking";
import { notFound, redirect } from "next/navigation";

export default async function EmployeeFileViewPage({
  params,
}: {
  params: Promise<{ source: string; id: string }>;
}) {
  const user = await requireUser();
  const { source, id } = await params;

  if (source === "company") {
    if (!hasPermission(user.role, "company_documents:view")) {
      redirect("/unauthorized");
    }

    const doc = await getCompanyDocumentById(id);
    if (!doc) notFound();

    // Once a doc has an in-Flow working copy, that copy is what the team reads.
    if (doc.content_updated_at != null) {
      const html = await getCompanyDocumentContent(doc.id).catch(() => null);
      if (html != null) {
        return (
          <FlowDocumentContentView
            title={doc.title}
            fileName={doc.file_name}
            html={html}
            updatedAt={doc.content_updated_at}
            backHref="/work/files"
            documentId={doc.id}
            canEdit={false}
          />
        );
      }
    }

    return (
      <DocumentViewer
        source="company"
        id={doc.id}
        title={doc.title}
        fileName={doc.file_name}
        mimeType={doc.mime_type}
        backHref="/work/files"
      />
    );
  }

  if (source === "task") {
    initProductionTracking();
    const file = getTaskFileById(id);
    if (!file) notFound();

    try {
      await assertCanViewTaskFile(user, file.task_id);
    } catch {
      redirect("/unauthorized");
    }

    return (
      <DocumentViewer
        source="task"
        id={file.id}
        title={file.file_name}
        fileName={file.file_name}
        mimeType={file.file_type}
        backHref="/work/files"
      />
    );
  }

  notFound();
}
