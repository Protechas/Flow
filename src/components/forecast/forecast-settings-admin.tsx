"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getForecastSettingsAction, updateForecastSettingsAction } from "@/app/actions/forecast-settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NOMINAL_HOURS_PER_WORK_DAY } from "@/lib/forecast/capacity";
import { WORKING_DAY_LABELS } from "@/lib/forecast/constants";
import type { ForecastSettings } from "@/types/flow";

export function ForecastSettingsAdmin({ settings }: { settings: ForecastSettings }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [live, setLive] = useState(settings);
  const [days, setDays] = useState<number[]>(settings.working_days);

  useEffect(() => {
    setLive(settings);
    setDays(settings.working_days);
  }, [settings]);

  function toggleDay(day: number) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  return (
    <form
      key={live.updated_at}
      className="space-y-4 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setSaved(false);
        void updateForecastSettingsAction({
          minutes_per_document: Number(fd.get("minutes_per_document")),
          productive_day_percent: Number(fd.get("productive_day_percent")),
          working_days: days,
        })
          .then((next) => {
            setLive(next);
            setDays(next.working_days);
            setSaved(true);
            router.refresh();
            return getForecastSettingsAction();
          })
          .then(setLive)
          .finally(() => setPending(false));
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="minutes_per_document">Minutes per file</Label>
        <Input
          id="minutes_per_document"
          name="minutes_per_document"
          type="number"
          step="0.5"
          min={0.5}
          defaultValue={live.minutes_per_document}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="productive_day_percent">Productive day capacity (%)</Label>
        <Input
          id="productive_day_percent"
          name="productive_day_percent"
          type="number"
          step={5}
          min={10}
          max={100}
          defaultValue={live.productive_day_percent}
          required
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Percent of a full workday used for forecasting — fits flexible schedules not tied to
          clock hours. {live.productive_day_percent}% ≈ {live.productive_hours_per_day}h of a{" "}
          {NOMINAL_HOURS_PER_WORK_DAY}h reference day.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Working days</Label>
        <div className="flex flex-wrap gap-3">
          {WORKING_DAY_LABELS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={days.includes(d.value)}
                onCheckedChange={() => toggleDay(d.value)}
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Last updated {new Date(live.updated_at).toLocaleString()}
        {live.updated_by ? ` · saved to demo session` : ""}
      </p>
      {saved && (
        <p className="text-xs text-emerald-400">
          Settings saved. Forecasts across Operations, Projects, and Reports have been recalculated.
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending || days.length === 0}>
        {pending ? "Saving…" : "Save forecasting settings"}
      </Button>
      {days.length === 0 && (
        <p className="text-xs text-amber-400">Select at least one working day to enable save.</p>
      )}
    </form>
  );
}
