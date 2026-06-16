import type { Department } from "@/types/flow";
import { filterByDepartmentId } from "@/lib/departments/scope";

export function parseDepartmentFilter(
  searchParams: { department?: string } | undefined
): string | null {
  const value = searchParams?.department;
  if (!value || value === "all") return null;
  return value;
}

export function applyDepartmentFilter<T>(
  items: T[],
  getDepartmentId: (item: T) => string | null | undefined,
  departmentId: string | null
): T[] {
  return filterByDepartmentId(items, getDepartmentId, departmentId);
}

export function getActiveDepartments(departments: Department[]): Department[] {
  return departments.filter((d) => d.status === "active");
}
