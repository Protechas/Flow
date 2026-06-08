import {
  completionPct,
  computeQaPassRate,
  isOverdue,
  isStuck,
} from "@/lib/scoring/flow-score";
import type {
  ActivityEvent,
  Manufacturer,
  ManufacturerRollup,
  Project,
  ProjectRollup,
  QaReview,
  RollupMetrics,
  WorkPackage,
  YearRollup,
  YearWorkItem,
} from "@/types/flow";
import { isBefore, parseISO, startOfDay } from "date-fns";

function isYearOverdue(y: YearWorkItem): boolean {
  if (!y.due_date || y.status === "done") return false;
  return isBefore(parseISO(y.due_date), startOfDay(new Date()));
}

function latestActivity(
  packages: WorkPackage[],
  yearItems: YearWorkItem[],
  activity: ActivityEvent[]
): string | null {
  const packageIds = new Set(packages.map((p) => p.id));
  const timestamps = [
    ...activity
      .filter((a) => a.work_package_id && packageIds.has(a.work_package_id))
      .map((a) => a.created_at),
    ...packages.map((p) => p.updated_at),
    ...yearItems.map((y) => y.updated_at),
  ];
  if (!timestamps.length) return null;
  return timestamps.sort((a, b) => b.localeCompare(a))[0];
}

export function rollupFromPackages(
  packages: WorkPackage[],
  qaReviews: QaReview[],
  yearItems: YearWorkItem[] = [],
  activity: ActivityEvent[] = []
): RollupMetrics {
  const packageIds = new Set(packages.map((p) => p.id));
  const relevantReviews = qaReviews.filter((r) =>
    packageIds.has(r.work_package_id)
  );
  const done = packages.filter((p) => p.status === "done").length;
  const totalUnits =
    packages.length +
    yearItems.filter((y) => packages.filter((p) => p.year_work_item_id === y.id).length === 0).length;
  const completedUnits =
    done +
    yearItems.filter(
      (y) => packages.filter((p) => p.year_work_item_id === y.id).length === 0 && y.status === "done"
    ).length;

  return {
    totalPackages: packages.length || yearItems.length,
    completedPackages: done,
    completedPct: totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : completionPct(packages),
    hoursLogged:
      packages.reduce((s, p) => s + Number(p.actual_hours), 0) +
      yearItems.reduce((s, y) => s + Number(y.actual_hours), 0),
    estimatedHours:
      packages.reduce((s, p) => s + Number(p.estimated_hours), 0) +
      yearItems.reduce((s, y) => s + Number(y.estimated_hours), 0),
    fileCount:
      packages.reduce((s, p) => s + p.file_count, 0) +
      yearItems.reduce((s, y) => s + y.file_count, 0),
    qaPassRate: computeQaPassRate(relevantReviews),
    correctionCount: packages.reduce((s, p) => s + p.correction_count, 0),
    overdueCount: packages.filter(isOverdue).length + yearItems.filter(isYearOverdue).length,
    stuckCount: packages.filter(isStuck).length + yearItems.filter((y) => y.status === "stuck").length,
    readyForQa: packages.filter((p) => ["ready_for_qa", "in_qa"].includes(p.status)).length,
    lastActivityAt: latestActivity(packages, yearItems, activity),
  };
}

export function projectRollup(
  project: Project,
  packages: WorkPackage[],
  manufacturers: Manufacturer[],
  qaReviews: QaReview[],
  yearItems: YearWorkItem[] = [],
  activity: ActivityEvent[] = []
): ProjectRollup {
  const projYears = yearItems.filter((y) => y.project_id === project.id);
  const base = rollupFromPackages(packages, qaReviews, projYears, activity);

  return {
    ...base,
    projectId: project.id,
    projectName: project.name,
    manufacturerCount: manufacturers.filter((m) => m.project_id === project.id).length,
    yearCount: projYears.length,
  };
}

export function manufacturerRollup(
  manufacturer: Manufacturer,
  packages: WorkPackage[],
  qaReviews: QaReview[],
  yearItems: YearWorkItem[] = [],
  activity: ActivityEvent[] = []
): ManufacturerRollup {
  const mfrYears = yearItems.filter((y) => y.manufacturer_id === manufacturer.id);
  const base = rollupFromPackages(packages, qaReviews, mfrYears, activity);
  const completedYears = mfrYears.filter((y) => y.status === "done").length;

  return {
    ...base,
    manufacturerId: manufacturer.id,
    manufacturerName: manufacturer.name,
    projectId: manufacturer.project_id,
    yearCount: mfrYears.length,
    completedYears,
  };
}

export function yearRollup(
  yearItem: YearWorkItem,
  packages: WorkPackage[],
  qaReviews: QaReview[],
  activity: ActivityEvent[] = []
): YearRollup {
  const yearPkgs = packages.filter((p) => p.year_work_item_id === yearItem.id);
  return {
    ...rollupFromPackages(yearPkgs, qaReviews, [yearItem], activity),
    yearWorkItemId: yearItem.id,
    year: yearItem.year,
    manufacturerId: yearItem.manufacturer_id,
    projectId: yearItem.project_id,
    packages: yearPkgs,
  };
}
