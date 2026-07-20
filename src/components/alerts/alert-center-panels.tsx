"use client";

import { useMemo, useState } from "react";
import { HelpFlagsPanel } from "@/components/help-flags/help-flags-panel";
import { WorkloadAlertsPanel } from "@/components/workload-alerts/workload-alerts-panel";
import { ActivityGapsPanel } from "@/components/work-visibility/activity-gaps-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ActivityGapView,
  HelpFlagView,
  UserRole,
  WorkloadAlertView,
} from "@/types/flow";

export type AlertPersonOption = {
  id: string;
  name: string;
  teamId: string | null;
  teamName: string | null;
};

export function AlertCenterPanels({
  helpFlags,
  workloadAlerts,
  activityGaps,
  role,
  people,
  teams,
}: {
  helpFlags: HelpFlagView[];
  workloadAlerts: WorkloadAlertView[];
  activityGaps: ActivityGapView[];
  role: UserRole;
  people: AlertPersonOption[];
  teams: { id: string; name: string }[];
}) {
  const [teamId, setTeamId] = useState("all");
  const [personId, setPersonId] = useState("all");

  const peopleForTeam = useMemo(
    () => (teamId === "all" ? people : people.filter((p) => p.teamId === teamId)),
    [people, teamId]
  );

  const matches = useMemo(() => {
    const teamMemberIds =
      teamId === "all" ? null : new Set(peopleForTeam.map((p) => p.id));
    return (employeeId: string) => {
      if (personId !== "all") return employeeId === personId;
      if (teamMemberIds) return teamMemberIds.has(employeeId);
      return true;
    };
  }, [teamId, personId, peopleForTeam]);

  const flags = helpFlags.filter((f) => matches(f.employee_id));
  const alerts = workloadAlerts.filter((a) => matches(a.employee_id));
  const gaps = activityGaps.filter((g) => matches(g.employee_id));

  const totalUnfiltered =
    helpFlags.length + workloadAlerts.length + activityGaps.length;
  const totalFiltered = flags.length + alerts.length + gaps.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={teamId}
          onValueChange={(v) => {
            if (!v) return;
            setTeamId(v);
            setPersonId("all");
          }}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={personId} onValueChange={(v) => v && setPersonId(v)}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Everyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {peopleForTeam.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {flags.length > 0 && (
        <div id="help-flags" className="scroll-mt-24">
          <HelpFlagsPanel flags={flags} role={role} />
        </div>
      )}
      {alerts.length > 0 && (
        <div id="workload-alerts" className="scroll-mt-24">
          <WorkloadAlertsPanel alerts={alerts} role={role} />
        </div>
      )}
      {gaps.length > 0 && (
        <div id="activity-gaps" className="scroll-mt-24">
          <ActivityGapsPanel gaps={gaps} />
        </div>
      )}
      {totalFiltered === 0 && totalUnfiltered > 0 && (
        <p className="text-sm text-muted-foreground">
          No open alerts for this selection — clear the filters to see all{" "}
          {totalUnfiltered} open alert{totalUnfiltered === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}
