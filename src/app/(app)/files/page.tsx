import Link from "next/link";
import { CompanyDocumentsPanel } from "@/components/files/company-documents-panel";
import {
  EmptyState,
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listCompanyDocuments } from "@/lib/files/company-documents";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getAllTaskFileUploads, initProductionTracking } from "@/lib/data/production-tracking";
import { fileViewHref, taskFileHasContent } from "@/lib/files/download";
import { filesHref, operationsHref } from "@/lib/navigation/deep-links";
import { format } from "date-fns";
import { FileStack } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const user = await requirePageAccess("/files");
  const { taskId } = await searchParams;
  const highlightTaskId = taskId?.trim();
  const canManage = hasPermission(user.role, "company_documents:manage");

  const documents = await listCompanyDocuments().catch(() => []);

  initFlowStore();
  initProductionTracking();
  const store = getFlowStore();
  const uploads = getAllTaskFileUploads().sort(
    (a, b) => b.uploaded_at.localeCompare(a.uploaded_at)
  );
  const showTaskUploads = hasPermission(user.role, "dashboard:view");

  // Group per task so uploads never blend together across tasks
  const uploadsByTask = new Map<string, typeof uploads>();
  for (const f of uploads) {
    const group = uploadsByTask.get(f.task_id);
    if (group) group.push(f);
    else uploadsByTask.set(f.task_id, [f]);
  }

  return (
    <FlowPageShell
      title="Files"
      eyebrow={PLATFORM_EYEBROWS.files}
      breadcrumbs={[{ label: "Files" }]}
      description="Company SOPs and reference documents, plus task uploads from production"
      kpis={
        <KpiStrip
          columns={3}
          items={[
            { id: "docs", label: "Company documents", value: documents.length },
            {
              id: "uploads",
              label: "Task uploads",
              value: showTaskUploads ? uploads.length : "—",
            },
            { id: "access", label: "Your access", value: canManage ? "Manage" : "View" },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-10 p-0">
          <section>
            <CompanyDocumentsPanel documents={documents} canManage={canManage} />
          </section>

          {showTaskUploads && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <FileStack className="h-4 w-4 text-muted-foreground" />
                <h2 className="enterprise-section-title mb-0">Task file uploads</h2>
              </div>
              {uploads.length === 0 ? (
                <EmptyState
                  icon={FileStack}
                  title="No task files uploaded yet"
                  description="Employees upload files from their task workspace; managers can attach files from Operations."
                />
              ) : (
                <Card className="border-border/60">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                            <th className="px-4 py-3 font-medium">File</th>
                            <th className="px-4 py-3 font-medium">Uploaded by</th>
                            <th className="px-4 py-3 font-medium">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...uploadsByTask.entries()].map(([taskId, taskUploads]) => {
                            const task = store.workPackages.find((p) => p.id === taskId);
                            const project = store.projects.find(
                              (p) => p.id === taskUploads[0]?.project_id
                            );
                            const highlighted = task && highlightTaskId === task.id;
                            return [
                              <tr
                                key={`task-${taskId}`}
                                id={highlighted ? `task-upload-${taskId}` : undefined}
                                className={cn(
                                  "border-b border-border/40 bg-muted/30",
                                  highlighted && "bg-primary/5 ring-1 ring-inset ring-primary/30"
                                )}
                              >
                                <td colSpan={3} className="px-4 py-2">
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    {task ? (
                                      <Link
                                        href={operationsHref({ package: task.id })}
                                        className="font-semibold text-primary hover:underline"
                                      >
                                        {task.title}
                                      </Link>
                                    ) : (
                                      <span className="font-semibold text-muted-foreground">
                                        Unknown task
                                      </span>
                                    )}
                                    {project && (
                                      <span className="text-muted-foreground">· {project.name}</span>
                                    )}
                                    <Badge variant="outline" className="text-[10px]">
                                      {taskUploads.length} file{taskUploads.length === 1 ? "" : "s"}
                                    </Badge>
                                  </div>
                                </td>
                              </tr>,
                              ...taskUploads.map((f) => {
                                const uploader = store.users.find((u) => u.id === f.user_id);
                                return (
                                  <tr
                                    key={f.id}
                                    className="border-b border-border/40 hover:bg-muted/20"
                                  >
                                    <td className="px-4 py-3 pl-8 font-medium">
                                      {taskFileHasContent(f) ? (
                                        <Link
                                          href={fileViewHref("task", f.id)}
                                          className="text-primary hover:underline"
                                        >
                                          {f.file_name}
                                        </Link>
                                      ) : (
                                        <span
                                          className="text-muted-foreground"
                                          title="File content unavailable — uploaded before file storage was enabled; please re-upload"
                                        >
                                          {f.file_name}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">{uploader?.full_name ?? f.user_id}</td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                      {format(new Date(f.uploaded_at), "MMM d, yyyy h:mm a")}
                                    </td>
                                  </tr>
                                );
                              }),
                            ];
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-3 border-t border-border/40">
                      <Badge variant="outline" className="text-xs">
                        {uploads.length} file{uploads.length === 1 ? "" : "s"} across{" "}
                        {uploadsByTask.size} task{uploadsByTask.size === 1 ? "" : "s"} · production
                        tracking
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          )}
        </WorkspaceContainer>
      }
    />
  );
}
