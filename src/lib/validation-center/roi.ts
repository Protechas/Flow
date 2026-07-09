import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { listValidationRuns } from "@/lib/validation-center/runs";

/** How much manual work each automated operation replaces — editable. */
export interface RoiSettings {
  labor_rate: number;
  manual_audit_hours: number;
  manual_validation_hours: number;
  manual_scan_hours: number;
  batch_review_minutes_saved: number;
  monday_seat_cost: number;
  timesheet_minutes_per_day: number;
  wrapup_minutes_saved: number;
  clock_correction_minutes: number;
  submission_routing_minutes: number;
}

export const DEFAULT_ROI_SETTINGS: RoiSettings = {
  labor_rate: 22,
  manual_audit_hours: 6,
  manual_validation_hours: 3,
  manual_scan_hours: 2,
  batch_review_minutes_saved: 15,
  monday_seat_cost: 14,
  timesheet_minutes_per_day: 5,
  wrapup_minutes_saved: 10,
  clock_correction_minutes: 10,
  submission_routing_minutes: 10,
};

export interface RoiLine {
  label: string;
  count: number;
  hoursEach: number;
  hoursSaved: number;
  dollars: number;
  basis: string;
}

export interface RoiSummary {
  settings: RoiSettings;
  lines: RoiLine[];
  totalHours: number;
  totalDollars: number;
}

/** The whole-app view: engine runs + counted workflow events + subscription. */
export interface FlowRoiSummary {
  settings: RoiSettings;
  engineLines: RoiLine[];
  workflowLines: RoiLine[];
  subscription: { seats: number; seatCost: number; monthly: number; annual: number };
  totalHours: number;
  totalDollars: number;
}

function admin() {
  return isSupabaseConfigured() && isAdminConfigured() ? createAdminClient() : null;
}

export async function getRoiSettings(): Promise<RoiSettings> {
  const db = admin();
  if (!db) return { ...DEFAULT_ROI_SETTINGS };
  const { data } = await db.from("roi_settings").select("*").eq("id", true).maybeSingle();
  if (!data) return { ...DEFAULT_ROI_SETTINGS };
  const settings = { ...DEFAULT_ROI_SETTINGS };
  for (const key of Object.keys(settings) as (keyof RoiSettings)[]) {
    const n = Number(data[key]);
    if (Number.isFinite(n)) settings[key] = n;
  }
  return settings;
}

