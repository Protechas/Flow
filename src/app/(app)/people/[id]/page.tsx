import { PageHeader } from "@/components/layout/page-header";
import { EmployeeScorecardView } from "@/components/performance/employee-scorecard-view";
import { requireOwnProfileOrTeam } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getPeopleProfile, getTeamScorecardSummary } from "@/lib/data/people";
import { notFound } from "next/navigation";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireOwnProfileOrTeam(id);
  const profile = await getPeopleProfile(id);
  if (!profile) notFound();

  const canDrillDown = hasPermission(viewer.role, "people:view_all");
  const teamSummary = canDrillDown ? await getTeamScorecardSummary() : undefined;

  return (
    <>
      <PageHeader
        title={profile.user.full_name}
        description="Employee scorecard with performance metrics and trends"
      />
      <EmployeeScorecardView
        scorecard={profile}
        teamSummary={teamSummary}
        showManagerDrillDown={canDrillDown}
        backHref={canDrillDown ? "/people" : undefined}
      />
    </>
  );
}
