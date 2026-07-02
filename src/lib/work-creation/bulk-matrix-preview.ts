import { appTodayDate } from "@/lib/datetime/timezone";
import {
  aggregateMatrixStructure,
  generateMatrixRows,
  type GeneratedMatrixRow,
} from "@/lib/work-creation/bulk-matrix-generator";
import type { BulkMatrixDraft } from "@/lib/work-creation/bulk-matrix-types";
import {
  addWorkDays,
  calculateProjectPlanningForecast,
  calculateTaskForecast,
  getComplexityMultiplier,
} from "@/lib/forecast/engine";
import type { ForecastSettings } from "@/types/flow";

export interface BulkMatrixPreview {
  title: string;
  counts: {
    projects: number;
    makes: number;
    yearGroups: number;
    tasks: number;
  };
  totalDocuments: number;
  estimatedHours: number;
  estimatedWorkDays: number;
  suggestedCompletion: string | null;
  capacityImpact: "low" | "moderate" | "high" | "critical";
  riskStatus: string;
  qaTaskCount: number;
  fileTaskCount: number;
  treeSample: string[];
  enabled: string[];
}

function capacityImpact(totalWorkDays: number): BulkMatrixPreview["capacityImpact"] {
  if (totalWorkDays <= 20) return "low";
  if (totalWorkDays <= 60) return "moderate";
  if (totalWorkDays <= 120) return "high";
  return "critical";
}

export function buildBulkMatrixPreview(
  draft: BulkMatrixDraft,
  settings: ForecastSettings
): BulkMatrixPreview {
  const rows = generateMatrixRows(draft);
  const stats = aggregateMatrixStructure(rows);
  const totalDocuments = rows.length * Math.max(0, draft.docsPerTask || 0);

  let estimatedHours = 0;
  let estimatedWorkDays = 0;
  const startDate = appTodayDate();
  const multiplier = getComplexityMultiplier(draft.complexity);
  const minutesPerDoc = settings.minutes_per_document;

  if (draft.docsPerTask > 0) {
    for (const _row of rows) {
      const tf = calculateTaskForecast(
        {
          estimated_document_count: draft.docsPerTask,
          complexity_level: draft.complexity,
          start_date: startDate,
        },
        { settings }
      );
      estimatedHours += tf.estimated_work_hours ?? 0;
      estimatedWorkDays += tf.estimated_work_days ?? 0;
    }
  }

  const projectForecast = calculateProjectPlanningForecast(
    {
      estimated_total_documents: totalDocuments,
      complexity_level: draft.complexity,
      start_date: startDate,
      manual_project_due_date: draft.manualDueDate || null,
    },
    { settings }
  );

  const suggestedCompletion =
    projectForecast.suggested_project_due_date ??
    (estimatedWorkDays > 0
      ? addWorkDays(startDate, Math.ceil(estimatedWorkDays), settings.working_days)
      : null);

  const treeSample = buildTreeSample(rows, draft.matrixOrder).slice(0, 24);

  const enabled = [
    "Project dashboard & reporting",
    "Forecast tracking",
    `${settings.minutes_per_document} min/doc rate (org default)`,
    `${settings.productive_day_percent}% productive day`,
  ];
  if (draft.qaRequired) enabled.push(`QA on ${rows.length} tasks`);
  if (draft.filesRequired) enabled.push(`Files required on ${rows.length} tasks`);
  if (draft.dailyTracking) enabled.push("Daily progress tracking");

  return {
    title: draft.name.trim() || "Bulk matrix project",
    counts: {
      projects: 1,
      makes: stats.manufacturerCount,
      yearGroups: stats.yearGroupCount,
      tasks: stats.taskCount,
    },
    totalDocuments,
    estimatedHours: Math.round(estimatedHours * 100) / 100,
    estimatedWorkDays: Math.round(estimatedWorkDays * 100) / 100,
    suggestedCompletion,
    capacityImpact: capacityImpact(estimatedWorkDays),
    riskStatus: projectForecast.project_due_date_status ?? "needs_review",
    qaTaskCount: draft.qaRequired ? rows.length : 0,
    fileTaskCount: draft.filesRequired ? rows.length : 0,
    treeSample,
    enabled,
  };
}

function buildTreeSample(rows: GeneratedMatrixRow[], order: string): string[] {
  return rows.map((r) => {
    if (order === "year_make_model") {
      return `${r.year} → ${r.make} → ${r.taskTitle}`;
    }
    if (order === "make_year_task") {
      return `${r.make} → ${r.year} → ${r.taskTitle}`;
    }
    return `${r.make} → ${r.year} → ${r.taskTitle}`;
  });
}
