import { appTodayDate } from "@/lib/datetime/timezone";
import { WrapUpReviewCenter } from "@/components/wrap-up/wrap-up-review-center";
import {
  FlowPageShell,
  KpiStrip,
  OperationalPostureStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess, assertScopedUserIdParam, requireWrapUpAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { filterDepartmentsForViewer } from "@/lib/departments/scope";
import { getActiveDepartments } from "@/lib/departments/filters";
import {
  getFlowStore,
  listDepartments,
  listTeamsStore,
} from "@/lib/data/flow-store";
import {
  buildWrapUpReviewRows,
  getWrapUpDashboardStats,
  getWrapUpReviewDetail,
  getWrapUpVisibleUserIds,
} from "@/lib/wrap-up/review";
import { isProductionEmployee } from "@/lib/users/production-roster";
import { OPS_COPY } from "@/lib/copy/executive-terminology";
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
  const store = getFlowStore();

  const visibleIds = getWrapUpVisibleUserIds(user);
  await assertScopedUserIdParam(
    user,
    userId,
    visibleIds ?? store.users.filter((u) => u.is_active).map((u) => u.id)
  );
  if (id?.trim()) {
    await requireWrapUpAccess(id.trim());
  }

  const departments = getActiveDepartments(filterDepartmentsForViewer(listDepartments(), user));
  const teams = listTeamsStore();
  const employees = store.users.filter(
    (u) => isProductionEmployee(u) && (visibleIds === null || visibleIds.includes(u.id))
  );

  const rows = buildWrapUpReviewRows(user, {
    startDate: format(subDays(new Date(), 14), "yyyy-MM-dd"),
    endDate: appTodayDate(),
  });
  const stats = getWrapUpDashboardStats(user);
  const detail = id ? getWrapUpReviewDetail(id, user) : null;
  const canReview =
    hasPermission(user.role, "work:view_all") || hasPermission(user.role, "people:view_team");

  return (
    <FlowPageShell
      title="Daily Report Review"
      eyebrow={PLATFORM_EYEBROWS.wrapUps}
      breadcrumbs={[{ label: "Daily Reports" }]}
      description="Review end-of-day reports from your team — blockers, support requests, and shift summaries"
      pulse={
        <OperationalPostureStrip
          signals={[
            {
              id: "missing",
              label: OPS_COPY.outstandingDailyReports,
              value: stats.missingToday,
              status: stats.missingToday > 0 ? "attention" : "healthy",
              helpKey: "outstandingDailyReports",
            },
            {
              id: "unreviewed",
              label: "Unreviewed",
              value: stats.unreviewed,
              status: stats.unreviewed > 0 ? "attention" : "healthy",
              helpKey: "wrapUpUnreviewed",
            },
            {
              id: "followup",
              label: "Needs follow-up",
              value: stats.followUpsNeeded,
              status: stats.followUpsNeeded > 0 ? "critical" : "healthy",
              helpKey: "wrapUpFollowUp",
            },
          ]}
        />
      }
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { id: "missing", label: "Missing today", value: stats.missingToday, warn: stats.missingToday > 0, helpKey: "wrapUpMissing" },
            { id: "submitted", label: "Submitted today", value: stats.submittedToday, helpKey: "wrapUpSubmitted" },
            { id: "unreviewed", label: "Unreviewed", value: stats.unreviewed, warn: stats.unreviewed > 0, helpKey: "wrapUpUnreviewed" },
            { id: "followup", label: "Needs follow-up", value: stats.followUpsNeeded, warn: stats.followUpsNeeded > 0, helpKey: "wrapUpFollowUp" },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-0">
          <WrapUpReviewCenter
            rows={rows}
            stats={stats}
            departments={departments}
            teams={teams}
            employees={employees}
            detail={detail}
            canReview={canReview}
            selectedId={id ?? null}
            initialStatus={
              status === "submitted" || status === "missing" || status === "overridden"
                ? status
                : undefined
            }
            initialReviewed={
              reviewed === "reviewed" || reviewed === "unreviewed" ? reviewed : undefined
            }
            initialFollowUp={followUp === "1"}
            initialUserId={userId}
          />
        </WorkspaceContainer>
      }
    />
  );
}
