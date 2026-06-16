import { PageHeader } from "@/components/layout/page-header";
import { WrapUpReviewCenter } from "@/components/wrap-up/wrap-up-review-center";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getTeamMemberIds } from "@/lib/auth/team-scope";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getActiveDepartments } from "@/lib/departments/filters";
import {
  getFlowStore,
  initFlowStore,
  listDepartments,
  listTeamsStore,
} from "@/lib/data/flow-store";
import {
  buildWrapUpReviewRows,
  getWrapUpDashboardStats,
  getWrapUpReviewDetail,
  getWrapUpVisibleUserIds,
} from "@/lib/wrap-up/review";
import { format, subDays } from "date-fns";

export default async function WrapUpsPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    status?: string;
    reviewed?: string;
    followUp?: string;
    userId?: string;
  }>;
}) {
  const user = await requirePageAccess("/wrap-ups");
  const { id, status, reviewed, followUp, userId } = await searchParams;
  initFlowStore();
  const store = getFlowStore();

  const departments = getActiveDepartments(filterDepartmentsForViewer(listDepartments(), user));
  const teams = listTeamsStore();
  const visibleIds = getWrapUpVisibleUserIds(user);
  const employees = store.users.filter(
    (u) =>
      u.is_active &&
      u.role === "employee" &&
      (visibleIds === null || visibleIds.includes(u.id))
  );

  const rows = buildWrapUpReviewRows(user, {
    startDate: format(subDays(new Date(), 14), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const stats = getWrapUpDashboardStats(user);
  const detail = id ? getWrapUpReviewDetail(id, user) : null;
  const canReview =
    hasPermission(user.role, "work:view_all") || hasPermission(user.role, "people:view_team");

  return (
    <>
      <PageHeader
        title="Daily Wrap-Up Review"
        description="Review end-of-day submissions from your team — blockers, support requests, and shift summaries"
      />
      <WrapUpReviewCenter
        rows={rows}
        stats={stats}
        departments={departments}
        teams={teams}
        employees={employees}
        detail={detail}
        canReview={canReview}
        selectedId={id ?? null}
        initialStatus={status === "submitted" || status === "missing" || status === "overridden" ? status : undefined}
        initialReviewed={reviewed === "reviewed" || reviewed === "unreviewed" ? reviewed : undefined}
        initialFollowUp={followUp === "1"}
        initialUserId={userId}
      />
    </>
  );
}
