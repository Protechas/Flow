import { CompanyDocumentsPanel } from "@/components/files/company-documents-panel";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listCompanyDocuments } from "@/lib/files/company-documents";
import { listDocumentFolders } from "@/lib/files/document-folders";

export default async function EmployeeFilesPage() {
  const user = await requirePageAccess("/work/files");
  const canManage = hasPermission(user.role, "company_documents:manage");
  const documents = await listCompanyDocuments().catch(() => []);
  const folders = await listDocumentFolders().catch(() => []);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="flow-page-title text-2xl">Files &amp; SOPs</h1>
        <p className="flow-helper mt-1">
          Company procedures, reference documents, and standard operating guides.
        </p>
      </div>

      <CompanyDocumentsPanel documents={documents} folders={folders} canManage={canManage} employeeView />
    </div>
  );
}
