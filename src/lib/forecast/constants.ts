import type { DueDateStatus, ForecastComplexityLevel, LiveForecastStatus } from "@/types/flow";

export const COMPLEXITY_OPTIONS: { value: ForecastComplexityLevel; label: string; multiplier: string }[] = [
  { value: "simple", label: "Simple", multiplier: "0.80×" },
  { value: "standard", label: "Standard", multiplier: "1.00×" },
  { value: "complex", label: "Complex", multiplier: "1.30×" },
  { value: "very_complex", label: "Very Complex", multiplier: "1.50×" },
];

export const DUE_DATE_STATUS_LABELS: Record<DueDateStatus, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  behind_capacity: "Behind Capacity",
  needs_review: "Needs Review",
  no_forecast: "No Forecast",
};

/** Plain-language descriptions for tooltips */
export const DUE_DATE_STATUS_HINTS: Record<DueDateStatus, string> = {
  on_track: "Forecast suggests the project can meet its due date.",
  at_risk: "Capacity or timing may become tight — review soon.",
  behind_capacity: "Due date may be unrealistic based on current workload.",
  needs_review: "Forecast needs manager review before committing.",
  no_forecast: "Add document estimates to generate a forecast.",
};

export const DUE_DATE_STATUS_VARIANT: Record<
  DueDateStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  on_track: "secondary",
  at_risk: "outline",
  behind_capacity: "destructive",
  needs_review: "outline",
  no_forecast: "outline",
};

export const LIVE_FORECAST_STATUS_LABELS: Record<LiveForecastStatus, string> = {
  assigned: "Assigned",
  forecast_pending: "Forecast Pending",
  planning_forecast: "Planning Forecast",
  active_forecast: "Active Forecast",
  on_track: "On Track",
  at_risk: "At Risk",
  behind_forecast: "Behind Forecast",
  completed: "Completed",
};

export const LIVE_FORECAST_STATUS_CLASS: Record<LiveForecastStatus, string> = {
  assigned: "border-border text-muted-foreground",
  forecast_pending: "border-border text-muted-foreground",
  planning_forecast: "border-sky-500/30 text-sky-400 bg-sky-500/5",
  active_forecast: "border-indigo-500/30 text-indigo-400 bg-indigo-500/5",
  on_track: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
  at_risk: "border-amber-500/30 text-amber-400 bg-amber-500/5",
  behind_forecast: "border-red-500/30 text-red-400 bg-red-500/5",
  completed: "border-border text-muted-foreground",
};

export const WORKING_DAY_LABELS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];
