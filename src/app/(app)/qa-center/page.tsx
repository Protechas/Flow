import { PageHeader } from "@/components/layout/page-header";
import { QaReviewPanel } from "@/components/qa/qa-review-panel";
import { DepartmentFilterBar } from "@/components/departments/department-filter-bar";
import { requirePageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { canReviewQa } from "@/lib/auth/permissions";
import { getFlowStore, initFlowStore, listDepartments } from "@/lib/data/flow-store";
import { getQaQueue } from "@/lib/data/qa";
import { getLatestSubmission, getTaskFiles } from "@/lib/data/production-tracking";
import { parseDepartmentFilter } from "@/lib/departments/filters";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getActiveDepartments } from "@/lib/departments/filters";

export default async function QaCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const user = await requirePageAccess("/qa-center");
  const { department: deptParam } = await searchParams;
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

  return (
    <>
      <PageHeader
        title="QA Review"
        description={
          branchIds
            ? "Review your branch’s submissions — approve work, issue corrections, and track quality"
            : "Review queue — process submissions, track errors, and route corrections"
        }
      >
        <DepartmentFilterBar departments={departments} />
      </PageHeader>
      <QaReviewPanel
        queue={queue}
        reviewer={user}
        canReview={canReviewQa(user.role)}
        fileMap={fileMap}
        submissionMap={submissionMap}
      />
    </>
  );
}
