import { redirect } from "next/navigation";
import { PeopleDashboard } from "@/components/people/people-dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getPeopleProfiles, getTeamScorecardSummary } from "@/lib/data/people";

export default async function PeoplePage() {
  const user = await requirePageAccess("/people");

  if (hasPermission(user.role, "people:view_own") && !hasPermission(user.role, "people:view_all")) {
    redirect(`/people/${user.id}`);
  }

  const [profiles, teamSummary] = await Promise.all([
    getPeopleProfiles(),
    getTeamScorecardSummary(),
  ]);

  return (
    <>
      <PageHeader
        title="People"
        description="Employee performance center — Flow Score, productivity, quality, workload, and QA metrics"
      />
      <PeopleDashboard profiles={profiles} teamSummary={teamSummary} />
    </>
  );
}
