import { Suspense } from "react";
import { DepartmentFilter } from "@/components/departments/department-filter";
import type { Department } from "@/types/flow";

export function DepartmentFilterBar({
  departments,
  className,
}: {
  departments: Department[];
  className?: string;
}) {
  if (departments.length <= 1) return null;
  return (
    <Suspense fallback={null}>
      <DepartmentFilter departments={departments} className={className} />
    </Suspense>
  );
}
