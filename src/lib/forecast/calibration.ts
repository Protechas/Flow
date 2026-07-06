import type { ForecastSettings } from "@/types/flow";

/**
 * Self-calibrating forecasts. Every task submission records the ACTUAL
 * average minutes per document — this module aggregates that history so
 * estimates come from how the team really performs, not a hand-set default.
 *
 * Explicit per-task estimates always win; calibration only replaces the
 * global settings fallback. Blended 70/30 with the configured value so a
 * few unusual days can't whipsaw every due date.
 */

const MIN_TEAM_SAMPLES = 8;
const MIN_ASSIGNEE_SAMPLES = 5;
const SANE_MIN_MINUTES = 0.5;
const SANE_MAX_MINUTES = 240;
const BLEND_ACTUAL_WEIGHT = 0.7;

export interface CalibratedMinutes {
  value: number;
  source: "assignee_history" | "team_history" | "settings";
  sampleSize: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface SubmissionSample {
  user_id: string;
  average_minutes_per_document: number;
}

// Provider registered by production-tracking at init. Avoids a circular
// import (flow-store → calibration → production-tracking → flow-store).
let sampleProvider: (() => SubmissionSample[]) | null = null;

export function registerSubmissionSampleProvider(fn: () => SubmissionSample[]) {
  sampleProvider = fn;
}

function saneSamples(userId?: string): number[] {
  const submissions = sampleProvider?.() ?? [];
  return submissions
    .filter(
      (s) =>
        (!userId || s.user_id === userId) &&
        s.average_minutes_per_document >= SANE_MIN_MINUTES &&
        s.average_minutes_per_document <= SANE_MAX_MINUTES
    )
    .map((s) => s.average_minutes_per_document);
}

/** Resolve minutes-per-document from history, falling back to settings. */
export function calibratedMinutesPerDoc(
  settings: ForecastSettings,
  assigneeId?: string | null
): CalibratedMinutes {
  if (assigneeId) {
    const mine = saneSamples(assigneeId);
    if (mine.length >= MIN_ASSIGNEE_SAMPLES) {
      const blended =
        median(mine) * BLEND_ACTUAL_WEIGHT +
        settings.minutes_per_document * (1 - BLEND_ACTUAL_WEIGHT);
      return {
        value: Math.round(blended * 10) / 10,
        source: "assignee_history",
        sampleSize: mine.length,
      };
    }
  }

  const team = saneSamples();
  if (team.length >= MIN_TEAM_SAMPLES) {
    const blended =
      median(team) * BLEND_ACTUAL_WEIGHT +
      settings.minutes_per_document * (1 - BLEND_ACTUAL_WEIGHT);
    return {
      value: Math.round(blended * 10) / 10,
      source: "team_history",
      sampleSize: team.length,
    };
  }

  return {
    value: settings.minutes_per_document,
    source: "settings",
    sampleSize: 0,
  };
}

/** Settings with the calibrated minutes-per-document swapped in. */
export function calibrateSettings(
  settings: ForecastSettings,
  assigneeId?: string | null
): ForecastSettings {
  const calibrated = calibratedMinutesPerDoc(settings, assigneeId);
  if (calibrated.source === "settings") return settings;
  return { ...settings, minutes_per_document: calibrated.value };
}

/** Summary for settings/planning UI: what the team actually averages. */
export function getForecastCalibrationSummary(settings: ForecastSettings): {
  configuredMinutesPerDoc: number;
  actualTeamMedian: number | null;
  effectiveMinutesPerDoc: number;
  sampleSize: number;
} {
  const team = saneSamples();
  const calibrated = calibratedMinutesPerDoc(settings);
  return {
    configuredMinutesPerDoc: settings.minutes_per_document,
    actualTeamMedian: team.length > 0 ? Math.round(median(team) * 10) / 10 : null,
    effectiveMinutesPerDoc: calibrated.value,
    sampleSize: team.length,
  };
}