export async function updateRoiSettings(
  settings: RoiSettings,
  updatedBy: string
): Promise<void> {
  const db = admin();
  if (!db) return;
  const { error } = await db
    .from("roi_settings")
    .upsert({ id: true, ...settings, updated_by: updatedBy, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

function priceLines(lines: RoiLine[], laborRate: number): void {
  for (const line of lines) {
    line.hoursSaved = Math.round(line.count * line.hoursEach * 10) / 10;
    line.dollars = Math.round(line.hoursSaved * laborRate);
  }
}

function sumLines(lines: RoiLine[]): { hours: number; dollars: number } {
  const hours = Math.round(lines.reduce((s, l) => s + l.hoursSaved, 0) * 10) / 10;
  return { hours, dollars: lines.reduce((s, l) => s + l.dollars, 0) };
}

async function buildEngineLines(settings: RoiSettings): Promise<RoiLine[]> {
  const runs = await listValidationRuns();
  const db = admin();
  let batches = 0;
  if (db) {
    const { count } = await db
      .from("task_submission_records")
      .select("id", { count: "exact", head: true })
      .eq("submission_type", "batch");
    batches = count ?? 0;
  }

  const completed = (engine: string) =>
    runs.filter((r) => r.engine_id === engine && r.status === "completed").length;

  const lines: RoiLine[] = [
    {
      label: "SI Library Audits",
      count: completed("si_library_audit"),
      hoursEach: settings.manual_audit_hours,
      hoursSaved: 0,
      dollars: 0,
      basis: "Manually cross-checking a manufacturer chart against the OneDrive export",
    },
    {
      label: "Library Validations",
      count: completed("si_library_external"),
      hoursEach: settings.manual_validation_hours,
      hoursSaved: 0,
      dollars: 0,
      basis: "Manually checking an external report against the audited library",
    },
    {
      label: "ID³ Validations",
      count: completed("id3_validation"),
      hoursEach: settings.manual_validation_hours,
      hoursSaved: 0,
      dollars: 0,
      basis: "Manually comparing a chart against the rules workbook",
    },
    {
      label: "QA Engine Scans",
      count: completed("qa_engine"),
      hoursEach: settings.manual_scan_hours,
      hoursSaved: 0,
      dollars: 0,
      basis: "Manually spot-checking workbooks for blanks, duplicates, and conflicts",
    },
    {
      label: "Batch Reviews",
      count: batches,
      hoursEach: Math.round((settings.batch_review_minutes_saved / 60) * 100) / 100,
      hoursSaved: 0,
      dollars: 0,
      basis: "End-of-package rework avoided by reviewing files in small batches",
    },
  ];
  priceLines(lines, settings.labor_rate);
  return lines;
}

/** Savings estimate: automated operations × the manual hours they replace. */
export async function computeRoiSummary(): Promise<RoiSummary> {
  const settings = await getRoiSettings();
  const lines = await buildEngineLines(settings);
  const { hours, dollars } = sumLines(lines);
  return { settings, lines, totalHours: hours, totalDollars: dollars };
}

// PostgREST builder generics don't survive being passed around; head-count
// queries don't need them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CountQuery = any;

async function countRows(
  table: string,
  filter?: (q: CountQuery) => CountQuery
): Promise<number> {
  const db = admin();
  if (!db) return 0;
  let query: CountQuery = db.from(table).select("id", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count } = await query;
  return (count as number | null) ?? 0;
}

export async function computeFlowRoiSummary(): Promise<FlowRoiSummary> {
  const settings = await getRoiSettings();

  const [engineLines, seats, clockDays, clockFixes, wrapUps, submissions] =
    await Promise.all([
      buildEngineLines(settings),
      countRows("users", (q) => q.eq("is_active", true)),
      countRows("time_clock_entries"),
      countRows("time_clock_entries", (q) => q.not("edited_by", "is", null)),
      countRows("daily_wrap_ups"),
      countRows("task_submission_records"),
    ]);

  const minutes = (m: number) => Math.round((m / 60) * 100) / 100;
  const workflowLines: RoiLine[] = [
    {
      label: "Tracked workdays",
      count: clockDays,
      hoursEach: minutes(settings.timesheet_minutes_per_day),
      hoursSaved: 0,
      dollars: 0,
      basis: "Automatic time tracking vs filling out and reconciling a manual timesheet",
    },
    {
      label: "Clock corrections",
      count: clockFixes,
      hoursEach: minutes(settings.clock_correction_minutes),
      hoursSaved: 0,
      dollars: 0,
      basis: "Punch fixes handled in-app with an audit trail vs the back-and-forth",
    },
    {
      label: "Daily reports filed",
      count: wrapUps,
      hoursEach: minutes(settings.wrapup_minutes_saved),
      hoursSaved: 0,
      dollars: 0,
      basis: "Wrap-ups replace chasing status and compiling it by hand",
    },
    {
      label: "Submissions routed",
      count: submissions,
      hoursEach: minutes(settings.submission_routing_minutes),
      hoursSaved: 0,
      dollars: 0,
      basis: "Work routes itself to QA instead of email and message coordination",
    },
  ];
  priceLines(workflowLines, settings.labor_rate);

  const monthly = Math.round(seats * settings.monday_seat_cost);
  const engines = sumLines(engineLines);
  const workflow = sumLines(workflowLines);

  return {
    settings,
    engineLines,
    workflowLines,
    subscription: {
      seats,
      seatCost: settings.monday_seat_cost,
      monthly,
      annual: monthly * 12,
    },
    totalHours: Math.round((engines.hours + workflow.hours) * 10) / 10,
    totalDollars: engines.dollars + workflow.dollars,
  };
}
