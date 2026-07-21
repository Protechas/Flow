import type {
  OperatingModelWeeklyUpdatesConfig,
  TeamOperatingModel,
} from "@/lib/operating-models/types";
import type { DailyWrapUp, WorkPackage } from "@/types/flow";

export type WeeklyUpdateWindowState = "before_open" | "open" | "closed";

/**
 * Where "now" sits relative to the team's submission window, computed from
 * org-timezone day-of-week + hour. The window runs opens → due within one
 * Mon–Sun week (e.g. Thu 17:00 → Fri 15:00).
 */
export function weeklyUpdateWindowState(
  config: Pick<OperatingModelWeeklyUpdatesConfig, "opens" | "due">,
  appDay: number,
  appHour: number
): WeeklyUpdateWindowState {
  // Monday-based position so Sunday sorts after Saturday within the week.
  const pos = (day: number, hour: number) => ((day + 6) % 7) * 24 + hour;
  const now = pos(appDay, appHour);
  if (now < pos(config.opens.day, config.opens.hour)) return "before_open";
  if (now < pos(config.due.day, config.due.hour)) return "open";
  return "closed";
}

export function teamWeeklyUpdatesEnabled(model: TeamOperatingModel): boolean {
  return model.weeklyUpdates?.enabled === true && (model.weeklyUpdates.fields ?? []).length > 0;
}

/**
 * Pre-compose the week's update from what Flow already tracked: each day's
 * wrap-up summary, blockers, team-specific sections, and tasks completed
 * this week. Keyed to the standard four-section format via field ids:
 * work_completed / time_expectation / errors_issues / next_steps — any field
 * id not covered simply starts blank.
 */
export function buildWeeklyUpdateDraft(input: {
  fields: { id: string }[];
  wrapUps: DailyWrapUp[];
  completedTasks: Pick<WorkPackage, "title" | "completed_date">[];
}): Record<string, string> {
  const byDate = [...input.wrapUps].sort((a, b) => a.wrap_date.localeCompare(b.wrap_date));

  const workLines: string[] = [];
  for (const w of byDate) {
    if (w.completed_summary?.trim()) {
      workLines.push(`${w.wrap_date}:\n${w.completed_summary.trim()}`);
    }
  }
  if (input.completedTasks.length) {
    workLines.push(
      `Tasks completed: ${input.completedTasks.map((t) => t.title).join(", ")}`
    );
  }

  const blockerLines = byDate
    .filter((w) => w.blockers?.trim())
    .map((w) => `${w.wrap_date}: ${w.blockers!.trim()}`);

  const etaLines = byDate
    .map((w) => w.sections?.estimated_completion)
    .filter((v): v is string => !!v?.trim());

  const nextLines = byDate
    .map((w) => w.sections?.next_action)
    .filter((v): v is string => !!v?.trim());

  const drafts: Record<string, string> = {
    work_completed: workLines.join("\n\n"),
    time_expectation: etaLines.length ? etaLines[etaLines.length - 1] : "",
    errors_issues: blockerLines.join("\n"),
    next_steps: nextLines.length ? nextLines[nextLines.length - 1] : "",
  };

  const out: Record<string, string> = {};
  for (const field of input.fields) {
    out[field.id] = drafts[field.id] ?? "";
  }
  return out;
}
