import Link from "next/link";
import { CompanyDocumentsPanel } from "@/components/files/company-documents-panel";
import { TaskFilesBrowser, type TaskFileGroup } from "@/components/files/task-files-browser";
import {
  EmptyState,
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { Button } from "@/components/ui/button";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { listCompanyDocuments } from "@/lib/files/company-documents";
import { listDocumentFolders } from "@/lib/files/document-folders";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getAllTaskFileUploads, initProductionTracking } from "@/lib/data/production-tracking";
import { getContentReviewVerdictMap } from "@/lib/content-checks/reviews";
import { taskFileHasContent } from "@/lib/files/download";
import { BookOpen, FileStack } from "lucide-react";

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string; tab?: string }>;
}) {
  const user = await requirePageAccess("/files");
  const { taskId, tab } = await searchParams;
  const highlightTaskId = taskId?.trim();
  const canManage = hasPermission(user.role, "company_documents:manage");
  const showTaskUploads = hasPermission(user.role, "dashboard:view");

  // Task-upload deep links (e.g. from a task workspace) land on that tab.
  const activeTab =
    showTaskUploads && (tab === "tasks" || highlightTaskId) ? "tasks" : "library";

  const documents = await listCompanyDocuments().catch(() => []);
  const folders = await listDocumentFolders().catch(() => []);

  initFlowStore();
  initProductionTracking();
  const store = getFlowStore();
  const uploads = getAllTaskFileUploads().sort(
    (a, b) => b.uploaded_at.localeCompare(a.uploaded_at)
  );
  // Automatic content-check verdicts, shown as per-file badges in the browser.
  const reviewVerdicts = showTaskUploads ? await getContentReviewVerdictMap() : {};

  // Group per task; the browser component handles search, project filters,
  // and expand/collapse so a thousand uploads never render as one flat list.
  const groupMap = new Map<string, TaskFileGroup>();
  for (const f of uploads) {
    let group = groupMap.get(f.task_id);
    if (!group) {
      const task = store.workPackages.find((p) => p.id === f.task_id);
      const project = store.projects.find((p) => p.id === f.project_id);
      const analyst = task?.assigned_to
        ? store.users.find((u) => u.id === task.assigned_to)
        : null;
      group = {
        taskId: f.task_id,
        taskTitle: task?.title ?? "Unknown task",
        projectName: project?.name ?? "Unknown project",
        analystName: analyst?.full_name ?? "Unassigned",
        latestUploadAt: f.uploaded_at,
        missingContent: 0,
        files: [],
      };
      groupMap.set(f.task_id, group);
    }
    const hasContent = taskFileHasContent(f);
    if (!hasContent) group.missingContent += 1;
    group.files.push({
      id: f.id,
      name: f.file_name,
      uploadedAt: f.uploaded_at,
      uploader: store.users.find((u) => u.id === f.user_id)?.full_name ?? "Unknown",
      hasContent,
      checkVerdict: reviewVerdicts[f.id] ?? null,
    });
  }
  const taskGroups = [...groupMap.values()];

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
        <WorkspaceContainer elevated={false} bodyClassName="space-y-4 p-0">
          {showTaskUploads && (
            <div className="flex items-center gap-2 px-1">
              <Button
                variant={activeTab === "library" ? "secondary" : "ghost"}
                size="sm"
                render={<Link href="/files" prefetch={false} />}
              >
                <BookOpen className="mr-1.5 h-4 w-4" />
                Document Library
              </Button>
              <Button
                variant={activeTab === "tasks" ? "secondary" : "ghost"}
                size="sm"
                render={<Link href="/files?tab=tasks" prefetch={false} />}
              >
                <FileStack className="mr-1.5 h-4 w-4" />
                Task Uploads
                <span className="ml-1.5 text-xs text-muted-foreground">{uploads.length}</span>
              </Button>
            </div>
          )}

          {activeTab === "library" ? (
            <section>
              <CompanyDocumentsPanel
                documents={documents}
                folders={folders}
                canManage={canManage}
              />
            </section>
          ) : (
            <section className="space-y-4">
              {uploads.length === 0 ? (
                <EmptyState
                  icon={FileStack}
                  title="No task files uploaded yet"
                  description="Employees upload files from their task workspace; managers can attach files from Operations."
                />
              ) : (
                <TaskFilesBrowser groups={taskGroups} initialTaskId={highlightTaskId} />
              )}
            </section>
          )}
        </WorkspaceContainer>
      }
    />
  );
}
