import { QaReviewPanel } from "@/components/qa/qa-review-panel";
import { DepartmentFilterBar } from "@/components/departments/department-filter-bar";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import {
  FilterToolbar,
  FlowPageShell,
  KpiStrip,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { CompletedReviewsPanel } from "@/components/qa/completed-reviews-panel";
import { requirePageAccess, requireWorkPackageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { canReviewQa } from "@/lib/auth/permissions";
import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { getBatchReviewQueue, getQaQueue, getQaReviews } from "@/lib/data/qa";
import { getWorkPackages } from "@/lib/data/work-packages";
import { getLatestSubmission, getTaskFiles } from "@/lib/data/production-tracking";
import { BatchReviewPanel } from "@/components/qa/batch-review-panel";
import { operationsHref, qaCenterHref } from "@/lib/navigation/deep-links";
import { parseDepartmentFilter } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getActiveDepartments } from "@/lib/departments/filters";

export default async function QaCenterReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; package?: string }>;
}) {
  const user = await requirePageAccess("/qa-center/review");
  const { department: deptParam, package: packageParam } = await searchParams;
  if (packageParam?.trim()) {
    await requireWorkPackageAccess(packageParam.trim(), "/qa-center");
  }
  const departmentFilter = parseDepartmentFilter({ department: deptParam });

  initFlowStore();
  const departments = getActiveDepartments(
    filterDepartmentsForViewer(listDepartments(), user)
  );

  const branchIds = getScopeMemberIds(user, getFlowStore().users, getFlowStore().teams);

  let queue = await getQaQueue(branchIds);
  if (departmentFilter) {
    queue = queue.filter((item) => item.department_id === departmentFilter);
  }

  let batchQueue = await getBatchReviewQueue(branchIds ?? undefined);
  if (departmentFilter) {
    batchQueue = batchQueue.filter((item) => item.task.department_id === departmentFilter);
  }
  const usersById = new Map(getFlowStore().users.map((u) => [u.id, u]));
  const batchItems = batchQueue.map(({ submission, task }) => {
    const taskFiles = getTaskFiles(task.id);
    const batchFileIds = new Set(submission.file_ids ?? []);
    return {
      submission,
      task,
      files: submission.file_ids
        ? taskFiles.filter((f) => batchFileIds.has(f.id))
        : taskFiles,
      analyst: task.assigned_to ? (usersById.get(task.assigned_to) ?? null) : null,
    };
  });

  const fileMap = Object.fromEntries(queue.map((item) => [item.id, getTaskFiles(item.id)]));
  const submissionMap = Object.fromEntries(
    queue.map((item) => [item.id, getLatestSubmission(item.id)])
  );

  // The archive: finished checks leave the queue automatically; this keeps
  // their record reachable without cluttering the working area.
  let completedReviews = await getQaReviews();
  if (branchIds?.length) {
    const branchSet = new Set(branchIds);
    completedReviews = completedReviews.filter((r) => branchSet.has(r.analyst_id));
  }
  const allPackages = await getWorkPackages();

  const inQa = queue.filter((q) => q.status === "in_qa").length;
  const ready = queue.filter((q) => q.status === "ready_for_qa").length;
  const corrections = queue.filter((q) => q.status === "correction_needed").length;

  return (
    <FlowPageShell
      title="Review Queue"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[
        { label: "QA Center", href: "/qa-center" },
        { label: "Review Queue" },
      ]}
      description={
        branchIds
          ? "Review your branch’s submissions — approve work, issue corrections, and track quality"
          : "Review queue — process submissions, track errors, and route corrections"
      }
      pulse={
        <OperationalPostureStrip
          signals={[
            { id: "queue", label: "In queue", value: queue.length, status: queue.length > 0 ? "attention" : "healthy", href: qaCenterHref(), helpKey: "qaQueue" },
            { id: "ready", label: "Ready", value: ready, status: ready > 0 ? "active" : "idle", href: qaCenterHref(), helpKey: "qaQueue" },
            { id: "inqa", label: "In QA", value: inQa, status: inQa > 0 ? "active" : "idle", href: qaCenterHref(), helpKey: "qaQueue" },
            {
              id: "corr",
              label: "Corrections",
              value: corrections,
              status: corrections > 0 ? "critical" : "healthy",
              href: operationsHref({ view: "correction_needed" }),
              helpKey: "qaIssues",
            },
          ]}
        />
      }
      filters={
        <FilterToolbar>
          <DepartmentFilterBar departments={departments} />
        </FilterToolbar>
      }
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { id: "queue", label: "In review queue", value: queue.length, helpKey: "qaQueue" },
            { id: "ready", label: "Ready for QA", value: ready, warn: ready > 0, helpKey: "qaQueue" },
            { id: "inqa", label: "In QA", value: inQa, helpKey: "qaQueue" },
            { id: "corr", label: "Corrections", value: corrections, warn: corrections > 0, critical: corrections > 3, helpKey: "qaIssues" },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <div className="p-6 pb-0">
            <QaCenterSubnav />
          </div>
          {batchItems.length > 0 && (
            <div className="px-6 pt-4">
              <BatchReviewPanel items={batchItems} canReview={canReviewQa(user.role)} />
            </div>
          )}
          <QaReviewPanel
            queue={queue}
            reviewer={user}
            canReview={canReviewQa(user.role)}
            fileMap={fileMap}
            submissionMap={submissionMap}
            initialPackageId={packageParam?.trim() || undefined}
          />
          <div className="px-6 pb-6">
            <CompletedReviewsPanel
              reviews={completedReviews}
              packages={allPackages}
              users={getFlowStore().users}
            />
          </div>
        </WorkspaceContainer>
      }
    />
  );
}
