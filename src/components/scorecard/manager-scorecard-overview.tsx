import { ManagerScorecardTable } from "@/components/scorecard/manager-scorecard-table";
import type { EmployeeScorecard, TeamScorecardSummary } from "@/types/flow";

export function ManagerScorecardOverview({
  profiles,
  teamSummary,
}: {
  profiles: EmployeeScorecard[];
  teamSummary: TeamScorecardSummary;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Team scorecards</h2>
        <p className="text-sm text-muted-foreground">
          Sort and drill into each employee. Click a row to open the full scorecard.
        </p>
      </div>
      <ManagerScorecardTable profiles={profiles} teamSummary={teamSummary} />
    </section>
  );
}
