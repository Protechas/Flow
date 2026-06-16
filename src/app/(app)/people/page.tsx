import { redirect } from "next/navigation";
import { PeopleDashboard } from "@/components/people/people-dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { getTeamMemberIds } from "@/lib/auth/team-scope";
import { getVisibleUserIds, isOrgWideRole } from "@/lib/hierarchy/resolver";
import { hasPermission, isTeamLeadRole, canAccessHref } from "@/lib/auth/permissions";
import { getPeopleProfiles, getTeamScorecardSummary } from "@/lib/data/people";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";

export default async function PeoplePage() {
  const user = await requirePageAccess("/people");

  if (hasPermission(user.role, "people:view_own") && !hasPermission(user.role, "people:view_all") && !hasPermission(user.role, "people:view_team")) {
    redirect(`/people/${user.id}`);
  }

  initFlowStore();
  const storeUsers = getFlowStore().users;
  const scopeIds = isOrgWideRole(user.role)
    ? undefined
    : getVisibleUserIds(user, storeUsers, getFlowStore().teams);

  const [profiles, teamSummary] = await Promise.all([
    getPeopleProfiles(scopeIds),
    getTeamScorecardSummary(scopeIds),
  ]);

  const analyticsHref = canAccessHref(user.role, "/analytics")
    ? "/analytics"
    : canAccessHref(user.role, "/performance")
      ? "/performance"
      : undefined;

  return (
    <>
      <PageHeader
        title={isTeamLeadRole(user.role) ? "My Team" : "People"}
        description={
          isTeamLeadRole(user.role)
            ? "Team performance — workload, productivity, quality, and QA metrics for your direct reports"
            : "Employee performance center — Flow Score, productivity, quality, workload, and QA metrics"
        }
      />
      <PeopleDashboard
        profiles={profiles}
        teamSummary={teamSummary}
        analyticsHref={analyticsHref}
      />
    </>
  );
}
