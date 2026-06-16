import { DocumentViewer } from "@/components/files/document-viewer";
import { hasPermission } from "@/lib/auth/permissions";
import { requireUser, assertCanViewTaskFile } from "@/lib/auth/session";
import { getCompanyDocumentById } from "@/lib/files/company-documents";
import { getTaskFileById, initProductionTracking } from "@/lib/data/production-tracking";
import { notFound, redirect } from "next/navigation";

export default async function FileViewPage({
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

    return (
      <DocumentViewer
        source="company"
        id={doc.id}
        title={doc.title}
        fileName={doc.file_name}
        mimeType={doc.mime_type}
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
      />
    );
  }

  notFound();
}
