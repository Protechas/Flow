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
}

export const DEFAULT_ROI_SETTINGS: RoiSettings = {
  labor_rate: 35,
  manual_audit_hours: 6,
  manual_validation_hours: 3,
  manual_scan_hours: 2,
  batch_review_minutes_saved: 15,
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

function admin() {
  return isSupabaseConfigured() && isAdminConfigured() ? createAdminClient() : null;
}

export async function getRoiSettings(): Promise<RoiSettings> {
  const db = admin();
  if (!db) return { ...DEFAULT_ROI_SETTINGS };
  const { data } = await db.from("roi_settings").select("*").eq("id", true).maybeSingle();
  if (!data) return { ...DEFAULT_ROI_SETTINGS };
  return {
    labor_rate: Number(data.labor_rate) || DEFAULT_ROI_SETTINGS.labor_rate,
    manual_audit_hours: Number(data.manual_audit_hours) || DEFAULT_ROI_SETTINGS.manual_audit_hours,
    manual_validation_hours:
      Number(data.manual_validation_hours) || DEFAULT_ROI_SETTINGS.manual_validation_hours,
    manual_scan_hours: Number(data.manual_scan_hours) || DEFAULT_ROI_SETTINGS.manual_scan_hours,
    batch_review_minutes_saved:
      Number(data.batch_review_minutes_saved) || DEFAULT_ROI_SETTINGS.batch_review_minutes_saved,
  };
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

/** Savings estimate: automated operations × the manual hours they replace. */
export async function computeRoiSummary(): Promise<RoiSummary> {
  const settings = await getRoiSettings();
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

  for (const line of lines) {
    line.hoursSaved = Math.round(line.count * line.hoursEach * 10) / 10;
    line.dollars = Math.round(line.hoursSaved * settings.labor_rate);
  }

  const totalHours = Math.round(lines.reduce((s, l) => s + l.hoursSaved, 0) * 10) / 10;
  return {
    settings,
    lines,
    totalHours,
    totalDollars: Math.round(totalHours * settings.labor_rate),
  };
}
