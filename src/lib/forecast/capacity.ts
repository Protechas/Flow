import type { ForecastSettings } from "@/types/flow";

/** Reference length for a full workday when converting % capacity to hours for math. */
export const NOMINAL_HOURS_PER_WORK_DAY = 8;

export const DEFAULT_PRODUCTIVE_DAY_PERCENT = 81.25;

export function percentToProductiveHours(percent: number): number {
  return Math.round(((NOMINAL_HOURS_PER_WORK_DAY * percent) / 100) * 100) / 100;
}

export function hoursToProductivePercent(hours: number): number {
  if (hours <= 0) return DEFAULT_PRODUCTIVE_DAY_PERCENT;
  return Math.round((hours / NOMINAL_HOURS_PER_WORK_DAY) * 100 * 10) / 10;
}

export function productiveDayCapacityHours(
  settings: Pick<ForecastSettings, "productive_day_percent" | "productive_hours_per_day">
): number {
  if (
    settings.productive_day_percent != null &&
    !Number.isNaN(settings.productive_day_percent) &&
    settings.productive_day_percent > 0
  ) {
    return percentToProductiveHours(settings.productive_day_percent);
  }
  return settings.productive_hours_per_day ?? percentToProductiveHours(DEFAULT_PRODUCTIVE_DAY_PERCENT);
}

export function normalizeForecastSettings(settings: ForecastSettings): ForecastSettings {
  const rawPercent =
    settings.productive_day_percent ??
    hoursToProductivePercent(
      settings.productive_hours_per_day ?? percentToProductiveHours(DEFAULT_PRODUCTIVE_DAY_PERCENT)
    );
  const productive_day_percent = Math.min(100, Math.max(10, rawPercent));
  return {
    ...settings,
    productive_day_percent,
    productive_hours_per_day: percentToProductiveHours(productive_day_percent),
  };
}
