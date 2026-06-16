import type { WorkPackage, YearWorkItem } from "@/types/flow";

const PACKAGES_KEY = "__flow_work_packages__";
const YEARS_KEY = "__flow_year_work_items__";

function isProductionMode(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    process.env.NEXT_PUBLIC_FLOW_DEMO_MODE !== "true"
  );
}

type Scope = typeof globalThis & Record<string, unknown>;

function scope(): Scope {
  return globalThis as Scope;
}

export function readPersistedWorkPackages(): WorkPackage[] | null {
  if (isProductionMode()) return null;
  const value = scope()[PACKAGES_KEY];
  return Array.isArray(value) ? (value as WorkPackage[]) : null;
}

export function writePersistedWorkPackages(packages: WorkPackage[]): void {
  if (isProductionMode()) return;
  scope()[PACKAGES_KEY] = packages;
}

export function readPersistedYearWorkItems(): YearWorkItem[] | null {
  if (isProductionMode()) return null;
  const value = scope()[YEARS_KEY];
  return Array.isArray(value) ? (value as YearWorkItem[]) : null;
}

export function writePersistedYearWorkItems(items: YearWorkItem[]): void {
  if (isProductionMode()) return;
  scope()[YEARS_KEY] = items;
}
