"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateHelpFlagSettingsAction } from "@/app/actions/help-flag-settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HelpFlagSettings } from "@/types/flow";

export function HelpFlagSettingsAdmin({ settings }: { settings: HelpFlagSettings }) {
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
        void updateHelpFlagSettingsAction({
          enabled: fd.get("enabled") === "on",
          escalation_minutes: Number(fd.get("escalation_minutes")),
          critical_idle_minutes: Number(fd.get("critical_idle_minutes")),
        })
          .then(() => {
            setSaved(true);
            router.refresh();
          })
          .finally(() => setPending(false));
      }}
    >
      <div className="flex items-center gap-2">
        <Checkbox id="enabled" name="enabled" defaultChecked={settings.enabled} />
        <Label htmlFor="enabled">Enable help flag escalations</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="escalation_minutes">Escalation after (minutes)</Label>
        <Input
          id="escalation_minutes"
          name="escalation_minutes"
          type="number"
          min={5}
          defaultValue={settings.escalation_minutes}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="critical_idle_minutes">Critical idle threshold (minutes)</Label>
        <Input
          id="critical_idle_minutes"
          name="critical_idle_minutes"
          type="number"
          min={15}
          defaultValue={settings.critical_idle_minutes}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
      {saved && <p className="text-xs text-emerald-400">Settings saved.</p>}
    </form>
  );
}
