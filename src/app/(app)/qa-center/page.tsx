import { QaReviewPanel } from "@/components/qa/qa-review-panel";
import { DepartmentFilterBar } from "@/components/departments/department-filter-bar";
import {
  FilterToolbar,
  FlowPageShell,
  KpiStrip,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess, requireWorkPackageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { canReviewQa } from "@/lib/auth/permissions";
import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { getQaQueue } from "@/lib/data/qa";
import { getLatestSubmission, getTaskFiles } from "@/lib/data/production-tracking";
import { operationsHref, qaCenterHref } from "@/lib/navigation/deep-links";
import { parseDepartmentFilter } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getActiveDepartments } from "@/lib/departments/filters";

export default async function QaCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; package?: string }>;
}) {
  const user = await requirePageAccess("/qa-center");
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

  const fileMap = Object.fromEntries(queue.map((item) => [item.id, getTaskFiles(item.id)]));
  const submissionMap = Object.fromEntries(
    queue.map((item) => [item.id, getLatestSubmission(item.id)])
  );

  const inQa = queue.filter((q) => q.status === "in_qa").length;
  const ready = queue.filter((q) => q.status === "ready_for_qa").length;
  const corrections = queue.filter((q) => q.status === "correction_needed").length;

  return (
    <FlowPageShell
      title="QA Review"
      eyebrow={PLATFORM_EYEBROWS.qa}
      breadcrumbs={[{ label: "QA Center" }]}
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
          <QaReviewPanel
            queue={queue}
            reviewer={user}
            canReview={canReviewQa(user.role)}
            fileMap={fileMap}
            submissionMap={submissionMap}
            initialPackageId={packageParam?.trim() || undefined}
          />
        </WorkspaceContainer>
      }
    />
  );
}
