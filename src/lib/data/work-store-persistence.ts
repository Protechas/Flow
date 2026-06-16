import type { WorkPackage, YearWorkItem } from "@/types/flow";

const PACKAGES_KEY = "__flow_work_packages__";
const YEARS_KEY = "__flow_year_work_items__";

type Scope = typeof globalThis & Record<string, unknown>;

function scope(): Scope {
  return globalThis as Scope;
}

export function readPersistedWorkPackages(): WorkPackage[] | null {
  const value = scope()[PACKAGES_KEY];
  return Array.isArray(value) ? (value as WorkPackage[]) : null;
}

export function writePersistedWorkPackages(packages: WorkPackage[]): void {
  scope()[PACKAGES_KEY] = packages;
}

export function readPersistedYearWorkItems(): YearWorkItem[] | null {
  const value = scope()[YEARS_KEY];
  return Array.isArray(value) ? (value as YearWorkItem[]) : null;
}

export function writePersistedYearWorkItems(items: YearWorkItem[]): void {
  scope()[YEARS_KEY] = items;
}
