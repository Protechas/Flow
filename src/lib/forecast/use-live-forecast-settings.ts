"use client";

import { useEffect, useState } from "react";
import { getForecastSettingsAction } from "@/app/actions/forecast-settings";
import type { ForecastSettings } from "@/types/flow";

/** Keep forecast UI in sync with persisted org settings after admin changes. */
export function useLiveForecastSettings(initial: ForecastSettings): ForecastSettings {
  const [settings, setSettings] = useState(initial);

  useEffect(() => {
    setSettings(initial);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    void getForecastSettingsAction().then((next) => {
      if (!cancelled) setSettings(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
