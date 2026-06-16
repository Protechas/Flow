"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getWorkloadAlertSettingsAction,
  updateWorkloadAlertSettingsAction,
} from "@/app/actions/workload-alerts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Department, Team, WorkloadAlertSettings } from "@/types/flow";

export function WorkloadAlertSettingsAdmin({
  settings,
  departments,
  teams,
}: {
  settings: WorkloadAlertSettings;
  departments: Department[];
  teams: Team[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [live, setLive] = useState(settings);
  const [deptIds, setDeptIds] = useState<string[]>(settings.department_ids);
  const [teamIds, setTeamIds] = useState<string[]>(settings.team_ids);

  useEffect(() => {
    setLive(settings);
    setDeptIds(settings.department_ids);
    setTeamIds(settings.team_ids);
  }, [settings]);

  function toggleId(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <form
      key={live.updated_at}
      className="space-y-5 max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setSaved(false);
        void updateWorkloadAlertSettingsAction({
          enabled: fd.get("enabled") === "on",
          work_remaining_threshold_hours: Number(
            fd.get("work_remaining_threshold_hours")
          ),
          snooze_duration_hours: Number(fd.get("snooze_duration_hours")),
          department_ids: deptIds,
          team_ids: teamIds,
        })
          .then((next) => {
            setLive(next);
            setSaved(true);
            router.refresh();
            return getWorkloadAlertSettingsAction();
          })
          .then(setLive)
          .finally(() => setPending(false));
      }}
    >
      <div className="flex items-center gap-2">
        <Checkbox id="enabled" name="enabled" defaultChecked={live.enabled} />
        <Label htmlFor="enabled">Enable workload alerts</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="work_remaining_threshold_hours">
          Work remaining alert threshold (hours)
        </Label>
        <Input
          id="work_remaining_threshold_hours"
          name="work_remaining_threshold_hours"
          type="number"
          step="0.25"
          min={0.5}
          max={40}
          defaultValue={live.work_remaining_threshold_hours}
          required
        />
        <p className="text-xs text-muted-foreground">
          Employees below this forecasted hours remaining trigger a warning.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="snooze_duration_hours">Default snooze duration (hours)</Label>
        <Input
          id="snooze_duration_hours"
          name="snooze_duration_hours"
          type="number"
          step="1"
          min={1}
          max={168}
          defaultValue={live.snooze_duration_hours}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Alert departments (empty = all)</Label>
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-1.5 text-sm border border-border/60 rounded-md px-2 py-1"
            >
              <Checkbox
                checked={deptIds.includes(d.id)}
                onCheckedChange={() => toggleId(deptIds, d.id, setDeptIds)}
              />
              {d.name}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Alert teams (empty = all)</Label>
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-1.5 text-sm border border-border/60 rounded-md px-2 py-1"
            >
              <Checkbox
                checked={teamIds.includes(t.id)}
                onCheckedChange={() => toggleId(teamIds, t.id, setTeamIds)}
              />
              {t.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {saved && (
          <span className="text-xs text-primary">Settings saved.</span>
        )}
      </div>
    </form>
  );
}
