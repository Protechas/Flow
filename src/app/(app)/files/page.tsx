import { PageHeader } from "@/components/layout/page-header";
import { CompanyDocumentsPanel } from "@/components/files/company-documents-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listCompanyDocuments } from "@/lib/files/company-documents";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getAllTaskFileUploads, initProductionTracking } from "@/lib/data/production-tracking";
import { fileViewHref } from "@/lib/files/download";
import { format } from "date-fns";
import { FileStack } from "lucide-react";
import Link from "next/link";

export default async function FilesPage() {
  const user = await requirePageAccess("/files");
  const canManage = hasPermission(user.role, "company_documents:manage");

  const documents = await listCompanyDocuments().catch(() => []);

  initFlowStore();
  initProductionTracking();
  const store = getFlowStore();
  const uploads = getAllTaskFileUploads().sort(
    (a, b) => b.uploaded_at.localeCompare(a.uploaded_at)
  );
  const showTaskUploads = hasPermission(user.role, "dashboard:view");

  return (
    <>
      <PageHeader
        title="Files"
        description="Company SOPs and reference documents, plus task uploads from production"
      />

      <section className="mb-10">
        <CompanyDocumentsPanel documents={documents} canManage={canManage} />
      </section>

      {showTaskUploads && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FileStack className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Task file uploads</h2>
          </div>
          {uploads.length === 0 ? (
            <Card className="border-border/60 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileStack className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No task files uploaded yet.</p>
                <p className="text-xs mt-2 text-center max-w-md">
                  Employees upload files from their task workspace; managers can attach files from Operations.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">File</th>
                        <th className="px-4 py-3 font-medium">Task</th>
                        <th className="px-4 py-3 font-medium">Project</th>
                        <th className="px-4 py-3 font-medium">Uploaded by</th>
                        <th className="px-4 py-3 font-medium">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploads.map((f) => {
                        const task = store.workPackages.find((p) => p.id === f.task_id);
                        const project = store.projects.find((p) => p.id === f.project_id);
                        const uploader = store.users.find((u) => u.id === f.user_id);
                        return (
                          <tr key={f.id} className="border-b border-border/40 hover:bg-muted/20">
                            <td className="px-4 py-3 font-medium">
                              {f.file_data_base64 ? (
                                <Link
                                  href={fileViewHref("task", f.id)}
                                  className="text-primary hover:underline"
                                >
                                  {f.file_name}
                                </Link>
                              ) : (
                                f.file_name
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {task ? (
                                <Link
                                  href={`/operations?package=${task.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {task.title}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{project?.name ?? "—"}</td>
                            <td className="px-4 py-3">{uploader?.full_name ?? f.user_id}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {format(new Date(f.uploaded_at), "MMM d, yyyy h:mm a")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-border/40">
                  <Badge variant="outline" className="text-xs">
                    {uploads.length} file{uploads.length === 1 ? "" : "s"} · production tracking
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}
    </>
  );
}
