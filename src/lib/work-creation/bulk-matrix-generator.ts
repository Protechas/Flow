import type { BulkMatrixDraft, BulkMatrixOrder } from "@/lib/work-creation/bulk-matrix-types";
import { sortLabels, sortNumbers } from "@/lib/work-creation/sort-labels";

export interface GeneratedMatrixRow {
  manufacturerName: string;
  year: number;
  taskTitle: string;
  make: string;
  model: string;
}

export function resolveModelNames(draft: Pick<
  BulkMatrixDraft,
  "models" | "useModelCount" | "modelCountPerGroup"
>): string[] {
  const named = draft.models.map((m) => m.trim()).filter(Boolean);
  if (named.length > 0) return sortLabels(named);
  const count = Math.max(1, draft.modelCountPerGroup || 1);
  if (draft.useModelCount) {
    return Array.from({ length: count }, (_, i) => `Unit ${i + 1}`);
  }
  return ["General Task"];
}

export function generateMatrixRows(
  draft: Pick<
    BulkMatrixDraft,
    | "matrixOrder"
    | "selectedMakes"
    | "selectedYears"
    | "models"
    | "useModelCount"
    | "modelCountPerGroup"
  >
): GeneratedMatrixRow[] {
  const makes = sortLabels(draft.selectedMakes.map((m) => m.trim()).filter(Boolean));
  const years = sortNumbers([...draft.selectedYears]);
  const modelNames = resolveModelNames(draft);
  const order: BulkMatrixOrder =
    draft.matrixOrder === "custom" ? "make_year_model" : draft.matrixOrder;

  // One generic task per make/year (no named models, count of 1) reads better
  // as "Acura 2021" than a meaningless "Unit 1".
  const singleGenericUnit =
    draft.models.map((m) => m.trim()).filter(Boolean).length === 0 &&
    draft.useModelCount &&
    Math.max(1, draft.modelCountPerGroup || 1) === 1;

  const rows: GeneratedMatrixRow[] = [];

  for (const make of makes) {
    for (const year of years) {
      for (const model of modelNames) {
        const row = mapRow(order, make, year, model);
        if (singleGenericUnit) row.taskTitle = `${make} ${year}`;
        rows.push(row);
      }
    }
  }

  return rows.sort((a, b) => {
    const byMake = a.make.localeCompare(b.make, undefined, { sensitivity: "base" });
    if (byMake !== 0) return byMake;
    if (a.year !== b.year) return a.year - b.year;
    return a.taskTitle.localeCompare(b.taskTitle, undefined, { sensitivity: "base" });
  });
}

function mapRow(
  order: BulkMatrixOrder,
  make: string,
  year: number,
  model: string
): GeneratedMatrixRow {
  switch (order) {
    case "year_make_model":
      return {
        manufacturerName: String(year),
        year,
        taskTitle: `${make} — ${model}`,
        make,
        model,
      };
    case "make_year_task":
      return {
        manufacturerName: make,
        year,
        taskTitle: model,
        make,
        model,
      };
    case "make_year_model":
    case "custom":
    default:
      return {
        manufacturerName: make,
        year,
        taskTitle: model,
        make,
        model,
      };
  }
}

export function aggregateMatrixStructure(rows: GeneratedMatrixRow[]) {
  const manufacturers = new Set<string>();
  const yearGroups = new Set<string>();
  for (const row of rows) {
    manufacturers.add(row.manufacturerName);
    yearGroups.add(`${row.manufacturerName}::${row.year}`);
  }
  return {
    manufacturerCount: manufacturers.size,
    yearGroupCount: yearGroups.size,
    taskCount: rows.length,
  };
}
