"use client";

import { useState, useTransition } from "react";
import { saveSiLibrarySettingsAction } from "@/app/actions/validation-center";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SiLibraryAuditSettings } from "@/lib/validation-center/types";

export function ValidationSettingsForm({
  initialSettings,
}: {
  initialSettings: SiLibraryAuditSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateNumber(key: keyof SiLibraryAuditSettings, value: string) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    setSettings((prev) => ({ ...prev, [key]: num }));
  }

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveSiLibrarySettingsAction(settings);
      setMessage(result.ok ? "Settings saved." : result.message);
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>SI Library Audit Settings</CardTitle>
        <CardDescription>
          Thresholds and defaults passed to the Python audit engine on each run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="excellent">Excellent threshold (%)</Label>
            <Input
              id="excellent"
              type="number"
              step="0.1"
              value={settings.compliance_threshold_excellent}
              onChange={(e) => updateNumber("compliance_threshold_excellent", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acceptable">Acceptable threshold (%)</Label>
            <Input
              id="acceptable"
              type="number"
              step="0.1"
              value={settings.compliance_threshold_acceptable}
              onChange={(e) => updateNumber("compliance_threshold_acceptable", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="similarity">Similarity threshold</Label>
            <Input
              id="similarity"
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={settings.similarity_threshold}
              onChange={(e) => updateNumber("similarity_threshold", e.target.value)}
            />
          </div>
        </div>
        {message && (
          <p className={`text-sm ${message.includes("saved") ? "text-muted-foreground" : "text-destructive"}`}>
            {message}
          </p>
        )}
        <Button onClick={onSave} disabled={pending}>
          Save settings
        </Button>
      </CardContent>
    </Card>
  );
}
