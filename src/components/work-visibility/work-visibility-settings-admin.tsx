"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateWorkVisibilitySettingsAction } from "@/app/actions/work-visibility-settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkVisibilitySettings } from "@/types/flow";

export function WorkVisibilitySettingsAdmin({
  settings,
}: {
  settings: WorkVisibilitySettings;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="space-y-5 max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setSaved(false);
        void updateWorkVisibilitySettingsAction({
          enabled: fd.get("enabled") === "on",
          alerts_enabled: fd.get("alerts_enabled") === "on",
          activity_gap_threshold_minutes: Number(fd.get("activity_gap_threshold_minutes")),
          task_tracking_compliance_target_pct: Number(
            fd.get("task_tracking_compliance_target_pct")
          ),
          daily_report_required: fd.get("daily_report_required") === "on",
          capacity_alert_threshold_pct: Number(fd.get("capacity_alert_threshold_pct")),
        })
          .then(() => {
            setSaved(true);
            router.refresh();
          })
          .finally(() => setPending(false));
      }}
    >
      <div className="rounded-lg border border-border/50 bg-muted/10 p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Operational use guidance</p>
        <p>
          Flow metrics are operational indicators intended to improve planning, workload visibility,
          forecasting, documentation, and process management.
        </p>
        <p>
          Metrics should not be used as the sole basis for disciplinary decisions.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="enabled" name="enabled" defaultChecked={settings.enabled} />
        <Label htmlFor="enabled">Enable work visibility tracking</Label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="alerts_enabled" name="alerts_enabled" defaultChecked={settings.alerts_enabled} />
        <Label htmlFor="alerts_enabled">Enable work visibility alerts</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity_gap_threshold_minutes">Activity gap threshold (minutes)</Label>
        <Input
          id="activity_gap_threshold_minutes"
          name="activity_gap_threshold_minutes"
          type="number"
          min={5}
          max={120}
          defaultValue={settings.activity_gap_threshold_minutes}
          required
        />
        <p className="text-xs text-muted-foreground">
          Informational alert when a clocked session has no associated active work record.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="task_tracking_compliance_target_pct">
          Task tracking compliance target (%)
        </Label>
        <Input
          id="task_tracking_compliance_target_pct"
          name="task_tracking_compliance_target_pct"
          type="number"
          min={50}
          max={100}
          defaultValue={settings.task_tracking_compliance_target_pct}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="capacity_alert_threshold_pct">Capacity alert threshold (%)</Label>
        <Input
          id="capacity_alert_threshold_pct"
          name="capacity_alert_threshold_pct"
          type="number"
          min={50}
          max={100}
          defaultValue={settings.capacity_alert_threshold_pct}
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="daily_report_required"
          name="daily_report_required"
          defaultChecked={settings.daily_report_required}
        />
        <Label htmlFor="daily_report_required">Daily report required for clock-out</Label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : saved ? "Saved" : "Save settings"}
      </Button>
    </form>
  );
}
